'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireActor } from '@/lib/session'
import { assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { applyCreditsToOpenCharges } from '@/lib/long-let/rent-run'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/**
 * Confirm a payment that was captured offline.
 *
 * The ledger entry already exists — the money was recorded when the clerk
 * took it. What changes here is that the office has now seen it against the
 * cash float, so it stops being provisional.
 */
export async function confirmPaymentAction(paymentId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor()
    const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } })

    assertCanOnProperty(actor, 'money:reconcile', payment.propertyId)

    if (payment.status === 'CONFIRMED') {
      return { ok: false, error: 'That payment is already confirmed.' }
    }

    await db.payment.update({
      where: { id: paymentId },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), syncState: 'SYNCED' },
    })

    // Now that it counts, let it settle what it should.
    await applyCreditsToOpenCharges(payment.partyId, payment.currency)

    await logAudit({
      actor,
      action: 'payment.confirmed',
      entityType: 'Payment',
      entityId: paymentId,
      before: { status: payment.status },
      after: { status: 'CONFIRMED' },
    })

    revalidatePath('/admin/money')
    revalidatePath('/admin')
    return { ok: true, message: `Receipt ${payment.receiptNumber} confirmed.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not confirm.' }
  }
}
