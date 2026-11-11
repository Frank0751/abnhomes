'use server'

/**
 * Public booking.
 *
 * The only unauthenticated write in the system, so it is the most careful.
 * Nothing the browser sends is trusted: the price is recomputed from the rate
 * plans, availability is re-checked, and the unit must actually be published.
 * A visitor cannot name their own price by editing a form field.
 */

import { z } from 'zod'
import { db } from '@/lib/db'
import { createReservation } from '@/lib/short-stay/reservations'
import { quoteFromUnit } from '@/lib/short-stay/pricing'
import { AvailabilityError } from '@/lib/short-stay/availability'
import { validateCoupon } from '@/lib/marketplace/coupons'
import { notifyBookingRequested } from '@/lib/notify'
import { normalisePhone } from '@/lib/core/phone'
import { logAudit } from '@/lib/audit'

export type BookingResult =
  | {
      ok: true
      code: string
      reservationId: string
      payUrl: string
      totalMinor: number
      currency: string
    }
  | { ok: false; error: string }

const schema = z.object({
  unitId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  guests: z.coerce.number().int().min(1).max(12),
  name: z.string().min(2, 'Please give your full name.'),
  phone: z.string().min(6, 'We need a phone number to confirm your booking.'),
  email: z.string().email('That email does not look right.'),
  arrivalTime: z.string().max(30).optional(),
  purpose: z.enum(['LEISURE', 'BUSINESS', 'RELOCATION']).optional(),
  addOns: z.string().optional(), // JSON: [{id, qty}]
  couponCode: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
  consentRules: z.literal('on', { message: 'Please accept the house rules to continue.' }),
  consentTerms: z.literal('on', { message: 'Please accept the terms to continue.' }),
})

export async function requestBookingAction(
  _prev: BookingResult | null,
  formData: FormData
): Promise<BookingResult> {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }
  const input = parsed.data

  const phone = normalisePhone(input.phone)
  if (!phone) {
    return { ok: false, error: 'That phone number does not look right. Include the country code if you are abroad.' }
  }

  // The unit must be one we actually advertise. Without this, a visitor could
  // book an off-market unit by guessing its id.
  const unit = await db.unit.findFirst({
    where: {
      id: input.unitId,
      published: true,
      property: { published: true },
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      status: { notIn: ['OFF_MARKET', 'MAINTENANCE'] },
    },
    select: { id: true, propertyId: true, name: true },
  })

  if (!unit) {
    return { ok: false, error: 'That apartment is not available to book online. Please call us.' }
  }

  try {
    // Extras and promo are parsed here but validated inside the booking
    // transaction, so a double submission can never double-apply them.
    const addOnSelections: { addOnId: string; qty: number }[] = []
    if (input.addOns) {
      try {
        const parsedAddOns = JSON.parse(input.addOns) as { id: string; qty?: number }[]
        for (const a of Array.isArray(parsedAddOns) ? parsedAddOns : []) {
          if (a && typeof a.id === 'string') {
            addOnSelections.push({ addOnId: a.id, qty: Math.max(1, Math.min(Number(a.qty ?? 1) || 1, 5)) })
          }
        }
      } catch {
        // malformed payload — ignore, the rest of the booking stands
      }
    }

    const { reservation } = await createReservation({
      unitId: unit.id,
      guest: { name: input.name, phone, email: input.email },
      checkIn: new Date(input.checkIn),
      checkOut: new Date(input.checkOut),
      adults: input.guests,
      source: 'WEBSITE',
      guestNotes: input.notes || null,
      addOns: addOnSelections,
      couponCode: input.couponCode?.trim().toUpperCase() || undefined,
      arrivalTime: input.arrivalTime || null,
      purpose: input.purpose ?? null,
      // An unpaid web request holds the dates for 48 hours, then the sweeper
      // releases them.
      expiresAt: new Date(Date.now() + 48 * 3600_000),
      // Held, not confirmed. A booking becomes real when it is paid for or
      // when the office confirms it, never on the strength of a web form.
      status: 'PENDING',
    })

    await logAudit({
      action: 'booking.requested.public',
      entityType: 'Reservation',
      entityId: reservation.id,
      actorLabel: `Website — ${input.name}`,
      after: { code: reservation.code, unit: unit.name },
    })

    // Tell the guest their request landed — email if we have an address, SMS
    // either way — and give the team an in-app nudge. Never blocks the booking.
    try {
      await notifyBookingRequested(reservation.id)
    } catch (notifyError) {
      console.error('[booking] notification failed', notifyError)
    }

    // The guest pays on their own page — channel of their choice, deposit or
    // full amount — so we always hand back the payment link.
    return {
      ok: true,
      code: reservation.code,
      reservationId: reservation.id,
      payUrl: `/pay/${reservation.code}`,
      totalMinor: reservation.totalMinor,
      currency: reservation.currency,
    }
  } catch (error) {
    if (error instanceof AvailabilityError) {
      return {
        ok: false,
        error: 'Those dates have just been taken. Please search again — we are sorry.',
      }
    }
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please call us on 054 170 4048.',
    }
  }
}

/**
 * Live promo-code check for the checkout form. The booking action re-validates
 * the same code inside the transaction — this preview is convenience, not
 * trust.
 */
export async function applyCouponAction(args: {
  code: string
  unitId: string
  checkIn: string
  checkOut: string
  guests: number
}): Promise<{ ok: true; discountMinor: number; label: string } | { ok: false; error: string }> {
  const unit = await db.unit.findFirst({
    where: { id: args.unitId, published: true, property: { published: true } },
    include: { ratePlans: { where: { active: true } } },
  })
  if (!unit) return { ok: false, error: 'That home is no longer available.' }

  const checkIn = new Date(args.checkIn)
  const checkOut = new Date(args.checkOut)
  if (checkOut <= checkIn) return { ok: false, error: 'Check your dates first.' }

  const quote = quoteFromUnit(unit as never, { checkIn, checkOut, guests: args.guests })
  if (quote.nights <= 0) return { ok: false, error: 'Check your dates first.' }

  const result = await validateCoupon(args.code, {
    propertyId: unit.propertyId,
    subtotalMinor: quote.totalMinor,
    currency: quote.currency,
  })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, discountMinor: result.discountMinor, label: result.label }
}
