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
import { AvailabilityError } from '@/lib/short-stay/availability'
import { startPayment } from '@/lib/payments/gateway'
import { normalisePhone } from '@/lib/core/phone'
import { logAudit } from '@/lib/audit'

export type BookingResult =
  | { ok: true; code: string; reservationId: string; payUrl: string | null }
  | { ok: false; error: string }

const schema = z.object({
  unitId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  guests: z.coerce.number().int().min(1).max(12),
  name: z.string().min(2, 'Please give your full name.'),
  phone: z.string().min(6, 'We need a phone number to confirm your booking.'),
  email: z.string().email('That email does not look right.').optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
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
    const { reservation } = await createReservation({
      unitId: unit.id,
      guest: { name: input.name, phone, email: input.email || null },
      checkIn: new Date(input.checkIn),
      checkOut: new Date(input.checkOut),
      adults: input.guests,
      source: 'WEBSITE',
      guestNotes: input.notes || null,
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

    // Offer payment straight away. If the gateway is not configured this
    // returns null and the guest is simply asked to expect a call.
    let payUrl: string | null = null
    try {
      const payment = await startPayment({
        propertyId: unit.propertyId,
        partyId: reservation.guestPartyId,
        amountMinor: reservation.totalMinor,
        currency: reservation.currency,
        channel: 'CARD',
        phone,
        email: input.email || null,
        metadata: { purpose: `Booking ${reservation.code}`, reservationId: reservation.id },
      })
      payUrl = payment.simulated ? null : payment.redirectUrl
    } catch {
      // A gateway problem must not lose the booking — the office can take
      // payment another way.
      payUrl = null
    }

    return { ok: true, code: reservation.code, reservationId: reservation.id, payUrl }
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
