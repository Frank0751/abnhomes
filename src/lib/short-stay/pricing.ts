/**
 * Nightly pricing.
 *
 * A quote is built night by night rather than as one multiplication, because
 * a stay that crosses into Christmas week must pick up the Christmas rate for
 * those nights only. Every quote returns its own breakdown, so the guest and
 * the front desk are looking at the same arithmetic.
 */

import type { Currency, RatePlan, Unit } from '@prisma/client'
import { db } from '@/lib/db'
import { dateOnly, eachNight, nightsBetween, toISODate } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'

export type NightLine = {
  date: string
  rateMinor: number
  planName: string
}

export type Quote = {
  unitId: string
  unitName: string
  checkIn: Date
  checkOut: Date
  nights: number
  currency: Currency
  nightLines: NightLine[]
  accommodationMinor: number
  cleaningFeeMinor: number
  discountMinor: number
  totalMinor: number
  depositMinor: number
  averageNightlyMinor: number
  /** Populated when the stay breaks a rule; the caller decides how strict to be. */
  violations: string[]
}

/**
 * The plan that applies to a given night: active, in window, highest priority.
 * Ties break towards the most recently created plan.
 */
export function planForNight(plans: RatePlan[], night: Date): RatePlan | null {
  const candidates = plans.filter((plan) => {
    if (!plan.active) return false
    if (plan.startDate && dateOnly(plan.startDate) > night) return false
    if (plan.endDate && dateOnly(plan.endDate) <= night) return false
    return true
  })

  if (candidates.length === 0) return null

  return candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return b.createdAt.getTime() - a.createdAt.getTime()
  })[0]
}

type QuoteArgs = {
  checkIn: Date
  checkOut: Date
  guests?: number
  /** Manual reduction, applied after accommodation and fees. */
  discountMinor?: number
}

/**
 * Price a stay from data already loaded. Kept pure so the booking form can
 * re-quote as the operator drags dates without hitting the database.
 */
export function quoteFromUnit(
  unit: Pick<
    Unit,
    'id' | 'name' | 'currency' | 'baseNightlyMinor' | 'maxGuests'
  > & { ratePlans: RatePlan[] },
  args: QuoteArgs
): Quote {
  const checkIn = dateOnly(args.checkIn)
  const checkOut = dateOnly(args.checkOut)
  const nights = nightsBetween(checkIn, checkOut)
  const violations: string[] = []

  if (nights <= 0) {
    violations.push('Check-out must be after check-in.')
  }

  const nightLines: NightLine[] = []
  let accommodationMinor = 0
  let cleaningFeeMinor = 0
  let currency: Currency = unit.currency
  let minNightsRequired = 1

  for (const night of eachNight(checkIn, checkOut)) {
    const plan = planForNight(unit.ratePlans, night)

    if (plan) {
      currency = plan.currency
      minNightsRequired = Math.max(minNightsRequired, plan.minNights)
      cleaningFeeMinor = Math.max(cleaningFeeMinor, plan.cleaningFeeMinor)
      nightLines.push({ date: toISODate(night), rateMinor: plan.nightlyMinor, planName: plan.name })
      accommodationMinor += plan.nightlyMinor
    } else if (unit.baseNightlyMinor != null) {
      nightLines.push({
        date: toISODate(night),
        rateMinor: unit.baseNightlyMinor,
        planName: 'Standard rate',
      })
      accommodationMinor += unit.baseNightlyMinor
    } else {
      violations.push(`No rate is set for ${toISODate(night)}.`)
    }
  }

  // Weekly rates, where they beat the nightly total, applied per whole week.
  const weeklyPlan = unit.ratePlans.find((p) => p.active && p.weeklyMinor != null)
  if (weeklyPlan?.weeklyMinor && nights >= 7) {
    const wholeWeeks = Math.floor(nights / 7)
    const remainderNights = nights % 7
    const remainderMinor = nightLines
      .slice(wholeWeeks * 7)
      .reduce((sum, line) => sum + line.rateMinor, 0)
    const weeklyTotal = wholeWeeks * weeklyPlan.weeklyMinor + remainderMinor

    if (weeklyTotal < accommodationMinor) {
      accommodationMinor = weeklyTotal
      violations.push(
        `Weekly rate applied: ${wholeWeeks} week${wholeWeeks > 1 ? 's' : ''} at ${formatMinor(weeklyPlan.weeklyMinor, currency)}${remainderNights > 0 ? ` plus ${remainderNights} night${remainderNights > 1 ? 's' : ''}` : ''}.`
      )
    }
  }

  if (nights > 0 && nights < minNightsRequired) {
    violations.push(`This unit has a ${minNightsRequired}-night minimum stay.`)
  }

  if (args.guests && args.guests > unit.maxGuests) {
    violations.push(`This unit sleeps ${unit.maxGuests}; ${args.guests} guests were requested.`)
  }

  const discountMinor = args.discountMinor ?? 0
  const totalMinor = Math.max(0, accommodationMinor + cleaningFeeMinor - discountMinor)

  return {
    unitId: unit.id,
    unitName: unit.name,
    checkIn,
    checkOut,
    nights,
    currency,
    nightLines,
    accommodationMinor,
    cleaningFeeMinor,
    discountMinor,
    totalMinor,
    // Deposit convention: one night, refundable, released after checkout.
    depositMinor: nights > 0 ? Math.round(accommodationMinor / nights) : 0,
    averageNightlyMinor: nights > 0 ? Math.round(accommodationMinor / nights) : 0,
    violations,
  }
}

/** Load the unit with its plans and price the stay. */
export async function quoteStay(
  unitId: string,
  args: QuoteArgs
): Promise<Quote> {
  const unit = await db.unit.findUniqueOrThrow({
    where: { id: unitId },
    include: { ratePlans: { where: { active: true } } },
  })
  return quoteFromUnit(unit, args)
}

/**
 * Average daily rate: accommodation revenue over nights sold.
 * Reported alongside occupancy, because either alone can flatter a bad month.
 */
export async function averageDailyRate(args: {
  from: Date
  to: Date
  propertyId?: string
  currency?: Currency
}): Promise<{ adrMinor: number; nightsSold: number; revenueMinor: number; currency: Currency }> {
  const currency = args.currency ?? 'USD'

  const reservations = await db.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      currency,
      checkIn: { lt: dateOnly(args.to) },
      checkOut: { gt: dateOnly(args.from) },
      ...(args.propertyId ? { unit: { propertyId: args.propertyId } } : {}),
    },
    select: { nights: true, totalMinor: true, cleaningFeeMinor: true },
  })

  const nightsSold = reservations.reduce((s, r) => s + r.nights, 0)
  const revenueMinor = reservations.reduce(
    (s, r) => s + (r.totalMinor - r.cleaningFeeMinor),
    0
  )

  return {
    adrMinor: nightsSold === 0 ? 0 : Math.round(revenueMinor / nightsSold),
    nightsSold,
    revenueMinor,
    currency,
  }
}

/**
 * Revenue per available night — occupancy and rate in one number, and the
 * figure that actually tells you whether a pricing change worked.
 */
export function revPar(adrMinor: number, occupancy: number): number {
  return Math.round(adrMinor * occupancy)
}
