'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import {
  approvePurchase,
  declinePurchase,
  cancelPurchase,
  contractPurchase,
  type PurchasePlanLine,
} from '@/lib/sales/purchases'
import {
  screenApplication,
  approveTenancyApplication,
  rejectTenancyApplication,
  convertApplicationToLease,
} from '@/lib/sales/applications'
import { toMinor } from '@/lib/core/money'

export type ApplicationActionResult = { ok: true; message: string } | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Purchase review
// ---------------------------------------------------------------------------

export async function approvePurchaseAction(purchaseId: string, note: string): Promise<ApplicationActionResult> {
  try {
    const actor = await requirePermission('sales:write')
    await approvePurchase(purchaseId, { actor, note: note || null })
    revalidatePath('/admin/applications')
    revalidatePath('/admin/sales')
    return { ok: true, message: 'Offer approved. Next: agree the payment plan and contract it.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not approve.' }
  }
}

export async function declinePurchaseAction(purchaseId: string, note: string): Promise<ApplicationActionResult> {
  try {
    const actor = await requirePermission('sales:write')
    if (!note.trim()) return { ok: false, error: 'Give the buyer a reason — they will see it on their tracking page.' }
    await declinePurchase(purchaseId, { actor, note })
    revalidatePath('/admin/applications')
    revalidatePath('/admin/sales')
    return { ok: true, message: 'Offer declined. The buyer sees your note on /track.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not decline.' }
  }
}

export async function cancelPurchaseAction(purchaseId: string, note: string): Promise<ApplicationActionResult> {
  try {
    const actor = await requirePermission('sales:write')
    await cancelPurchase(purchaseId, { actor, note })
    revalidatePath('/admin/sales')
    revalidatePath('/admin/applications')
    return { ok: true, message: 'Purchase cancelled and withdrawn from the buyer tracking page.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not cancel.' }
  }
}

/**
 * Contract an approved offer: freeze the agreed price and build the plan —
 * deposit today + `months` equal installments starting on firstDue.
 * Typed args (not FormData) — this action is called directly from the client
 * with startTransition, like every other action in this file.
 */
export async function contractPurchaseAction(
  purchaseId: string,
  offer: number,
  deposit: number,
  months: number,
  firstDue: string,
  note: string
): Promise<ApplicationActionResult> {
  try {
    const actor = await requirePermission('sales:write')

    const purchase = await db.purchase.findUnique({ where: { id: purchaseId }, select: { status: true, currency: true } })
    if (!purchase) return { ok: false, error: 'Purchase not found.' }
    if (purchase.currency !== 'GHS') return { ok: false, error: 'Non-GHS purchase plans are handled offline.' }
    if (!(offer > 0)) return { ok: false, error: 'Agreed price must be positive.' }
    if (!(deposit >= 0)) return { ok: false, error: 'Deposit cannot be negative.' }
    if (!Number.isInteger(months) || months < 1 || months > 60) return { ok: false, error: 'Installments must be between 1 and 60.' }
    if (!firstDue) return { ok: false, error: 'Choose the first installment due date.' }

    const depositMinor = toMinor(deposit, 'GHS')
    const offerMinor = toMinor(offer, 'GHS')
    if (depositMinor > offerMinor) return { ok: false, error: 'The deposit cannot exceed the agreed price.' }

    const balance = offerMinor - depositMinor
    const perInstallment = Math.floor(balance / months)
    const remainder = balance - perInstallment * months

    const start = new Date(firstDue)
    const plan: PurchasePlanLine[] = []
    if (depositMinor > 0) {
      plan.push({ label: 'Deposit', amountMinor: depositMinor, dueDate: new Date().toISOString().slice(0, 10) })
    }
    for (let i = 0; i < months; i++) {
      const due = new Date(start)
      due.setMonth(due.getMonth() + i)
      // The rounding remainder lands on the final installment so the plan sums exactly.
      const amount = perInstallment + (i === months - 1 ? remainder : 0)
      plan.push({ label: `Installment ${i + 1} of ${months}`, amountMinor: amount, dueDate: due.toISOString().slice(0, 10) })
    }

    const result = await contractPurchase(purchaseId, { actor, note: note || null }, plan)
    revalidatePath('/admin/sales')
    revalidatePath('/admin/applications')
    revalidatePath(`/admin/sales/${purchaseId}`)
    return {
      ok: true,
      message:
        result.posted > 0
          ? `Contracted. ${plan.length} installment${plan.length === 1 ? '' : 's'} posted to the ledger.`
          : 'Plan re-saved — installments were already posted, nothing doubled.',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not contract.' }
  }
}

// ---------------------------------------------------------------------------
// Tenancy review
// ---------------------------------------------------------------------------

export async function screenApplicationAction(applicationId: string, note: string): Promise<ApplicationActionResult> {
  try {
    const actor = await requirePermission('applications:write')
    await screenApplication(applicationId, { actor, note: note || null })
    revalidatePath('/admin/applications')
    return { ok: true, message: 'Moved to screening.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not update.' }
  }
}

export async function approveApplicationAction(applicationId: string, note: string): Promise<ApplicationActionResult> {
  try {
    const actor = await requirePermission('applications:write')
    await approveTenancyApplication(applicationId, { actor, note: note || null })
    revalidatePath('/admin/applications')
    return { ok: true, message: 'Approved. Convert to a lease when they have signed.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not approve.' }
  }
}

export async function rejectApplicationAction(applicationId: string, note: string): Promise<ApplicationActionResult> {
  try {
    const actor = await requirePermission('applications:write')
    if (!note.trim()) return { ok: false, error: 'Give the applicant a reason — they will see it on their tracking page.' }
    await rejectTenancyApplication(applicationId, { actor, note })
    revalidatePath('/admin/applications')
    return { ok: true, message: 'Rejected. The applicant sees your note on /track.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not reject.' }
  }
}

export async function convertApplicationAction(applicationId: string, rent: string): Promise<ApplicationActionResult> {
  try {
    const actor = await requirePermission('applications:write')
    const rentMinor = rent ? toMinor(Number(rent), 'GHS') : undefined
    if (rentMinor !== undefined && (!rentMinor || rentMinor <= 0)) {
      return { ok: false, error: 'Rent must be more than zero.' }
    }
    const { lease } = await convertApplicationToLease(applicationId, { actor }, rentMinor)
    revalidatePath('/admin/applications')
    revalidatePath('/admin/leases')
    return { ok: true, message: `Lease ${lease.code} created and activated. The tenant portal is live.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not convert.' }
  }
}

/** Shared helper for the queue pages: count what needs a human today. */
export async function queueCounts() {
  const [newTenancy, screening, newPurchase] = await Promise.all([
    db.tenancyApplication.count({ where: { status: 'NEW' } }),
    db.tenancyApplication.count({ where: { status: 'SCREENING' } }),
    db.purchase.count({ where: { status: 'APPLICATION' } }),
  ])
  return { newTenancy, screening, newPurchase, total: newTenancy + screening + newPurchase }
}
