'use server'

/**
 * Booking mutations.
 *
 * Every action re-checks permission and property scope on the server. The
 * interface hides what a role cannot do, but hiding a button is decoration —
 * the check that matters is this one.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireActor } from '@/lib/session'
import { assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import {
  cancelReservation,
  checkInGuest,
  checkOutGuest,
  confirmReservation,
  createReservation,
} from '@/lib/short-stay/reservations'
import { quoteStay } from '@/lib/short-stay/pricing'
import { AvailabilityError } from '@/lib/short-stay/availability'
import { recordPayment } from '@/lib/core/ledger'
import { toMinor } from '@/lib/core/money'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

const createSchema = z.object({
  unitId: z.string().min(1, 'Choose a unit.'),
  guestName: z.string().min(2, 'Enter the guest name.'),
  guestPhone: z.string().optional(),
  guestEmail: z.string().email('That email does not look right.').optional().or(z.literal('')),
  checkIn: z.string().min(1, 'Choose an arrival date.'),
  checkOut: z.string().min(1, 'Choose a departure date.'),
  adults: z.coerce.number().int().min(1).max(20),
  children: z.coerce.number().int().min(0).max(20),
  source: z.enum([
    'DIRECT',
    'WEBSITE',
    'WHATSAPP',
    'INSTAGRAM',
    'AIRBNB',
    'BOOKING_COM',
    'WALK_IN',
    'REFERRAL',
    'OTHER',
  ]),
  notes: z.string().optional(),
  confirmNow: z.string().optional(),
  override: z.string().optional(),
})

export async function createBookingAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const actor = await requireActor()

  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }
  const input = parsed.data

  const unit = await db.unit.findUnique({
    where: { id: input.unitId },
    select: { propertyId: true, name: true },
  })
  if (!unit) return { ok: false, error: 'That unit no longer exists.' }

  try {
    assertCanOnProperty(actor, 'bookings:write', unit.propertyId)

    const { reservation } = await createReservation({
      unitId: input.unitId,
      guest: {
        name: input.guestName,
        phone: input.guestPhone || null,
        email: input.guestEmail || null,
      },
      checkIn: new Date(input.checkIn),
      checkOut: new Date(input.checkOut),
      adults: input.adults,
      children: input.children,
      source: input.source,
      internalNotes: input.notes || null,
      status: input.confirmNow === 'on' ? 'CONFIRMED' : 'PENDING',
      overrideViolations: input.override === 'on',
      actorUserId: actor.id,
    })

    await logAudit({
      actor,
      action: 'booking.created',
      entityType: 'Reservation',
      entityId: reservation.id,
      after: { code: reservation.code, unit: unit.name, total: reservation.totalMinor },
    })

    revalidatePath('/admin/calendar')
    revalidatePath('/admin/bookings')
    redirect(`/admin/bookings/${reservation.id}`)
  } catch (error) {
    // redirect() throws by design; let it through.
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error
    if (
      typeof error === 'object' &&
      error !== null &&
      'digest' in error &&
      String((error as { digest?: string }).digest).startsWith('NEXT_REDIRECT')
    ) {
      throw error
    }

    if (error instanceof AvailabilityError) {
      return { ok: false, error: error.message }
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not create the booking.',
    }
  }
}

async function loadForAction(reservationId: string, permission: 'bookings:write' | 'money:record') {
  const actor = await requireActor()
  const reservation = await db.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: { unit: { select: { propertyId: true } } },
  })
  assertCanOnProperty(actor, permission, reservation.unit.propertyId)
  return { actor, reservation }
}

export async function confirmBookingAction(reservationId: string): Promise<ActionResult> {
  try {
    const { actor } = await loadForAction(reservationId, 'bookings:write')
    await confirmReservation(reservationId, actor.id)
    await logAudit({
      actor,
      action: 'booking.confirmed',
      entityType: 'Reservation',
      entityId: reservationId,
    })
    revalidatePath(`/admin/bookings/${reservationId}`)
    revalidatePath('/admin/calendar')
    return { ok: true, message: 'Booking confirmed and the guest has been texted.' }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

export async function checkInAction(reservationId: string): Promise<ActionResult> {
  try {
    const { actor } = await loadForAction(reservationId, 'bookings:write')
    await checkInGuest(reservationId, actor.id)
    await logAudit({
      actor,
      action: 'booking.checked_in',
      entityType: 'Reservation',
      entityId: reservationId,
    })
    revalidatePath(`/admin/bookings/${reservationId}`)
    revalidatePath('/admin')
    return { ok: true, message: 'Guest checked in.' }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

export async function checkOutAction(
  reservationId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { actor } = await loadForAction(reservationId, 'bookings:write')
    const deduction = String(formData.get('deduction') ?? '').trim()
    const reason = String(formData.get('deductionReason') ?? '').trim()

    await checkOutGuest(reservationId, {
      releaseDeposit: true,
      deductionMinor: deduction ? toMinor(Number(deduction), 'USD') : 0,
      deductionReason: reason || undefined,
      actorUserId: actor.id,
    })

    await logAudit({
      actor,
      action: 'booking.checked_out',
      entityType: 'Reservation',
      entityId: reservationId,
      after: { deduction, reason },
    })

    revalidatePath(`/admin/bookings/${reservationId}`)
    revalidatePath('/admin/housekeeping')
    return { ok: true, message: 'Guest checked out and the changeover clean is queued.' }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

export async function cancelBookingAction(
  reservationId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { actor } = await loadForAction(reservationId, 'bookings:write')
    const reason = String(formData.get('reason') ?? '').trim()
    if (!reason) return { ok: false, error: 'Give a reason for the cancellation.' }

    await cancelReservation(reservationId, { reason, actorUserId: actor.id })

    await logAudit({
      actor,
      action: 'booking.cancelled',
      entityType: 'Reservation',
      entityId: reservationId,
      after: { reason },
    })

    revalidatePath(`/admin/bookings/${reservationId}`)
    revalidatePath('/admin/calendar')
    return { ok: true, message: 'Booking cancelled and its charges reversed.' }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/**
 * Take a payment against a booking. Used at the desk for cash and for card
 * machines settled outside the gateway.
 */
export async function takePaymentAction(
  reservationId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { actor, reservation } = await loadForAction(reservationId, 'money:record')

    const amount = Number(String(formData.get('amount') ?? ''))
    const channel = String(formData.get('channel') ?? 'CASH') as 'CASH' | 'MOMO_MTN' | 'CARD'
    const reference = String(formData.get('reference') ?? '').trim()

    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Enter the amount received.' }
    }

    const { payment } = await recordPayment({
      propertyId: reservation.unit.propertyId,
      partyId: reservation.guestPartyId,
      amountMinor: toMinor(amount, reservation.currency),
      currency: reservation.currency,
      channel,
      reference: reference || null,
      recordedById: actor.id,
      status: 'CONFIRMED',
    })

    await logAudit({
      actor,
      action: 'payment.recorded',
      entityType: 'Payment',
      entityId: payment.id,
      after: { receipt: payment.receiptNumber, amount, channel },
    })

    revalidatePath(`/admin/bookings/${reservationId}`)
    revalidatePath('/admin/money')
    return { ok: true, message: `Payment recorded. Receipt ${payment.receiptNumber}.` }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/** Live quote for the booking form, so the price updates as dates change. */
export async function quoteAction(
  unitId: string,
  checkIn: string,
  checkOut: string,
  guests: number
) {
  await requireActor()
  if (!unitId || !checkIn || !checkOut) return null

  try {
    const quote = await quoteStay(unitId, {
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      guests,
    })
    return {
      nights: quote.nights,
      currency: quote.currency,
      accommodationMinor: quote.accommodationMinor,
      cleaningFeeMinor: quote.cleaningFeeMinor,
      totalMinor: quote.totalMinor,
      violations: quote.violations,
    }
  } catch {
    return null
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}
