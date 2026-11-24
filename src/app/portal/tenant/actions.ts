'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireParty } from '@/lib/session'
import { createTicket } from '@/lib/operations/tickets'
import { startPayment } from '@/lib/payments/gateway'
import { cancelReservation } from '@/lib/short-stay/reservations'
import { getCancellationPolicy } from '@/lib/policies'
import { refundPercent } from '@/lib/core/cancellation'
import { dateOnly } from '@/lib/core/dates'
import type { Currency, PaymentChannel } from '@prisma/client'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/**
 * A tenant reporting a fault.
 *
 * Access is checked against their own lease, not against a property id they
 * sent us — otherwise anyone could raise tickets on any building.
 */
export async function reportFaultAction(formData: FormData): Promise<ActionResult> {
  try {
    const { partyId } = await requireParty()

    const unitId = String(formData.get('unitId') ?? '')
    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const category = String(formData.get('category') ?? 'OTHER')
    const priority = String(formData.get('priority') ?? 'NORMAL') as
      | 'LOW'
      | 'NORMAL'
      | 'HIGH'
      | 'EMERGENCY'

    if (title.length < 3) return { ok: false, error: 'Give the problem a short title.' }
    if (description.length < 5) return { ok: false, error: 'Tell us a little more.' }

    const lease = await db.lease.findFirst({
      where: { tenantPartyId: partyId, unitId, status: 'ACTIVE' },
      include: { unit: { select: { propertyId: true } } },
    })

    if (!lease) {
      return { ok: false, error: 'We could not match that unit to your tenancy.' }
    }

    const ticket = await createTicket({
      propertyId: lease.unit.propertyId,
      unitId,
      title,
      description,
      category: category as never,
      priority,
      reporterPartyId: partyId,
    })

    revalidatePath('/portal/tenant')
    return {
      ok: true,
      message: `Logged as ${ticket.code}. We will text you as it progresses.`,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not report it.' }
  }
}

/** Start an online payment for whatever the tenant currently owes. */
export async function startTenantPaymentAction(
  amountMinor: number,
  channel: PaymentChannel
): Promise<{ ok: true; redirectUrl: string; simulated: boolean } | { ok: false; error: string }> {
  try {
    const { partyId } = await requireParty()

    let propertyId: string | null = null
    let currency: Currency = 'GHS'

    const lease = await db.lease.findFirst({
      where: { tenantPartyId: partyId, status: 'ACTIVE' },
      include: { unit: { select: { propertyId: true } } },
    })

    if (lease) {
      propertyId = lease.unit.propertyId
    } else {
      // Short-stay guests have no lease. Their booking charges carry the
      // property and currency, so pay against those instead.
      const charge = await db.charge.findFirst({
        where: { partyId, status: { in: ['OPEN', 'PART_PAID'] } },
        orderBy: { dueDate: 'asc' },
        select: { propertyId: true, currency: true },
      })
      if (!charge) return { ok: false, error: 'There is nothing to pay right now.' }
      propertyId = charge.propertyId
      currency = charge.currency
    }

    if (amountMinor <= 0) return { ok: false, error: 'There is nothing to pay.' }

    const result = await startPayment({
      propertyId,
      partyId,
      amountMinor,
      currency,
      channel,
      metadata: { purpose: 'Payment from the tenant portal' },
    })

    return { ok: true, redirectUrl: result.redirectUrl, simulated: result.simulated }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not start the payment.',
    }
  }
}

/**
 * A guest cancelling their own confirmed stay.
 *
 * The booking is found by the guest's own party, never by an id alone, so
 * nobody can cancel a stay that is not theirs. The refund share is worked out
 * here, at the moment of cancelling, from the policy in Settings — not taken
 * from the browser — and written into the cancellation so the office sees
 * exactly what is owed. Money is sent back by staff, who are alerted at once;
 * nothing is refunded automatically.
 */
export async function cancelMyStayAction(reservationId: string): Promise<ActionResult> {
  try {
    const { actor, partyId } = await requireParty()

    const stay = await db.reservation.findFirst({
      where: { id: reservationId, guestPartyId: partyId },
      select: { id: true, code: true, status: true, checkIn: true },
    })
    if (!stay) return { ok: false, error: 'That booking was not found on your account.' }
    if (stay.status !== 'CONFIRMED' && stay.status !== 'PENDING') {
      return { ok: false, error: 'This booking can no longer be cancelled online. Please call us on 054 170 4048.' }
    }
    if (dateOnly(stay.checkIn) <= dateOnly(new Date())) {
      return { ok: false, error: 'Your stay has started. Please call us on 054 170 4048 so we can help.' }
    }

    const policy = await getCancellationPolicy()
    const percent = refundPercent(policy, stay.checkIn)
    const refundLine =
      percent === 100
        ? 'Full refund of the amount paid is due under the cancellation policy.'
        : percent > 0
          ? `${percent}% of the amount paid is due as a refund under the cancellation policy.`
          : 'No refund is due under the cancellation policy.'

    await cancelReservation(stay.id, {
      reason: `Cancelled online by the guest. ${refundLine}`,
      actorUserId: actor.id,
    })

    revalidatePath('/portal/tenant')
    return {
      ok: true,
      message:
        percent > 0
          ? `Booking ${stay.code} is cancelled. ${percent === 100 ? 'A full refund' : `A ${percent}% refund`} will be sent to the way you paid; we start it within 2 working days.`
          : `Booking ${stay.code} is cancelled.`,
    }
  } catch (error) {
    console.error('[portal] guest cancellation failed', error)
    return { ok: false, error: 'We could not cancel that just now. Please call us on 054 170 4048.' }
  }
}
