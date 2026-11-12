/**
 * The purchase lifecycle.
 *
 * Buying a home is not a booking: it spans weeks, involves staged payments and
 * ends in a change of legal ownership. The state machine here is deliberately
 * linear — APPLICATION → APPROVED → CONTRACTED → COMPLETED, with DECLINED and
 * CANCELLED as exits — because every shortcut past a state has historically
 * meant a document nobody signed or a cedi nobody can account for.
 *
 * Money rules:
 *   - The asking price lives on the Unit. The agreed price lives on the
 *     Purchase. They may differ; the offer is what the ledger is written from.
 *   - Contracting freezes the installment plan as Charge rows (runKey-guarded,
 *     so re-contracting cannot double-post) plus the ledger.
 *   - Payments ride the same recordPayment() path as rent, so allocations,
 *     receipts and the audit trail behave identically.
 */

import { db, TX_OPTS } from '@/lib/db'
import type { Actor } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { queueMessage } from '@/lib/notify'
import { purchaseCode } from '@/lib/core/ids'
import { phoneVariants, normalisePhone } from '@/lib/core/phone'
import { recordPayment, postCharge } from '@/lib/core/ledger'
import { afterPaymentRecorded } from '@/lib/payments/after-payment'
import { dateOnly } from '@/lib/core/dates'
import { Prisma } from '@prisma/client'

export type PurchasePlanLine = {
  label: string
  amountMinor: number
  dueDate: string // ISO date
}

// ---------------------------------------------------------------------------
// Party helper — one customer record per phone, matched the way reservations do
// ---------------------------------------------------------------------------

async function findOrCreateBuyer(
  name: string,
  phone: string,
  email: string | null,
  tx: Prisma.TransactionClient
) {
  const variants = phoneVariants(phone)
  const existing = await tx.party.findFirst({
    where: { OR: variants.map((p) => ({ phone: p })) },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) {
    // A buyer is a prospective owner: raise the flag the portals key off.
    return tx.party.update({
      where: { id: existing.id },
      data: {
        name: existing.name || name,
        email: existing.email ?? email,
        isOwner: true,
      },
    })
  }
  return tx.party.create({
    data: {
      type: 'PERSON',
      name,
      phone: normalisePhone(phone) ?? phone,
      email,
      isOwner: true,
    },
  })
}

// ---------------------------------------------------------------------------
// Application (public)
// ---------------------------------------------------------------------------

export type CreatePurchaseInput = {
  unitId: string
  buyerName: string
  buyerPhone: string
  buyerEmail?: string | null
  buyerNotes?: string | null
}

export async function createPurchaseApplication(input: CreatePurchaseInput) {
  const run = async (tx: Prisma.TransactionClient) => {
    // Only a published, actively-for-sale unit can receive an offer.
    const unit = await tx.unit.findFirst({
      where: { id: input.unitId, published: true, forSale: true },
      include: { property: { select: { id: true, name: true } } },
    })
    if (!unit) throw new Error('This home is no longer open for offers.')
    if (!unit.salePriceMinor) throw new Error('This home does not have a sale price yet.')

    const buyer = await findOrCreateBuyer(input.buyerName, input.buyerPhone, input.buyerEmail ?? null, tx)

    const purchase = await tx.purchase.create({
      data: {
        code: purchaseCode(),
        unitId: unit.id,
        propertyId: unit.property.id,
        buyerPartyId: buyer.id,
        buyerName: input.buyerName,
        buyerPhone: input.buyerPhone,
        buyerEmail: input.buyerEmail ?? null,
        buyerNotes: input.buyerNotes ?? null,
        currency: unit.saleCurrency,
        offerMinor: unit.salePriceMinor,
        status: 'APPLICATION',
      },
    })

    return { purchase, unit, buyer }
  }

  const { purchase, unit, buyer } = await db.$transaction(run, TX_OPTS)

  // Tell the buyer (queued, so no provider account is needed in simulation).
  await queueMessage({
    channel: 'EMAIL',
    to: input.buyerEmail ?? input.buyerPhone,
    subject: `ABN Homes — offer received (${purchase.code})`,
    body:
      `Dear ${input.buyerName},\n\nWe have received your offer of interest for ${unit.name} at ` +
      `${unit.property.name}. Your tracking code is ${purchase.code} — follow your application any ` +
      `time at /track/${purchase.code}.\n\nA member of our sales team will be in touch within two ` +
      `working days.\n\n— ABN Homes, Accra`,
    template: 'purchase.application.received',
    entityType: 'Purchase',
    entityId: purchase.id,
    dedupe: true,
  })
  await queueMessage({
    channel: 'SMS',
    to: input.buyerPhone,
    body: `ABN Homes: offer received for ${unit.name}. Tracking code ${purchase.code}. Track at /track/${purchase.code}.`,
    template: 'purchase.application.received.sms',
    entityType: 'Purchase',
    entityId: purchase.id,
    dedupe: true,
  })
  // And wake the sales desk.
  await queueMessage({
    channel: 'EMAIL',
    to: 'sales@abnhomes.example',
    subject: `[Sales] New purchase application ${purchase.code} — ${unit.name}`,
    body: `${input.buyerName} (${input.buyerPhone}) applied to buy ${unit.name} at ${unit.property.name}. Review it in Operations → Property sales.`,
    template: 'purchase.application.staff',
    entityType: 'Purchase',
    entityId: purchase.id,
    dedupe: true,
  })

  return purchase
}

// ---------------------------------------------------------------------------
// Staff transitions
// ---------------------------------------------------------------------------

type PurchaseReviewContext = { actor: Actor; note?: string | null }

export async function approvePurchase(purchaseId: string, { actor, note }: PurchaseReviewContext) {
  const before = await db.purchase.findUnique({
    where: { id: purchaseId },
    include: { unit: { select: { name: true } } },
  })
  if (!before) throw new Error('Purchase not found.')
  if (before.status !== 'APPLICATION') throw new Error('Only a fresh application can be approved.')

  const after = await db.purchase.update({
    where: { id: purchaseId },
    data: {
      status: 'APPROVED',
      reviewedById: actor.id,
      reviewedAt: new Date(),
      decisionNote: note ?? null,
    },
  })

  await logAudit({
    actor,
    action: 'purchase.approved',
    entityType: 'Purchase',
    entityId: purchaseId,
    before: { status: before.status },
    after: { status: after.status, note: note ?? null },
  })
  await queueMessage({
    channel: 'EMAIL',
    to: after.buyerEmail ?? after.buyerPhone,
    subject: `ABN Homes — your offer ${after.code} has been approved`,
    body: `Good news, ${after.buyerName}. Your application for ${before.unit.name} has been approved. We will call you to sign the sale agreement and agree a payment plan.`,
    template: 'purchase.approved',
    entityType: 'Purchase',
    entityId: after.id,
    dedupe: true,
  })
  return after
}

export async function declinePurchase(purchaseId: string, { actor, note }: PurchaseReviewContext) {
  const before = await db.purchase.findUnique({ where: { id: purchaseId } })
  if (!before) throw new Error('Purchase not found.')
  if (before.status === 'COMPLETED' || before.status === 'CANCELLED') {
    throw new Error('This purchase is already closed.')
  }

  const after = await db.purchase.update({
    where: { id: purchaseId },
    data: {
      status: 'DECLINED',
      reviewedById: actor.id,
      reviewedAt: new Date(),
      decisionNote: note ?? null,
    },
  })

  await logAudit({
    actor,
    action: 'purchase.declined',
    entityType: 'Purchase',
    entityId: purchaseId,
    before: { status: before.status },
    after: { status: after.status, note: note ?? null },
  })
  return after
}

/**
 * Move an approved offer to contract: freeze the agreed price and the
 * installment plan, post every installment as an open Charge (runKey-guarded)
 * and post the ledger. Re-running with the same plan is a no-op, not a
 * double-charge — the runKey makes contracting idempotent.
 */
export async function contractPurchase(
  purchaseId: string,
  { actor, note }: PurchaseReviewContext,
  plan: PurchasePlanLine[]
) {
  if (plan.length === 0) throw new Error('A payment plan needs at least one installment.')

  const run = async (tx: Prisma.TransactionClient) => {
    const purchase = await tx.purchase.findUnique({
      where: { id: purchaseId },
      include: { unit: { include: { property: { select: { name: true } } } } },
    })
    if (!purchase) throw new Error('Purchase not found.')
    if (purchase.status !== 'APPROVED' && purchase.status !== 'CONTRACTED') {
      throw new Error('Only an approved offer can be contracted.')
    }

    let posted = 0
    for (const [i, line] of plan.entries()) {
      const runKey = `purchase:${purchase.id}:${i}`
      const existing = await tx.charge.findUnique({ where: { runKey }, select: { id: true } })
      if (existing) continue

      await postCharge(
        {
          propertyId: purchase.propertyId,
          unitId: purchase.unitId,
          partyId: purchase.buyerPartyId,
          purchaseId: purchase.id,
          type: 'OTHER',
          description: `${line.label} — ${purchase.code}`,
          amountMinor: line.amountMinor,
          currency: purchase.currency,
          dueDate: dateOnly(new Date(line.dueDate)),
          runKey,
        },
        tx
      )
      posted += 1
    }

    const updated = await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        status: 'CONTRACTED',
        plan: plan as never,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        decisionNote: note ?? purchase.decisionNote,
      },
    })

    return { updated, posted, purchase }
  }

  const { updated, posted, purchase } = await db.$transaction(run, TX_OPTS)

  await logAudit({
    actor,
    action: 'purchase.contracted',
    entityType: 'Purchase',
    entityId: purchaseId,
    after: { status: updated.status, installments: plan.length, postedThisRun: posted },
  })
  if (posted > 0) {
    await queueMessage({
      channel: 'EMAIL',
      to: purchase.buyerEmail ?? purchase.buyerPhone,
      subject: `ABN Homes — payment plan agreed (${purchase.code})`,
      body: `Dear ${purchase.buyerName}, your payment plan for ${plan.length} installment(s) totalling the agreed price is now active. You can follow every payment on /track/${purchase.code}.`,
      template: 'purchase.contracted',
      entityType: 'Purchase',
      entityId: purchase.id,
      dedupe: true,
    })
  }
  return { purchase: updated, posted }
}

/** Record a money-in against a contracted purchase (deposit or installment). */
export async function recordPurchasePayment(
  purchaseId: string,
  {
    actor,
    amountMinor,
    channel,
    reference,
  }: { actor: Actor; amountMinor: number; channel: 'CASH' | 'BANK_TRANSFER' | 'MOMO_MTN' | 'MOMO_TELECEL' | 'MOMO_AIRTELTIGO' | 'CARD' | 'OTHER'; reference?: string | null }
) {
  const purchase = await db.purchase.findUnique({ where: { id: purchaseId } })
  if (!purchase) throw new Error('Purchase not found.')
  if (purchase.status !== 'CONTRACTED') {
    throw new Error('Payments can only be recorded against a contracted sale.')
  }

  const { payment } = await recordPayment({
    propertyId: purchase.propertyId,
    partyId: purchase.buyerPartyId,
    amountMinor,
    currency: purchase.currency,
    channel,
    reference: reference ?? null,
    payerName: purchase.buyerName,
    payerPhone: purchase.buyerPhone,
    recordedById: actor.id,
    status: 'CONFIRMED',
  })

  await logAudit({
    actor,
    action: 'purchase.payment.recorded',
    entityType: 'Purchase',
    entityId: purchaseId,
    after: { paymentId: payment.id, amountMinor, channel, receipt: payment.receiptNumber },
  })
  // Receipt + staff notifications on the standard path.
  await afterPaymentRecorded(payment.id)
  return payment
}

/**
 * Handover. Only when every installment charge is settled. Marks the unit
 * SOLD, flags the buyer as an owner (their portals and statements key off
 * that flag) and closes the journey.
 */
export async function completePurchase(purchaseId: string, { actor }: PurchaseReviewContext) {
  const run = async (tx: Prisma.TransactionClient) => {
    const purchase = await tx.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        charges: { include: { allocations: true } },
        unit: { select: { id: true, name: true, forSale: true } },
      },
    })
    if (!purchase) throw new Error('Purchase not found.')
    if (purchase.status !== 'CONTRACTED') {
      throw new Error('Only a contracted sale can be completed.')
    }

    const owed = purchase.charges.reduce((s, c) => s + c.amountMinor, 0)
    const paid = purchase.charges.reduce(
      (s, c) => s + c.allocations.reduce((a, al) => a + al.amountMinor, 0),
      0
    )
    if (paid < owed) {
      throw new Error(
        `Outstanding balance remains: ${((owed - paid) / 100).toLocaleString()} ${purchase.currency}. Collect it before handover.`
      )
    }

    const [updated] = await Promise.all([
      tx.purchase.update({
        where: { id: purchaseId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
      tx.unit.update({
        where: { id: purchase.unitId },
        data: { forSale: false, status: 'SOLD' },
      }),
    ])

    return { updated, owed, paid, unitName: purchase.unit.name }
  }

  const { updated, owed, paid } = await db.$transaction(run, TX_OPTS)

  await logAudit({
    actor,
    action: 'purchase.completed',
    entityType: 'Purchase',
    entityId: purchaseId,
    after: { status: 'COMPLETED', owedMinor: owed, paidMinor: paid },
  })
  return updated
}

export async function cancelPurchase(purchaseId: string, { actor, note }: PurchaseReviewContext) {
  const before = await db.purchase.findUnique({ where: { id: purchaseId } })
  if (!before) throw new Error('Purchase not found.')
  if (before.status === 'COMPLETED') throw new Error('A completed sale cannot be cancelled.')

  const after = await db.purchase.update({
    where: { id: purchaseId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: note ?? null },
  })

  await logAudit({
    actor,
    action: 'purchase.cancelled',
    entityType: 'Purchase',
    entityId: purchaseId,
    before: { status: before.status },
    after: { status: after.status, note: note ?? null },
  })
  return after
}

/** How much of the agreed price is still owed, in minor units. */
export async function purchaseBalanceMinor(purchaseId: string) {
  const purchase = await db.purchase.findUnique({
    where: { id: purchaseId },
    select: {
      currency: true,
      charges: { select: { amountMinor: true, status: true, allocations: { select: { amountMinor: true } } } },
    },
  })
  if (!purchase) return null
  const owed = purchase.charges
    .filter((c) => c.status !== 'REVERSED' && c.status !== 'WAIVED')
    .reduce((s, c) => s + c.amountMinor, 0)
  const paid = purchase.charges.reduce(
    (s, c) => s + c.allocations.reduce((a, al) => a + al.amountMinor, 0),
    0
  )
  return { owedMinor: owed, paidMinor: paid, outstandingMinor: owed - paid, currency: purchase.currency }
}
