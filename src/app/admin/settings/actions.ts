'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { dateOnly } from '@/lib/core/dates'
import { CANCELLATION_KEY } from '@/lib/policies'
import { DEFAULT_CANCELLATION, cancellationSummary } from '@/lib/core/cancellation'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/**
 * Record a new exchange rate.
 *
 * Rates are dated and never overwritten. Entries already posted keep the rate
 * they were posted at, so adding a rate today cannot rewrite last year's
 * revenue — which is the whole reason the rate is stored on the entry.
 */
export async function setFxRateAction(formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requirePermission('settings:write')

    const rate = Number(String(formData.get('rate') ?? ''))
    const asOfRaw = String(formData.get('asOf') ?? '')

    if (!Number.isFinite(rate) || rate <= 0) {
      return { ok: false, error: 'Enter a rate greater than zero.' }
    }
    if (!asOfRaw) {
      return { ok: false, error: 'Choose the date the rate takes effect.' }
    }

    const asOf = dateOnly(asOfRaw)

    await db.fxRate.upsert({
      where: { from_to_asOf: { from: 'USD', to: 'GHS', asOf } },
      update: { rate, source: 'manual' },
      create: { from: 'USD', to: 'GHS', rate, asOf, source: 'manual' },
    })

    await logAudit({
      actor,
      action: 'settings.fx_rate_set',
      entityType: 'FxRate',
      entityId: `USD-GHS-${asOfRaw}`,
      after: { rate, asOf: asOfRaw },
    })

    revalidatePath('/admin/settings')
    return { ok: true, message: `1 USD = ${rate} GHS from ${asOfRaw}.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save.' }
  }
}

/**
 * Change the cancellation policy guests are shown and held to.
 *
 * It applies to cancellations from now on, including bookings already made:
 * the policy page and the checkout say so. Every change is in the audit log
 * with the previous terms, so what a guest was shown on a given day can
 * always be established.
 */
export async function setCancellationPolicyAction(formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requirePermission('settings:write')

    const whole = (name: string) => {
      const raw = String(formData.get(name) ?? '').trim()
      return /^\d{1,3}$/.test(raw) ? Number(raw) : NaN
    }
    const fullRefundDays = whole('fullRefundDays')
    const partialRefundDays = whole('partialRefundDays')
    const partialPercent = whole('partialPercent')

    if (!(fullRefundDays >= 0 && fullRefundDays <= 90)) {
      return { ok: false, error: 'Full refund: enter a number of days from 0 to 90.' }
    }
    if (!(partialPercent >= 0 && partialPercent <= 100)) {
      return { ok: false, error: 'Part refund: enter a percentage from 0 to 100.' }
    }
    if (!(partialRefundDays >= 0 && partialRefundDays <= fullRefundDays)) {
      return { ok: false, error: 'The part refund must end on or after the full refund ends: use the same number of days or fewer.' }
    }

    const next = { fullRefundDays, partialRefundDays, partialPercent }
    const before = await db.setting.findUnique({ where: { key: CANCELLATION_KEY } })
    await db.setting.upsert({
      where: { key: CANCELLATION_KEY },
      update: { value: next },
      create: { key: CANCELLATION_KEY, value: next },
    })

    await logAudit({
      actor,
      action: 'settings.cancellation_policy_set',
      entityType: 'Setting',
      entityId: CANCELLATION_KEY,
      before: before?.value ?? DEFAULT_CANCELLATION,
      after: next,
    })

    revalidatePath('/', 'layout')
    return { ok: true, message: `Saved. Guests now see: ${cancellationSummary(next)}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save.' }
  }
}
