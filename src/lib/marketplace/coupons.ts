/**
 * Coupons — the validation half of promotions.
 *
 * A coupon that quietly applies when it should not is a discount nobody
 * approved, so every rule is checked here and nothing is trusted from the
 * browser. Redemption records are created only when a booking is made.
 */

import type { Coupon, Currency } from '@prisma/client'
import { db } from '@/lib/db'
import { allocateEvenly } from '@/lib/core/money'

export type CouponCheck =
  | { ok: true; coupon: Coupon; discountMinor: number; label: string }
  | { ok: false; error: string }

export async function validateCoupon(
  code: string,
  args: {
    propertyId?: string | null
    partyId?: string | null
    subtotalMinor: number
    currency: Currency
  }
): Promise<CouponCheck> {
  const normalised = code.trim().toUpperCase()
  if (!normalised) return { ok: false, error: 'Enter a promo code.' }

  const coupon = await db.coupon.findUnique({ where: { code: normalised } })
  if (!coupon || !coupon.active) return { ok: false, error: 'That code is not recognised.' }

  const now = new Date()
  if (coupon.startsAt && now < coupon.startsAt) return { ok: false, error: 'That code is not active yet.' }
  if (coupon.endsAt && now > coupon.endsAt) return { ok: false, error: 'That code has expired.' }

  if (coupon.propertyId && args.propertyId && coupon.propertyId !== args.propertyId) {
    return { ok: false, error: 'That code does not apply to this home.' }
  }

  if (coupon.currency !== args.currency) {
    return { ok: false, error: `That code only applies to ${coupon.currency} bookings.` }
  }

  if (args.subtotalMinor < coupon.minSpendMinor) {
    return { ok: false, error: `That code needs a stay of at least ${coupon.minSpendMinor / 100} ${coupon.currency}.` }
  }

  if (coupon.maxRedemptions !== null) {
    const total = await db.couponRedemption.count({ where: { couponId: coupon.id } })
    if (total >= coupon.maxRedemptions) return { ok: false, error: 'That code has been fully redeemed.' }
  }

  if (args.partyId && coupon.perPartyLimit > 0) {
    const mine = await db.couponRedemption.count({
      where: { couponId: coupon.id, guestPartyId: args.partyId },
    })
    if (mine >= coupon.perPartyLimit) {
      return { ok: false, error: 'You have already used that code.' }
    }
  }

  if (coupon.firstBookingOnly && args.partyId) {
    const completed = await db.reservation.count({
      where: { guestPartyId: args.partyId, status: { in: ['CHECKED_OUT', 'CONFIRMED'] } },
    })
    if (completed > 0) return { ok: false, error: 'That code is for first-time guests.' }
  }

  return {
    ok: true,
    coupon,
    discountMinor: computeDiscount(coupon, args.subtotalMinor),
    label: describeCoupon(coupon),
  }
}

export function computeDiscount(coupon: Coupon, subtotalMinor: number): number {
  const raw =
    coupon.kind === 'PERCENT'
      ? Math.round((subtotalMinor * coupon.value) / 10_000)
      : Math.min(coupon.value, subtotalMinor)
  const capped = coupon.maxDiscountMinor ? Math.min(raw, coupon.maxDiscountMinor) : raw
  return Math.max(0, Math.min(capped, subtotalMinor))
}

export function describeCoupon(coupon: Coupon): string {
  return coupon.kind === 'PERCENT'
    ? `${coupon.value / 100}% off`
    : `${coupon.value / 100} ${coupon.currency} off`
}

/** Record that a coupon was used by a booking. Called inside booking creation. */
export async function recordRedemption(args: {
  couponId: string
  reservationId: string
  guestPartyId: string
  amountMinor: number
}): Promise<void> {
  await db.couponRedemption.upsert({
    where: { couponId_reservationId: { couponId: args.couponId, reservationId: args.reservationId } },
    create: {
      couponId: args.couponId,
      reservationId: args.reservationId,
      guestPartyId: args.guestPartyId,
      amountMinor: args.amountMinor,
    },
    update: { amountMinor: args.amountMinor },
  })
}

// allocateEvenly is re-exported for the checkout's split-discount display.
export { allocateEvenly }
