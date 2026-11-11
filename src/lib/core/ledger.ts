/**
 * The ledger.
 *
 * This is the financial source of truth and the one file in the codebase where
 * the rules are absolute:
 *
 *   1. LedgerEntry rows are NEVER updated and NEVER deleted. To correct one,
 *      post a REVERSAL that points at it. The original stays visible forever.
 *   2. No balance is ever stored. A balance is the sum of entries, computed
 *      on read. Two devices that were both offline cannot overwrite each
 *      other's money, because appending is all either of them can do.
 *   3. Every write happens inside a transaction with the Charge, Payment or
 *      Allocation it belongs to. A charge without its ledger entry, or a
 *      payment without its credit, is a bug that compounds silently.
 *
 * Sign convention, from the perspective of the party's account with ABN:
 *   DEBIT  increases what the party owes us  (a rent charge, a late fee)
 *   CREDIT reduces it                        (a payment, a waiver)
 *
 * balance = sum(debits) - sum(credits)
 *   positive -> the party owes ABN            (a tenant in arrears)
 *   negative -> ABN owes the party            (an owner awaiting payout,
 *                                              or a tenant in credit)
 */

import {
  Prisma,
  type Allocation,
  type ChargeType,
  type Currency,
  type LedgerKind,
} from '@prisma/client'
import { db, TX_OPTS } from '@/lib/db'
import { newLedgerId, sequentialCode } from './ids'
import { dateOnly } from './dates'

type Tx = Prisma.TransactionClient

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

export function baseCurrency(): Currency {
  return (process.env.BASE_CURRENCY as Currency) || 'GHS'
}

/**
 * The rate to convert `from` into `to` as at a moment in time. Captured on
 * every entry at posting time so that reporting never re-derives old history
 * from today's rate — which would silently rewrite last year's revenue every
 * time the cedi moves.
 */
export async function resolveFxRate(
  client: Tx | typeof db,
  from: Currency,
  to: Currency,
  asOf: Date = new Date()
): Promise<number> {
  if (from === to) return 1

  const rate = await client.fxRate.findFirst({
    where: { from, to, asOf: { lte: asOf } },
    orderBy: { asOf: 'desc' },
  })
  if (rate) return Number(rate.rate)

  // No rate on or before this date: fall back to the earliest one we hold
  // rather than refusing to post. Flagged in reporting as an estimate.
  const earliest = await client.fxRate.findFirst({
    where: { from, to },
    orderBy: { asOf: 'asc' },
  })
  if (earliest) return Number(earliest.rate)

  throw new Error(
    `No exchange rate available for ${from} to ${to}. Seed one in Settings before posting cross-currency entries.`
  )
}

// ---------------------------------------------------------------------------
// Posting charges
// ---------------------------------------------------------------------------

export type PostChargeInput = {
  propertyId: string
  partyId: string
  unitId?: string | null
  type: ChargeType
  description: string
  amountMinor: number
  currency: Currency
  dueDate: Date
  periodStart?: Date | null
  periodEnd?: Date | null
  leaseId?: string | null
  reservationId?: string | null
  /** Set by the rent run so a re-run cannot bill the same period twice. */
  runKey?: string | null
  occurredAt?: Date
  actorUserId?: string | null
}

/**
 * Create a charge and its matching DEBIT in one atomic step.
 * Pass a transaction client when composing with other writes.
 */
export async function postCharge(input: PostChargeInput, tx?: Tx) {
  const run = async (client: Tx) => {
    if (input.amountMinor <= 0) {
      throw new Error('A charge must be positive. To credit a party, use postCreditNote().')
    }

    // The rent run is idempotent by design: if this period was already
    // billed, hand back what exists rather than billing it again.
    if (input.runKey) {
      const existing = await client.charge.findUnique({ where: { runKey: input.runKey } })
      if (existing) return { charge: existing, entry: null, created: false as const }
    }

    const occurredAt = input.occurredAt ?? new Date()
    const base = baseCurrency()
    const fx = await resolveFxRate(client, input.currency, base, occurredAt)

    const charge = await client.charge.create({
      data: {
        propertyId: input.propertyId,
        partyId: input.partyId,
        unitId: input.unitId ?? null,
        type: input.type,
        description: input.description,
        amountMinor: input.amountMinor,
        currency: input.currency,
        dueDate: dateOnly(input.dueDate),
        periodStart: input.periodStart ? dateOnly(input.periodStart) : null,
        periodEnd: input.periodEnd ? dateOnly(input.periodEnd) : null,
        leaseId: input.leaseId ?? null,
        reservationId: input.reservationId ?? null,
        runKey: input.runKey ?? null,
        status: 'OPEN',
      },
    })

    const entry = await client.ledgerEntry.create({
      data: {
        id: newLedgerId(),
        propertyId: input.propertyId,
        partyId: input.partyId,
        unitId: input.unitId ?? null,
        direction: 'DEBIT',
        kind: 'CHARGE',
        amountMinor: input.amountMinor,
        currency: input.currency,
        fxRateToBase: new Prisma.Decimal(fx),
        baseCurrency: base,
        description: input.description,
        occurredAt,
        chargeId: charge.id,
        leaseId: input.leaseId ?? null,
        reservationId: input.reservationId ?? null,
        createdById: input.actorUserId ?? null,
      },
    })

    return { charge, entry, created: true as const }
  }

  return tx ? run(tx) : db.$transaction(run, TX_OPTS)
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type RecordPaymentInput = {
  propertyId: string
  partyId: string
  amountMinor: number
  currency: Currency
  channel:
    | 'MOMO_MTN'
    | 'MOMO_TELECEL'
    | 'MOMO_AIRTELTIGO'
    | 'CARD'
    | 'BANK_TRANSFER'
    | 'CASH'
    | 'PAYPAL'
    | 'OTHER'
  receivedAt?: Date
  reference?: string | null
  providerRef?: string | null
  payerPhone?: string | null
  payerName?: string | null
  notes?: string | null
  recordedById?: string | null
  deviceId?: string | null
  /**
   * Generated on the client before the request leaves the device. Replaying
   * the offline queue eleven times still produces exactly one payment.
   */
  idempotencyKey?: string | null
  /** PENDING for cash captured offline, CONFIRMED once the office sees it. */
  status?: 'PENDING' | 'CONFIRMED'
  /** Explicit allocation. Omit to settle oldest open charges first. */
  allocations?: Array<{ chargeId: string; amountMinor: number }>
}

/**
 * Record money in. Creates the Payment, its CREDIT entry, and the allocations
 * against open charges — all or nothing.
 */
export async function recordPayment(input: RecordPaymentInput, tx?: Tx) {
  const run = async (client: Tx) => {
    if (input.amountMinor <= 0) {
      throw new Error('A payment must be positive. To reverse one, use reverseEntry().')
    }

    // Idempotency: an offline device that retries must not pay twice.
    if (input.idempotencyKey) {
      const existing = await client.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { allocations: true },
      })
      if (existing) return { payment: existing, entry: null, created: false as const }
    }

    const receivedAt = input.receivedAt ?? new Date()
    const status = input.status ?? 'CONFIRMED'
    const base = baseCurrency()
    const fx = await resolveFxRate(client, input.currency, base, receivedAt)
    const receiptNumber = await nextReceiptNumber(client, receivedAt.getUTCFullYear())

    const payment = await client.payment.create({
      data: {
        receiptNumber,
        propertyId: input.propertyId,
        partyId: input.partyId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        channel: input.channel,
        status,
        reference: input.reference ?? null,
        providerRef: input.providerRef ?? null,
        payerPhone: input.payerPhone ?? null,
        payerName: input.payerName ?? null,
        receivedAt,
        confirmedAt: status === 'CONFIRMED' ? new Date() : null,
        recordedById: input.recordedById ?? null,
        deviceId: input.deviceId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        syncState: status === 'CONFIRMED' ? 'SYNCED' : 'PENDING',
        notes: input.notes ?? null,
      },
    })

    const entry = await client.ledgerEntry.create({
      data: {
        id: newLedgerId(),
        propertyId: input.propertyId,
        partyId: input.partyId,
        direction: 'CREDIT',
        kind: 'PAYMENT',
        amountMinor: input.amountMinor,
        currency: input.currency,
        fxRateToBase: new Prisma.Decimal(fx),
        baseCurrency: base,
        description: `Payment received — ${humanChannel(input.channel)} — receipt ${receiptNumber}`,
        occurredAt: receivedAt,
        paymentId: payment.id,
        createdById: input.recordedById ?? null,
      },
    })

    const allocations = input.allocations
      ? await applyExplicitAllocations(client, payment.id, input.allocations)
      : await allocateOldestFirst(client, {
          paymentId: payment.id,
          partyId: input.partyId,
          amountMinor: input.amountMinor,
          currency: input.currency,
        })

    return { payment, entry, allocations, created: true as const }
  }

  return tx ? run(tx) : db.$transaction(run, TX_OPTS)
}

function humanChannel(channel: string): string {
  const labels: Record<string, string> = {
    MOMO_MTN: 'MTN MoMo',
    MOMO_TELECEL: 'Telecel Cash',
    MOMO_AIRTELTIGO: 'AirtelTigo Money',
    CARD: 'Card',
    BANK_TRANSFER: 'Bank transfer',
    CASH: 'Cash',
    PAYPAL: 'PayPal',
    OTHER: 'Other',
  }
  return labels[channel] ?? channel
}

/**
 * Settle the oldest open charges first. This is the convention tenants expect
 * and the one that keeps arrears aging honest — paying this month's rent while
 * last month is outstanding should clear last month.
 */
async function allocateOldestFirst(
  client: Tx,
  args: { paymentId: string; partyId: string; amountMinor: number; currency: Currency }
) {
  const openCharges = await client.charge.findMany({
    where: {
      partyId: args.partyId,
      currency: args.currency,
      status: { in: ['OPEN', 'PART_PAID'] },
    },
    include: { allocations: true },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  })

  let remaining = args.amountMinor
  const created: Allocation[] = []

  for (const charge of openCharges) {
    if (remaining <= 0) break

    const alreadyPaid = charge.allocations.reduce((s, a) => s + a.amountMinor, 0)
    const outstanding = charge.amountMinor - alreadyPaid
    if (outstanding <= 0) continue

    const amount = Math.min(outstanding, remaining)

    created.push(
      await client.allocation.create({
        data: { paymentId: args.paymentId, chargeId: charge.id, amountMinor: amount },
      })
    )

    await client.charge.update({
      where: { id: charge.id },
      data: { status: amount >= outstanding ? 'SETTLED' : 'PART_PAID' },
    })

    remaining -= amount
  }

  // Anything left over stays on the account as a credit. It shows as a
  // negative balance and is picked up automatically by the next charge.
  return created
}

async function applyExplicitAllocations(
  client: Tx,
  paymentId: string,
  allocations: Array<{ chargeId: string; amountMinor: number }>
) {
  const created: Allocation[] = []
  for (const alloc of allocations) {
    const charge = await client.charge.findUniqueOrThrow({
      where: { id: alloc.chargeId },
      include: { allocations: true },
    })
    const alreadyPaid = charge.allocations.reduce((s, a) => s + a.amountMinor, 0)
    const outstanding = charge.amountMinor - alreadyPaid

    if (alloc.amountMinor > outstanding) {
      throw new Error(
        `Cannot allocate ${alloc.amountMinor} to charge ${charge.id}: only ${outstanding} is outstanding.`
      )
    }

    created.push(
      await client.allocation.create({
        data: { paymentId, chargeId: alloc.chargeId, amountMinor: alloc.amountMinor },
      })
    )

    await client.charge.update({
      where: { id: charge.id },
      data: { status: alloc.amountMinor >= outstanding ? 'SETTLED' : 'PART_PAID' },
    })
  }
  return created
}

/**
 * Atomic sequence for receipt numbers. A single SQL statement, so two clerks
 * taking cash at the same moment cannot be issued the same receipt number.
 */
async function nextReceiptNumber(client: Tx, year: number): Promise<string> {
  const key = `receipt_seq_${year}`
  const rows = await client.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "Setting" ("key", "value", "updatedAt")
    VALUES (${key}, '1'::jsonb, now())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = (("Setting"."value")::text::int + 1)::text::jsonb,
          "updatedAt" = now()
    RETURNING ("value")::text::int AS value
  `
  return sequentialCode('RCT', year, rows[0]?.value ?? 1)
}

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

/**
 * Undo an entry without erasing it. Posts an equal and opposite REVERSAL
 * that points back at the original, so an auditor can see both what was
 * recorded and what corrected it.
 */
export async function reverseEntry(
  entryId: string,
  args: { reason: string; actorUserId?: string | null },
  tx?: Tx
) {
  const run = async (client: Tx) => {
    const original = await client.ledgerEntry.findUniqueOrThrow({ where: { id: entryId } })

    const already = await client.ledgerEntry.findUnique({ where: { reversesId: entryId } })
    if (already) return already

    const reversal = await client.ledgerEntry.create({
      data: {
        id: newLedgerId(),
        propertyId: original.propertyId,
        partyId: original.partyId,
        unitId: original.unitId,
        direction: original.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        kind: 'REVERSAL',
        amountMinor: original.amountMinor,
        currency: original.currency,
        fxRateToBase: original.fxRateToBase,
        baseCurrency: original.baseCurrency,
        description: `Reversal of ${original.description} — ${args.reason}`,
        occurredAt: new Date(),
        chargeId: original.chargeId,
        paymentId: original.paymentId,
        leaseId: original.leaseId,
        reservationId: original.reservationId,
        reversesId: original.id,
        createdById: args.actorUserId ?? null,
      },
    })

    // Keep the charge and payment headers consistent with the ledger.
    if (original.chargeId && original.kind === 'CHARGE') {
      await client.charge.update({
        where: { id: original.chargeId },
        data: { status: 'REVERSED' },
      })
    }
    if (original.paymentId && original.kind === 'PAYMENT') {
      await client.payment.update({
        where: { id: original.paymentId },
        data: { status: 'REVERSED' },
      })
      await client.allocation.deleteMany({ where: { paymentId: original.paymentId } })
    }

    return reversal
  }

  return tx ? run(tx) : db.$transaction(run, TX_OPTS)
}

/** Reduce what a party owes without money changing hands: a waiver or goodwill. */
export async function postCreditNote(
  input: {
    propertyId: string
    partyId: string
    amountMinor: number
    currency: Currency
    description: string
    chargeId?: string | null
    occurredAt?: Date
    actorUserId?: string | null
  },
  tx?: Tx
) {
  const run = async (client: Tx) => {
    const occurredAt = input.occurredAt ?? new Date()
    const base = baseCurrency()
    const fx = await resolveFxRate(client, input.currency, base, occurredAt)

    const entry = await client.ledgerEntry.create({
      data: {
        id: newLedgerId(),
        propertyId: input.propertyId,
        partyId: input.partyId,
        direction: 'CREDIT',
        kind: 'CREDIT_NOTE',
        amountMinor: input.amountMinor,
        currency: input.currency,
        fxRateToBase: new Prisma.Decimal(fx),
        baseCurrency: base,
        description: input.description,
        occurredAt,
        chargeId: input.chargeId ?? null,
        createdById: input.actorUserId ?? null,
      },
    })

    if (input.chargeId) {
      await client.charge.update({
        where: { id: input.chargeId },
        data: { status: 'WAIVED' },
      })
    }

    return entry
  }

  return tx ? run(tx) : db.$transaction(run, TX_OPTS)
}

/**
 * A cost borne by the property: a plumber's invoice, a generator service.
 * Recorded against the property so it flows into the owner's statement.
 */
export async function postExpense(
  input: {
    propertyId: string
    unitId?: string | null
    /** The vendor being paid, when there is one. */
    partyId?: string | null
    amountMinor: number
    currency: Currency
    description: string
    ticketId?: string | null
    occurredAt?: Date
    actorUserId?: string | null
  },
  tx?: Tx
) {
  const run = async (client: Tx) => {
    const occurredAt = input.occurredAt ?? new Date()
    const base = baseCurrency()
    const fx = await resolveFxRate(client, input.currency, base, occurredAt)

    return client.ledgerEntry.create({
      data: {
        id: newLedgerId(),
        propertyId: input.propertyId,
        unitId: input.unitId ?? null,
        partyId: input.partyId ?? null,
        direction: 'DEBIT',
        kind: 'EXPENSE',
        amountMinor: input.amountMinor,
        currency: input.currency,
        fxRateToBase: new Prisma.Decimal(fx),
        baseCurrency: base,
        description: input.description,
        occurredAt,
        ticketId: input.ticketId ?? null,
        createdById: input.actorUserId ?? null,
      },
    })
  }

  return tx ? run(tx) : db.$transaction(run, TX_OPTS)
}

/**
 * Generic append. Used by the advance-rent and deposit machinery, which need
 * to post liability movements that are not charges or payments.
 */
export async function postEntry(
  input: {
    propertyId: string
    partyId?: string | null
    unitId?: string | null
    direction: 'DEBIT' | 'CREDIT'
    kind: LedgerKind
    amountMinor: number
    currency: Currency
    description: string
    occurredAt?: Date
    leaseId?: string | null
    reservationId?: string | null
    chargeId?: string | null
    statementId?: string | null
    actorUserId?: string | null
  },
  tx?: Tx
) {
  const run = async (client: Tx) => {
    const occurredAt = input.occurredAt ?? new Date()
    const base = baseCurrency()
    const fx = await resolveFxRate(client, input.currency, base, occurredAt)

    return client.ledgerEntry.create({
      data: {
        id: newLedgerId(),
        propertyId: input.propertyId,
        partyId: input.partyId ?? null,
        unitId: input.unitId ?? null,
        direction: input.direction,
        kind: input.kind,
        amountMinor: input.amountMinor,
        currency: input.currency,
        fxRateToBase: new Prisma.Decimal(fx),
        baseCurrency: base,
        description: input.description,
        occurredAt,
        leaseId: input.leaseId ?? null,
        reservationId: input.reservationId ?? null,
        chargeId: input.chargeId ?? null,
        statementId: input.statementId ?? null,
        createdById: input.actorUserId ?? null,
      },
    })
  }

  return tx ? run(tx) : db.$transaction(run, TX_OPTS)
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type Balance = { currency: Currency; minor: number }

/**
 * What a party owes, per currency. Positive means they owe ABN.
 * Reversals cancel out naturally because they carry the opposite direction.
 */
export async function partyBalance(partyId: string): Promise<Balance[]> {
  const rows = await db.ledgerEntry.groupBy({
    by: ['currency', 'direction'],
    where: { partyId },
    _sum: { amountMinor: true },
  })

  const totals = new Map<Currency, number>()
  for (const row of rows) {
    const signed = row.direction === 'DEBIT' ? 1 : -1
    const current = totals.get(row.currency) ?? 0
    totals.set(row.currency, current + signed * (row._sum.amountMinor ?? 0))
  }

  return [...totals.entries()].map(([currency, minor]) => ({ currency, minor }))
}

export async function partyBalanceIn(partyId: string, currency: Currency): Promise<number> {
  const balances = await partyBalance(partyId)
  return balances.find((b) => b.currency === currency)?.minor ?? 0
}

export type StatementLine = {
  id: string
  occurredAt: Date
  description: string
  kind: LedgerKind
  direction: 'DEBIT' | 'CREDIT'
  amountMinor: number
  currency: Currency
  runningBalanceMinor: number
}

/** A party's account history with a running balance, oldest first. */
export async function partyStatement(
  partyId: string,
  options: { currency?: Currency; from?: Date; to?: Date } = {}
): Promise<StatementLine[]> {
  const entries = await db.ledgerEntry.findMany({
    where: {
      partyId,
      ...(options.currency ? { currency: options.currency } : {}),
      ...(options.from || options.to
        ? { occurredAt: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
        : {}),
    },
    orderBy: [{ occurredAt: 'asc' }, { postedAt: 'asc' }],
  })

  let running = 0
  return entries.map((e) => {
    running += (e.direction === 'DEBIT' ? 1 : -1) * e.amountMinor
    return {
      id: e.id,
      occurredAt: e.occurredAt,
      description: e.description,
      kind: e.kind,
      direction: e.direction,
      amountMinor: e.amountMinor,
      currency: e.currency,
      runningBalanceMinor: running,
    }
  })
}

/** How much of a charge is still unpaid. */
export async function chargeOutstanding(chargeId: string): Promise<number> {
  const charge = await db.charge.findUniqueOrThrow({
    where: { id: chargeId },
    include: { allocations: true },
  })
  if (charge.status === 'WAIVED' || charge.status === 'REVERSED') return 0
  const paid = charge.allocations.reduce((s, a) => s + a.amountMinor, 0)
  return Math.max(0, charge.amountMinor - paid)
}

/** Unallocated credit sitting on a party's account, ready for the next charge. */
export async function unappliedCredit(partyId: string, currency: Currency): Promise<number> {
  const payments = await db.payment.findMany({
    where: { partyId, currency, status: 'CONFIRMED' },
    include: { allocations: true },
  })
  return payments.reduce((total, p) => {
    const allocated = p.allocations.reduce((s, a) => s + a.amountMinor, 0)
    return total + (p.amountMinor - allocated)
  }, 0)
}
