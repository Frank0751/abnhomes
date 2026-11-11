'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { startPayment } from '@/lib/payments/gateway'
import { isChannelAvailable } from '@/lib/payments/gateway'
import { normalisePhone } from '@/lib/core/phone'

export type PayResult = { ok: false; error: string } | undefined

const schema = z.object({
  reservationId: z.string().min(1),
  channel: z.enum(['MOMO_MTN', 'MOMO_TELECEL', 'MOMO_AIRTELTIGO', 'CARD', 'BANK_TRANSFER']),
  mode: z.enum(['FULL', 'DEPOSIT']),
  phone: z.string().optional(),
})

/**
 * Start a guest payment for a reservation. The reservation code in the URL is
 * the capability: unguessable, single-purpose. Amounts are recomputed from the
 * reservation and the payments already settled against it — never trusted
 * from the form.
 */
export async function startReservationPaymentAction(
  _prev: PayResult,
  formData: FormData
): Promise<PayResult> {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'Choose how you would like to pay.' }
  const { reservationId, channel, mode } = parsed.data

  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    include: { chargeRows: { select: { id: true } }, unit: { select: { propertyId: true, name: true } } },
  })
  if (!reservation) return { ok: false, error: 'Booking not found.' }
  if (['CANCELLED', 'CHECKED_OUT'].includes(reservation.status)) {
    return { ok: false, error: 'This booking can no longer be paid online.' }
  }
  if (!isChannelAvailable(channel)) {
    return { ok: false, error: 'That payment method is not available right now — please pick another.' }
  }

  const paid = await db.allocation.aggregate({
    where: { chargeId: { in: reservation.chargeRows.map((c) => c.id) }, payment: { status: 'CONFIRMED' } },
    _sum: { amountMinor: true },
  })
  const paidMinor = paid._sum.amountMinor ?? 0
  const balanceMinor = Math.max(reservation.totalMinor - paidMinor, 0)
  if (balanceMinor <= 0) {
    return { ok: false, error: 'This booking is already paid in full — see your receipt in the portal.' }
  }

  const amountMinor = mode === 'DEPOSIT' ? Math.min(reservation.depositMinor || balanceMinor, balanceMinor) : balanceMinor

  const phone = parsed.data.phone ? normalisePhone(parsed.data.phone) : null
  if (channel.startsWith('MOMO') && !phone) {
    return { ok: false, error: 'Enter the mobile money number to charge.' }
  }

  let redirectUrl: string
  try {
    const payment = await startPayment({
      propertyId: reservation.unit.propertyId,
      partyId: reservation.guestPartyId,
      amountMinor,
      currency: reservation.currency,
      channel,
      phone,
      metadata: {
        purpose: `Booking ${reservation.code}`,
        reservationId: reservation.id,
        mode,
      },
    })
    redirectUrl = payment.redirectUrl
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Payment could not be started. Please call 054 170 4048.',
    }
  }

  redirect(redirectUrl)
}
