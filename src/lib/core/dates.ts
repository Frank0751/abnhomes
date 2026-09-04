/**
 * Calendar arithmetic.
 *
 * The single most important rule in this file: a stay occupies the half-open
 * interval [checkIn, checkOut). A guest leaving on the 14th frees the 14th for
 * the next arrival. Treating it as closed loses one sellable night per booking,
 * which on a small portfolio is a meaningful amount of money per year.
 */

import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  startOfMonth,
} from 'date-fns'

export { addDays, addMonths, differenceInCalendarDays, isAfter, isBefore }

/**
 * Strip the time component, anchoring to UTC midnight. Ghana is UTC+0 with no
 * daylight saving, so this is exact here — but being explicit keeps the
 * calendar correct if the server runs in another timezone, which it will.
 */
export function dateOnly(input: Date | string): Date {
  const d = typeof input === 'string' ? new Date(input) : input
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function today(): Date {
  return dateOnly(new Date())
}

export function isSameDay(a: Date, b: Date): boolean {
  return dateOnly(a).getTime() === dateOnly(b).getTime()
}

/** Number of nights in [checkIn, checkOut). */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.max(0, differenceInCalendarDays(dateOnly(checkOut), dateOnly(checkIn)))
}

/** Every night actually slept in, so the checkout date is excluded. */
export function eachNight(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = []
  let cursor = dateOnly(checkIn)
  const end = dateOnly(checkOut)
  while (cursor < end) {
    nights.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return nights
}

/**
 * Half-open overlap test. Two stays collide only if one starts strictly
 * before the other ends. Back-to-back bookings do not overlap.
 */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return dateOnly(aStart) < dateOnly(bEnd) && dateOnly(bStart) < dateOnly(aEnd)
}

export function isWithinRange(day: Date, start: Date, end: Date): boolean {
  const d = dateOnly(day)
  return d >= dateOnly(start) && d < dateOnly(end)
}

export type Period = { start: Date; end: Date }

/** Calendar month as a half-open period: [1st, 1st of next month). */
export function monthPeriod(year: number, month: number): Period {
  const start = new Date(Date.UTC(year, month, 1))
  return { start, end: new Date(Date.UTC(year, month + 1, 1)) }
}

export function currentMonthPeriod(): Period {
  const now = new Date()
  return monthPeriod(now.getUTCFullYear(), now.getUTCMonth())
}

export function monthPeriodOf(date: Date): Period {
  return monthPeriod(date.getUTCFullYear(), date.getUTCMonth())
}

/**
 * The date rent falls due in a given month, clamped so that a lease with a
 * due day of 31 still bills correctly in February.
 */
export function dueDateInMonth(year: number, month: number, dueDay: number): Date {
  const lastDay = endOfMonth(new Date(Date.UTC(year, month, 1))).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(dueDay, lastDay)))
}

/** Billing periods covered by a lease term, for the rent run. */
export function billingPeriods(
  start: Date,
  end: Date,
  monthsPerCycle: number
): Period[] {
  const periods: Period[] = []
  let cursor = startOfMonth(dateOnly(start))
  const limit = dateOnly(end)

  while (cursor < limit) {
    const next = addMonths(cursor, monthsPerCycle)
    periods.push({ start: cursor, end: next })
    cursor = next
  }
  return periods
}

export function monthsPerCycle(
  cycle: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'
): number {
  switch (cycle) {
    case 'MONTHLY':
      return 1
    case 'QUARTERLY':
      return 3
    case 'SEMI_ANNUAL':
      return 6
    case 'ANNUAL':
      return 12
  }
}

/** Whole days a charge is past due. Negative means not yet due. */
export function daysOverdue(dueDate: Date, asOf: Date = new Date()): number {
  return differenceInCalendarDays(dateOnly(asOf), dateOnly(dueDate))
}

export type AgeBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'

export function ageBucket(dueDate: Date, asOf: Date = new Date()): AgeBucket {
  const days = daysOverdue(dueDate, asOf)
  if (days <= 0) return 'current'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

// Display helpers. Ghanaian convention is day-first.
export const formatDate = (d: Date | string) => format(dateOnly(d), 'd MMM yyyy')
export const formatDateShort = (d: Date | string) => format(dateOnly(d), 'd MMM')
export const formatDateTime = (d: Date | string) =>
  format(typeof d === 'string' ? new Date(d) : d, 'd MMM yyyy, HH:mm')
export const formatMonthYear = (d: Date | string) => format(dateOnly(d), 'MMMM yyyy')
export const toISODate = (d: Date) => format(dateOnly(d), 'yyyy-MM-dd')
