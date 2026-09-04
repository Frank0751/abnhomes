/**
 * Owner statements.
 *
 * ABN manages its own buildings and other people's on the same rails, so every
 * property has a management agreement — ABN's own carry a zero fee. That way a
 * statement is produced by one code path and always reconciles.
 *
 * Two decisions worth knowing about:
 *
 *   REVENUE IS RECOGNISED WHEN EARNED, not when the money arrived. A tenant
 *   who paid two years up front does not hand the owner two years of income in
 *   one month. The statement follows charges raised, which the rent run
 *   spreads correctly across the term.
 *
 *   STATEMENTS ARE PRODUCED IN THE REPORTING BASE CURRENCY. A building can
 *   earn dollars from guests and cedis from tenants in the same month, so each
 *   entry is converted using the rate captured when it was posted — never
 *   today's rate applied to old history.
 */

import type { Currency, StatementStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { baseCurrency, postEntry } from '@/lib/core/ledger'
import { statementCode } from '@/lib/core/ids'
import { dateOnly, formatDate } from '@/lib/core/dates'
import { applyBasisPoints, formatMinor } from '@/lib/core/money'

/** Charge types that are liabilities, not revenue. */
const NON_REVENUE_TYPES = ['SECURITY_DEPOSIT'] as const

export type StatementLine = {
  date: string
  description: string
  category: 'revenue' | 'expense' | 'fee'
  grossMinor: number
  currency: Currency
  /** The same amount converted into the reporting currency. */
  baseMinor: number
}

export type ComputedStatement = {
  propertyId: string
  propertyName: string
  ownerPartyId: string
  ownerName: string
  periodStart: Date
  periodEnd: Date
  currency: Currency
  grossRevenueMinor: number
  managementFeeMinor: number
  feeBasisPoints: number
  expensesMinor: number
  netPayableMinor: number
  lines: StatementLine[]
}

function toBase(minor: number, rate: number): number {
  return Math.round(minor * rate)
}

/**
 * Work out what an owner is due for a period, without writing anything.
 * Used for the preview screen and by `issueStatement`.
 */
export async function computeStatement(args: {
  propertyId: string
  periodStart: Date
  periodEnd: Date
}): Promise<ComputedStatement> {
  const periodStart = dateOnly(args.periodStart)
  const periodEnd = dateOnly(args.periodEnd)
  const currency = baseCurrency()

  const property = await db.property.findUniqueOrThrow({
    where: { id: args.propertyId },
    include: {
      owner: true,
      agreements: { where: { active: true }, orderBy: { startDate: 'desc' }, take: 1 },
    },
  })

  const agreement = property.agreements[0]
  const feeBasisPoints = agreement?.feeBasisPoints ?? 0
  const deductExpenses = agreement?.deductExpenses ?? true

  // Revenue: charges raised for this property in the period, less anything
  // reversed or waived, and excluding deposits which are not income.
  const charges = await db.charge.findMany({
    where: {
      propertyId: args.propertyId,
      dueDate: { gte: periodStart, lt: periodEnd },
      status: { notIn: ['REVERSED', 'WAIVED'] },
      type: { notIn: [...NON_REVENUE_TYPES] },
    },
    include: { ledgerEntries: { where: { kind: 'CHARGE' }, take: 1 } },
    orderBy: { dueDate: 'asc' },
  })

  const lines: StatementLine[] = []
  let grossRevenueMinor = 0

  for (const charge of charges) {
    const rate = Number(charge.ledgerEntries[0]?.fxRateToBase ?? 1)
    const baseMinor = toBase(charge.amountMinor, rate)
    grossRevenueMinor += baseMinor

    lines.push({
      date: formatDate(charge.dueDate),
      description: charge.description,
      category: 'revenue',
      grossMinor: charge.amountMinor,
      currency: charge.currency,
      baseMinor,
    })
  }

  // Expenses booked against the property in the period.
  const expenses = await db.ledgerEntry.findMany({
    where: {
      propertyId: args.propertyId,
      kind: 'EXPENSE',
      occurredAt: { gte: periodStart, lt: periodEnd },
    },
    orderBy: { occurredAt: 'asc' },
  })

  let expensesMinor = 0
  for (const expense of expenses) {
    const baseMinor = toBase(expense.amountMinor, Number(expense.fxRateToBase))
    expensesMinor += baseMinor

    lines.push({
      date: formatDate(expense.occurredAt),
      description: expense.description,
      category: 'expense',
      grossMinor: expense.amountMinor,
      currency: expense.currency,
      baseMinor,
    })
  }

  const managementFeeMinor = applyBasisPoints(
    { minor: grossRevenueMinor, currency },
    feeBasisPoints
  ).minor

  if (managementFeeMinor > 0) {
    lines.push({
      date: formatDate(periodEnd),
      description: `ABN Homes management fee (${(feeBasisPoints / 100).toFixed(feeBasisPoints % 100 === 0 ? 0 : 2)}% of ${formatMinor(grossRevenueMinor, currency)})`,
      category: 'fee',
      grossMinor: managementFeeMinor,
      currency,
      baseMinor: managementFeeMinor,
    })
  }

  const netPayableMinor =
    grossRevenueMinor - managementFeeMinor - (deductExpenses ? expensesMinor : 0)

  return {
    propertyId: property.id,
    propertyName: property.name,
    ownerPartyId: property.ownerPartyId,
    ownerName: property.owner.name,
    periodStart,
    periodEnd,
    currency,
    grossRevenueMinor,
    managementFeeMinor,
    feeBasisPoints,
    expensesMinor,
    netPayableMinor,
    lines,
  }
}

/**
 * Freeze a statement and post its consequences to the ledger: the management
 * fee ABN has earned, and the balance now owed to the owner.
 *
 * The line detail is stored as it stood at issue, so reopening a statement
 * from two years ago shows what the owner was actually sent — not a
 * recalculation against data that has since moved.
 */
export async function issueStatement(args: {
  propertyId: string
  periodStart: Date
  periodEnd: Date
  actorUserId?: string | null
  notes?: string | null
}) {
  const computed = await computeStatement(args)

  return db.$transaction(async (tx) => {
    const existing = await tx.ownerStatement.findUnique({
      where: {
        propertyId_periodStart_periodEnd: {
          propertyId: computed.propertyId,
          periodStart: computed.periodStart,
          periodEnd: computed.periodEnd,
        },
      },
    })

    if (existing && existing.status !== 'DRAFT') {
      throw new Error(
        `A statement for ${computed.propertyName} covering ${formatDate(computed.periodStart)} to ${formatDate(computed.periodEnd)} has already been issued.`
      )
    }

    const data = {
      propertyId: computed.propertyId,
      ownerPartyId: computed.ownerPartyId,
      periodStart: computed.periodStart,
      periodEnd: computed.periodEnd,
      currency: computed.currency,
      grossRevenueMinor: computed.grossRevenueMinor,
      managementFeeMinor: computed.managementFeeMinor,
      expensesMinor: computed.expensesMinor,
      netPayableMinor: computed.netPayableMinor,
      status: 'ISSUED' as StatementStatus,
      issuedAt: new Date(),
      lines: computed.lines as never,
      notes: args.notes ?? null,
    }

    const statement = existing
      ? await tx.ownerStatement.update({ where: { id: existing.id }, data })
      : await tx.ownerStatement.create({ data: { ...data, code: statementCode() } })

    // The fee ABN has earned from this property.
    if (computed.managementFeeMinor > 0) {
      await postEntry(
        {
          propertyId: computed.propertyId,
          partyId: computed.ownerPartyId,
          direction: 'DEBIT',
          kind: 'MANAGEMENT_FEE',
          amountMinor: computed.managementFeeMinor,
          currency: computed.currency,
          description: `Management fee — ${formatDate(computed.periodStart)} to ${formatDate(computed.periodEnd)}`,
          occurredAt: computed.periodEnd,
          statementId: statement.id,
          actorUserId: args.actorUserId,
        },
        tx
      )
    }

    // What ABN now owes the owner. A credit, because we hold their money.
    if (computed.netPayableMinor > 0) {
      await postEntry(
        {
          propertyId: computed.propertyId,
          partyId: computed.ownerPartyId,
          direction: 'CREDIT',
          kind: 'OWNER_PAYOUT',
          amountMinor: computed.netPayableMinor,
          currency: computed.currency,
          description: `Net due to owner — statement ${statement.code}`,
          occurredAt: computed.periodEnd,
          statementId: statement.id,
          actorUserId: args.actorUserId,
        },
        tx
      )
    }

    return statement
  })
}

export async function markStatementPaid(statementId: string, actorUserId?: string | null) {
  return db.$transaction(async (tx) => {
    const statement = await tx.ownerStatement.update({
      where: { id: statementId },
      data: { status: 'PAID', paidAt: new Date() },
    })

    // Settles the liability created at issue.
    await postEntry(
      {
        propertyId: statement.propertyId,
        partyId: statement.ownerPartyId,
        direction: 'DEBIT',
        kind: 'OWNER_PAYOUT',
        amountMinor: statement.netPayableMinor,
        currency: statement.currency,
        description: `Payout made to owner — statement ${statement.code}`,
        statementId: statement.id,
        actorUserId,
      },
      tx
    )

    return statement
  })
}

/** Every property that should have a statement for a period but does not yet. */
export async function statementsOutstanding(periodStart: Date, periodEnd: Date) {
  const properties = await db.property.findMany({
    where: { active: true },
    include: {
      owner: { select: { name: true } },
      statements: {
        where: { periodStart: dateOnly(periodStart), periodEnd: dateOnly(periodEnd) },
      },
    },
  })

  return properties
    .filter((p) => p.statements.length === 0)
    .map((p) => ({ id: p.id, name: p.name, ownerName: p.owner.name }))
}
