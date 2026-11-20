'use server'

/**
 * Setting what a room costs.
 *
 * Until this existed, a price could only be changed by editing the seed file
 * and re-running it, which meant ABN could not correct its own rates without a
 * developer. For a system whose whole job is running the building, that was the
 * wrong place for the business to depend on us.
 *
 * Two layers, matching the pricing engine:
 *
 *   - the room's BASE rate, used when no rate plan covers a night, and
 *   - RATE PLANS, each with its own window and priority, which is where
 *     seasonal pricing actually lives.
 *
 * Money arrives from the form in major units — someone types 50, meaning fifty
 * dollars — and is converted once, here, with toMinor(). Nothing downstream
 * ever sees a float.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireActor } from '@/lib/session'
import { AccessError, assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { toMinor, formatMinor } from '@/lib/core/money'
import { raiseAlert } from '@/lib/alerts/dispatch'
import type { Currency } from '@prisma/client'

/**
 * On failure the typed values come back with the error.
 *
 * React resets a form once its action resolves, so without this a clerk who
 * mistypes one date loses the whole rate plan they just keyed in and has to
 * start again. The dialog seeds its fields from these.
 */
export type RateResult =
  | { ok: true; message: string }
  | { ok: false; error: string; values?: Record<string, string> }

/** Money as typed by a human: "50", "50.5", "1,200.00". */
const majorAmount = z.preprocess(
  (v) => (typeof v === 'string' ? v.replace(/,/g, '').trim() : v),
  z.coerce.number().min(0, 'An amount cannot be negative.')
)

/** The same, but optional — an empty field means "not set", not zero. */
const optionalMajor = z.preprocess(
  (v) => (v === '' || v == null ? undefined : typeof v === 'string' ? v.replace(/,/g, '').trim() : v),
  z.coerce.number().min(0, 'An amount cannot be negative.').optional()
)

const optionalDate = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.string().optional()
)

/**
 * Turn the browser's YYYY-MM-DD into a UTC midnight Date.
 *
 * `new Date('2026-12-15')` is already UTC midnight, but going through the
 * local-time constructor is not, and a rate window that shifts by a day
 * depending on where the clerk is standing would be its own bug.
 */
function parseDay(raw: string | undefined): Date | null {
  if (!raw) return null
  const d = new Date(`${raw}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

async function unitForWrite(unitId: string) {
  const actor = await requireActor()
  const unit = await db.unit.findUniqueOrThrow({
    where: { id: unitId },
    select: {
      id: true,
      name: true,
      propertyId: true,
      currency: true,
      isAmenity: true,
      baseNightlyMinor: true,
      baseRentMinor: true,
      instantBook: true,
    },
  })
  assertCanOnProperty(actor, 'units:write', unit.propertyId)
  return { actor, unit }
}

/** Every text field as typed, so a refused submit can be handed back intact. */
function rawValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

/** Our own errors are fit to read; anything else names tables and columns. */
function present(
  error: unknown,
  fallback: string,
  values?: Record<string, string>
): RateResult {
  const ours =
    error instanceof AccessError || (error instanceof Error && error.constructor === Error)
  if (ours) return { ok: false, error: (error as Error).message, values }
  console.error('[rates] failed', error)
  return { ok: false, error: fallback, values }
}

// ---------------------------------------------------------------- base rates

const baseSchema = z.object({
  currency: z.enum(['GHS', 'USD']),
  baseNightly: optionalMajor,
  baseRent: optionalMajor,
  instantBook: z.string().optional(),
})

export async function updateRoomRatesAction(
  unitId: string,
  _prev: RateResult | null,
  formData: FormData
): Promise<RateResult> {
  try {
    const { actor, unit } = await unitForWrite(unitId)

    if (unit.isAmenity) {
      throw new Error(`${unit.name} is shared space and is never let, so it has no rate.`)
    }

    const raw = rawValues(formData)
    const parsed = baseSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Check the figures.',
        values: raw,
      }
    }
    const input = parsed.data
    const currency = input.currency as Currency

    const baseNightlyMinor =
      input.baseNightly === undefined ? null : toMinor(input.baseNightly, currency)
    const baseRentMinor = input.baseRent === undefined ? null : toMinor(input.baseRent, currency)

    if (baseNightlyMinor !== null && baseNightlyMinor === 0) {
      throw new Error('A nightly rate of zero would let the room out free. Leave it blank instead.')
    }

    // Changing the room's currency while rate plans are priced in the old one
    // would make the quote flip currency depending on the dates chosen — the
    // engine takes the currency from whichever plan matches the night. Move
    // the plans across in the same breath, or refuse.
    const planCurrencies = await db.ratePlan.findMany({
      where: { unitId, active: true, currency: { not: currency } },
      select: { id: true, name: true },
    })
    if (planCurrencies.length > 0) {
      throw new Error(
        `${planCurrencies.length} active rate plan${planCurrencies.length === 1 ? '' : 's'} ` +
          `still priced in ${unit.currency} (${planCurrencies.map((p) => p.name).join(', ')}). ` +
          `Change or deactivate ${planCurrencies.length === 1 ? 'it' : 'them'} first, ` +
          `so a quote cannot change currency depending on the dates.`
      )
    }

    await db.unit.update({
      where: { id: unitId },
      data: {
        currency,
        baseNightlyMinor,
        baseRentMinor,
        instantBook: input.instantBook === 'on',
      },
    })

    await logAudit({
      actor,
      action: 'room.rates_updated',
      entityType: 'Unit',
      entityId: unitId,
      before: {
        currency: unit.currency,
        baseNightlyMinor: unit.baseNightlyMinor,
        baseRentMinor: unit.baseRentMinor,
        instantBook: unit.instantBook,
      },
      after: {
        currency,
        baseNightlyMinor,
        baseRentMinor,
        instantBook: input.instantBook === 'on',
      },
    })

    await raiseAlert('rates.changed', {
      title: `${unit.name}: rate changed to ${baseNightlyMinor == null ? 'none' : formatMinor(baseNightlyMinor, currency)} a night`,
      body: `Was ${unit.baseNightlyMinor == null ? 'not set' : formatMinor(unit.baseNightlyMinor, unit.currency)}. The audit trail records who changed it.`,
      link: `/admin/rooms/${unitId}`,
      propertyId: unit.propertyId,
      metadata: { ref: `rate:${unitId}`, beforeMinor: unit.baseNightlyMinor, afterMinor: baseNightlyMinor },
    })

    revalidatePath(`/admin/rooms/${unitId}`)
    revalidatePath('/admin/rooms')
    revalidatePath('/book')

    return { ok: true, message: `${unit.name} updated. New bookings use the new rate.` }
  } catch (error) {
    return present(error, 'Could not save the rates.', rawValues(formData))
  }
}

// ---------------------------------------------------------------- rate plans

const planSchema = z.object({
  planId: z.string().optional(),
  name: z.string().trim().min(2, 'Give the plan a name.').max(60),
  nightly: majorAmount,
  weekly: optionalMajor,
  monthly: optionalMajor,
  cleaningFee: optionalMajor,
  minNights: z.coerce.number().int().min(1, 'A stay is at least one night.').max(365),
  maxNights: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number().int().min(1).max(3650).optional()
  ),
  startDate: optionalDate,
  endDate: optionalDate,
  priority: z.coerce.number().int().min(0).max(999),
})

export async function saveRatePlanAction(
  unitId: string,
  _prev: RateResult | null,
  formData: FormData
): Promise<RateResult> {
  try {
    const { actor, unit } = await unitForWrite(unitId)

    if (unit.isAmenity) {
      throw new Error(`${unit.name} is shared space and is never let, so it has no rates.`)
    }

    const raw = rawValues(formData)
    const parsed = planSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Check the figures.',
        values: raw,
      }
    }
    const input = parsed.data

    if (input.nightly <= 0) {
      throw new Error('A rate plan needs a nightly rate above zero.')
    }
    if (input.maxNights !== undefined && input.maxNights < input.minNights) {
      throw new Error('The longest stay cannot be shorter than the shortest.')
    }

    const startDate = parseDay(input.startDate)
    const endDate = parseDay(input.endDate)
    if (input.startDate && !startDate) throw new Error('That start date could not be read.')
    if (input.endDate && !endDate) throw new Error('That end date could not be read.')

    // The engine treats a window as half-open — endDate excluded — exactly like
    // a stay, so an end on or before the start covers no nights at all and the
    // plan would silently never apply.
    if (startDate && endDate && endDate <= startDate) {
      throw new Error('The end of the window must be after its start.')
    }

    const currency = unit.currency
    const data = {
      name: input.name,
      currency,
      nightlyMinor: toMinor(input.nightly, currency),
      weeklyMinor: input.weekly === undefined ? null : toMinor(input.weekly, currency),
      monthlyMinor: input.monthly === undefined ? null : toMinor(input.monthly, currency),
      cleaningFeeMinor: input.cleaningFee === undefined ? 0 : toMinor(input.cleaningFee, currency),
      minNights: input.minNights,
      maxNights: input.maxNights ?? null,
      startDate,
      endDate,
      priority: input.priority,
    }

    let before: unknown = null
    let planId = input.planId

    if (planId) {
      // Scoped by unitId as well as id: a plan id from another room must not
      // be editable just because the actor can write THIS room.
      const existing = await db.ratePlan.findFirst({
        where: { id: planId, unitId },
      })
      if (!existing) throw new Error('That rate plan is no longer on this room.')
      before = {
        name: existing.name,
        nightlyMinor: existing.nightlyMinor,
        minNights: existing.minNights,
        priority: existing.priority,
      }
      await db.ratePlan.update({ where: { id: planId }, data })
    } else {
      const created = await db.ratePlan.create({ data: { ...data, unitId, active: true } })
      planId = created.id
    }

    await logAudit({
      actor,
      action: before ? 'rate_plan.updated' : 'rate_plan.created',
      entityType: 'RatePlan',
      entityId: planId,
      before,
      after: { ...data, unit: unit.name },
    })

    revalidatePath(`/admin/rooms/${unitId}`)
    revalidatePath('/book')

    return {
      ok: true,
      message: before ? `"${input.name}" updated.` : `"${input.name}" added to ${unit.name}.`,
    }
  } catch (error) {
    return present(error, 'Could not save the rate plan.', rawValues(formData))
  }
}

/**
 * Switch a plan on or off.
 *
 * Deactivating rather than deleting: a plan that priced a stay last December is
 * part of how that booking came to cost what it did, and throwing the row away
 * would make the history unexplainable.
 */
export async function setRatePlanActiveAction(
  unitId: string,
  planId: string,
  active: boolean
): Promise<RateResult> {
  try {
    const { actor, unit } = await unitForWrite(unitId)

    const plan = await db.ratePlan.findFirst({
      where: { id: planId, unitId },
      select: { id: true, name: true, active: true, currency: true },
    })
    if (!plan) throw new Error('That rate plan is no longer on this room.')

    if (active && plan.currency !== unit.currency) {
      throw new Error(
        `"${plan.name}" is priced in ${plan.currency} but the room is in ${unit.currency}. ` +
          `Edit the plan first, so a quote cannot change currency depending on the dates.`
      )
    }

    await db.ratePlan.update({ where: { id: planId }, data: { active } })

    await logAudit({
      actor,
      action: active ? 'rate_plan.activated' : 'rate_plan.deactivated',
      entityType: 'RatePlan',
      entityId: planId,
      before: { active: plan.active },
      after: { active },
    })

    revalidatePath(`/admin/rooms/${unitId}`)
    revalidatePath('/book')

    return { ok: true, message: active ? `"${plan.name}" is live.` : `"${plan.name}" is off.` }
  } catch (error) {
    return present(error, 'Could not change the rate plan.')
  }
}
