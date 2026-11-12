'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/session'
import { completePurchase, recordPurchasePayment } from '@/lib/sales/purchases'

export type SalesActionResult = { ok: true; message: string } | { ok: false, error: string }

/** Money in against a contracted sale. Rides the standard ledger + receipt path. */
export async function recordPurchasePaymentAction(
  purchaseId: string,
  amount: number,
  channel: 'CASH' | 'BANK_TRANSFER' | 'MOMO_MTN' | 'MOMO_TELECEL' | 'MOMO_AIRTELTIGO' | 'CARD' | 'OTHER',
  reference: string
): Promise<SalesActionResult> {
  try {
    if (!(amount > 0)) return { ok: false, error: 'Amount must be positive.' }
    const actor = await requirePermission('money:record')
    const payment = await recordPurchasePayment(purchaseId, {
      actor,
      amountMinor: Math.round(amount * 100),
      channel,
      reference: reference || null,
    })
    revalidatePath(`/admin/sales/${purchaseId}`)
    revalidatePath('/admin/sales')
    return { ok: true, message: `Recorded — receipt ${payment.receiptNumber}. Receipt queued to the buyer.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not record the payment.' }
  }
}

/** Handover. Blocked by the engine until every installment charge is settled. */
export async function completePurchaseAction(purchaseId: string): Promise<SalesActionResult> {
  try {
    const actor = await requirePermission('sales:write')
    await completePurchase(purchaseId, { actor })
    revalidatePath(`/admin/sales/${purchaseId}`)
    revalidatePath('/admin/sales')
    revalidatePath('/admin/portfolio')
    return { ok: true, message: 'Sold and handed over. The unit is marked SOLD and off the market.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not complete the sale.' }
  }
}
