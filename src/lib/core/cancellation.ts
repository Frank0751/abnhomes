/**
 * The cancellation policy, as arithmetic.
 *
 * One rule, three tiers: a full refund up to N days before arrival, a part
 * refund up to M days before, nothing after. Kept free of the database so it
 * can be tested, and so the room page, the checkout, the policy page and the
 * guest's own "cancel" button cannot drift apart: they all ask this file.
 *
 * Days are whole calendar days before the check-in DATE. "Until 7 days
 * before" a stay starting on the 20th means any time up to the end of the 13th.
 */

export type CancellationPolicy = {
  /** Cancel at least this many days before arrival for a full refund. */
  fullRefundDays: number
  /** Cancel at least this many days before arrival for the part refund. */
  partialRefundDays: number
  /** The part refund, as a percentage of what was paid. 0 switches the tier off. */
  partialPercent: number
}

/** What the site has always told guests. Changed in the admin, under Settings. */
export const DEFAULT_CANCELLATION: CancellationPolicy = {
  fullRefundDays: 7,
  partialRefundDays: 2,
  partialPercent: 50,
}

const DAY = 24 * 60 * 60 * 1000

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Coerce whatever was stored into a usable policy, or fall back to the default. */
export function normalisePolicy(raw: unknown): CancellationPolicy {
  if (!raw || typeof raw !== 'object') return DEFAULT_CANCELLATION
  const r = raw as Record<string, unknown>
  const int = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null
  const full = int(r.fullRefundDays, 0, 90)
  const part = int(r.partialRefundDays, 0, 90)
  const pct = int(r.partialPercent, 0, 100)
  if (full === null || part === null || pct === null || part > full) return DEFAULT_CANCELLATION
  return { fullRefundDays: full, partialRefundDays: part, partialPercent: pct }
}

/** True when the policy has a middle tier at all. */
export function hasPartialTier(p: CancellationPolicy): boolean {
  return p.partialPercent > 0 && p.partialPercent < 100 && p.partialRefundDays < p.fullRefundDays
}

/** The last day each tier applies for a stay arriving on `checkIn`. */
export function cancellationDates(p: CancellationPolicy, checkIn: Date): { fullUntil: Date; partialUntil: Date | null } {
  const arrival = utcDay(checkIn)
  return {
    fullUntil: new Date(arrival - p.fullRefundDays * DAY),
    partialUntil: hasPartialTier(p) ? new Date(arrival - p.partialRefundDays * DAY) : null,
  }
}

/** The percentage of what was paid that comes back if the guest cancels `now`. */
export function refundPercent(p: CancellationPolicy, checkIn: Date, now: Date = new Date()): number {
  const daysBefore = Math.floor((utcDay(checkIn) - utcDay(now)) / DAY)
  if (daysBefore >= p.fullRefundDays) return 100
  if (hasPartialTier(p) && daysBefore >= p.partialRefundDays) return p.partialPercent
  return 0
}

const days = (n: number) => (n === 1 ? '24 hours' : n === 2 ? '48 hours' : `${n} days`)

/** One sentence, the same everywhere it is shown. */
export function cancellationSummary(p: CancellationPolicy): string {
  const full =
    p.fullRefundDays === 0
      ? 'Free cancellation up to the day of arrival'
      : `Free cancellation until ${days(p.fullRefundDays)} before arrival`
  if (!hasPartialTier(p)) {
    return p.fullRefundDays === 0 ? `${full}.` : `${full}, non-refundable after.`
  }
  const part =
    p.partialRefundDays === 0
      ? `${p.partialPercent}% refund up to the day of arrival`
      : `${p.partialPercent}% refund until ${days(p.partialRefundDays)} before, non-refundable after`
  return `${full}, ${part}.`
}
