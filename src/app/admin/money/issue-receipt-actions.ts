'use server'

/**
 * Issuing a receipt by hand.
 *
 * Cash across the desk, a bank transfer that arrived without a reference, a
 * mobile money payment made to a staff phone — all of it has to end up on the
 * same ledger as a card payment, with the same kind of receipt handed back.
 *
 * This records the money exactly as the gateway would, then returns the
 * receipt link so the clerk can show it, print it, or send it on while the
 * payer is still standing there.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireActor, requirePermission } from '@/lib/session'
import { AccessError, assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { recordPayment } from '@/lib/core/ledger'
import { afterPaymentRecorded } from '@/lib/payments/after-payment'
import { toMinor } from '@/lib/core/money'
import { normalisePhone } from '@/lib/core/phone'

export type IssueResult =
  | { ok: true; receiptNumber: string; receiptUrl: string; message: string }
  | { ok: false; error: string }

const schema = z.object({
  partyId: z.string().min(1, 'Choose who paid.'),
  propertyId: z.string().min(1, 'Choose which property this is for.'),
  amount: z.coerce.number().positive('Enter the amount received.'),
  currency: z.enum(['GHS', 'USD']),
  channel: z.enum([
    'CASH',
    'MOMO_MTN',
    'MOMO_TELECEL',
    'MOMO_AIRTELTIGO',
    'CARD',
    'BANK_TRANSFER',
    'OTHER',
  ]),
  reference: z.string().optional(),
  payerPhone: z.string().optional(),
  notes: z.string().max(500).optional(),
  receivedAt: z.string().optional(),
  /** Cash taken in the field stays provisional until the office sees it. */
  provisional: z.string().optional(),
  /** Minted by the form; makes a double-submit settle once. */
  idempotencyKey: z.string().uuid().optional(),
})

export async function issueReceiptAction(
  _prev: IssueResult | null,
  formData: FormData
): Promise<IssueResult> {
  try {
    const actor = await requireActor()
    const parsed = schema.safeParse(Object.fromEntries(formData))

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }
    }
    const input = parsed.data

    assertCanOnProperty(actor, 'money:record', input.propertyId)

    const party = await db.party.findUnique({
      where: { id: input.partyId },
      select: { id: true, name: true },
    })
    if (!party) return { ok: false, error: 'That person is no longer on file.' }

    // The form gives a date with no time, which would otherwise stamp every
    // receipt at midnight — and a receipt that says a clerk took cash at
    // 00:00 reads as a mistake. Today keeps the real clock time; a past date
    // is set to midday, which is honestly vague rather than falsely precise.
    const now = new Date()
    let receivedAt = now

    if (input.receivedAt) {
      const chosen = new Date(`${input.receivedAt}T00:00:00Z`)
      if (Number.isNaN(chosen.getTime())) {
        return { ok: false, error: 'That date could not be read.' }
      }
      const isToday = input.receivedAt === now.toISOString().slice(0, 10)
      receivedAt = isToday ? now : new Date(`${input.receivedAt}T12:00:00Z`)
    }

    if (receivedAt.getTime() > Date.now() + 60_000) {
      return { ok: false, error: 'A payment cannot be received in the future.' }
    }

    // And a floor. The date input accepts '0025-01-14', which parses happily
    // and would file real cash two thousand years into the past, where no
    // report would ever look for it again. Two years back covers every
    // late-entered receipt anyone here has had to key in.
    const floor = new Date(now)
    floor.setUTCFullYear(floor.getUTCFullYear() - 2)
    if (receivedAt.getTime() < floor.getTime()) {
      return { ok: false, error: 'That date is too far back to record here.' }
    }

    // recordPayment allocates against the oldest open charges by itself, so a
    // manual receipt settles arrears in the same order an online payment would.
    const { payment } = await recordPayment({
      propertyId: input.propertyId,
      partyId: input.partyId,
      amountMinor: toMinor(input.amount, input.currency),
      currency: input.currency,
      channel: input.channel,
      receivedAt,
      reference: input.reference?.trim() || null,
      payerPhone: normalisePhone(input.payerPhone ?? '') ?? null,
      payerName: party.name,
      notes: input.notes?.trim() || null,
      recordedById: actor.id,
      status: input.provisional === 'on' ? 'PENDING' : 'CONFIRMED',
      idempotencyKey: input.idempotencyKey ?? null,
    })

    // Sends the receipt on every channel the payer has.
    await afterPaymentRecorded(payment.id)

    await logAudit({
      actor,
      action: 'receipt.issued.manual',
      entityType: 'Payment',
      entityId: payment.id,
      after: {
        receipt: payment.receiptNumber,
        amount: input.amount,
        currency: input.currency,
        channel: input.channel,
        payer: party.name,
      },
    })

    revalidatePath('/admin/money')
    revalidatePath('/admin')

    return {
      ok: true,
      receiptNumber: payment.receiptNumber,
      receiptUrl: `/receipt/${payment.id}`,
      message:
        input.provisional === 'on'
          ? `Receipt ${payment.receiptNumber} issued, marked awaiting confirmation.`
          : `Receipt ${payment.receiptNumber} issued and sent to ${party.name}.`,
    }
  } catch (error) {
    // Only our own errors carry text fit for a clerk to read. A Prisma failure
    // names tables, columns and constraints, which is no use at the desk and
    // tells an attacker the shape of the schema, so it is logged and replaced.
    //
    // The discriminator is the constructor: the access layer throws
    // AccessError and the ledger's own rule violations throw a plain Error,
    // while Prisma, the runtime and anything else throw a subclass.
    const ours =
      error instanceof AccessError ||
      (error instanceof Error && error.constructor === Error)
    if (ours) {
      return { ok: false, error: (error as Error).message }
    }
    console.error('[receipt.issue] failed', error)
    return {
      ok: false,
      error: 'Could not issue the receipt. Nothing was recorded — please try again.',
    }
  }
}

/**
 * Type-ahead for the payer field — tenants, guests and owners alike.
 *
 * A server action is a public POST endpoint, not a private function of the
 * component that imports it. Asserting only "is signed in" let any portal
 * account — a tenant, a vendor, a guest with a booking code — walk the entire
 * customer book two letters at a time, names and phone numbers included.
 */
export async function searchPayersAction(query: string) {
  await requirePermission('parties:read')
  const q = query.trim()
  if (q.length < 2) return []

  const phone = normalisePhone(q)

  return db.party.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        ...(phone ? [{ phone }] : [{ phone: { contains: q } }]),
      ],
    },
    select: { id: true, name: true, phone: true, isTenant: true, isGuest: true, isOwner: true },
    orderBy: { name: 'asc' },
    take: 8,
  })
}
