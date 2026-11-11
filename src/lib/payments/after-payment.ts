/**
 * What happens after money is recorded, whichever rail it arrived on.
 *
 * Kept out of the ledger so the money code stays pure: this module reads the
 * freshly recorded payment and (1) sends the receipt on every channel the
 * guest has, and (2) confirms the booking when payment justifies it — the
 * instant-book behaviour the marketplace expects.
 *
 * A webhook and a staff confirm button can both land here for the same
 * payment; every step is idempotent (message dedupe on entity, and the
 * confirm path only fires while the reservation is still PENDING).
 */

import { db } from '@/lib/db'
import { notifyPaymentReceived } from '@/lib/notify'
import { confirmReservation } from '@/lib/short-stay/reservations'

export async function afterPaymentRecorded(paymentId: string): Promise<void> {
  try {
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        allocations: { include: { charge: { include: { property: { select: { name: true } } } } } },
      },
    })
    if (!payment) return

    const propertyName = payment.allocations[0]?.charge.property.name ?? null

    await notifyPaymentReceived({
      partyId: payment.partyId,
      paymentId: payment.id,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      receiptNumber: payment.receiptNumber,
      channel: payment.channel,
      propertyName,
    })

    // Auto-confirm: find the reservation this payment settled against.
    const reservationId = payment.allocations.map((a) => a.charge.reservationId).find(Boolean)
    if (!reservationId) return

    const reservation = await db.reservation.findUnique({
      where: { id: reservationId },
      include: { unit: { select: { instantBook: true } }, chargeRows: { select: { id: true } } },
    })
    if (!reservation || reservation.status !== 'PENDING') return

    const paid = await db.allocation.aggregate({
      where: {
        chargeId: { in: reservation.chargeRows.map((c) => c.id) },
        payment: { status: 'CONFIRMED' },
      },
      _sum: { amountMinor: true },
    })
    const paidMinor = paid._sum.amountMinor ?? 0
    if (paidMinor <= 0) return

    const fullyPaid = paidMinor >= reservation.totalMinor
    const instantEligible = reservation.unit.instantBook && paidMinor >= Math.max(reservation.depositMinor, 1)

    if (fullyPaid || instantEligible) {
      if (instantEligible && !fullyPaid) {
        await db.reservation.update({ where: { id: reservation.id }, data: { instantBooked: true } })
      }
      await confirmReservation(reservation.id)
    }
  } catch (error) {
    // A receipt or confirmation problem must never fail the payment itself.
    console.error('[after-payment] post-payment handling failed', error)
  }
}
