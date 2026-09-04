/**
 * Arrears.
 *
 * Aging is computed from charges and their allocations rather than from a
 * stored balance, so it can never disagree with the ledger. A tenant sitting
 * on advance rent shows as current, because their charges are settled out of
 * that credit as each month falls due — which is the truth.
 */

import type { Currency } from '@prisma/client'
import { db } from '@/lib/db'
import { ageBucket, dateOnly, daysOverdue, type AgeBucket } from '@/lib/core/dates'
import { propertyWhere, type Actor } from '@/lib/rbac'

export type ArrearsRow = {
  partyId: string
  tenantName: string
  phone: string | null
  unitNames: string[]
  propertyName: string
  currency: Currency
  buckets: Record<AgeBucket, number>
  totalOutstandingMinor: number
  oldestDueDate: Date | null
  daysOverdue: number
}

export type ArrearsReport = {
  asOf: Date
  rows: ArrearsRow[]
  totalsByBucket: Record<AgeBucket, number>
  totalOutstandingMinor: number
  currency: Currency
  tenantsInArrears: number
}

const EMPTY_BUCKETS = (): Record<AgeBucket, number> => ({
  current: 0,
  '1-30': 0,
  '31-60': 0,
  '61-90': 0,
  '90+': 0,
})

export async function arrearsReport(options: {
  actor: Actor
  asOf?: Date
  propertyId?: string
  currency?: Currency
}): Promise<ArrearsReport> {
  const asOf = dateOnly(options.asOf ?? new Date())
  const currency = options.currency ?? 'GHS'

  const charges = await db.charge.findMany({
    where: {
      status: { in: ['OPEN', 'PART_PAID'] },
      currency,
      ...(options.propertyId ? { propertyId: options.propertyId } : propertyWhere(options.actor)),
    },
    include: {
      party: { select: { id: true, name: true, phone: true } },
      unit: { select: { name: true } },
      property: { select: { name: true } },
      allocations: true,
    },
    orderBy: { dueDate: 'asc' },
  })

  const byParty = new Map<string, ArrearsRow>()

  for (const charge of charges) {
    const outstanding =
      charge.amountMinor - charge.allocations.reduce((s, a) => s + a.amountMinor, 0)
    if (outstanding <= 0) continue

    const bucket = ageBucket(charge.dueDate, asOf)

    let row = byParty.get(charge.partyId)
    if (!row) {
      row = {
        partyId: charge.partyId,
        tenantName: charge.party.name,
        phone: charge.party.phone,
        unitNames: [],
        propertyName: charge.property.name,
        currency: charge.currency,
        buckets: EMPTY_BUCKETS(),
        totalOutstandingMinor: 0,
        oldestDueDate: null,
        daysOverdue: 0,
      }
      byParty.set(charge.partyId, row)
    }

    row.buckets[bucket] += outstanding
    row.totalOutstandingMinor += outstanding

    if (charge.unit?.name && !row.unitNames.includes(charge.unit.name)) {
      row.unitNames.push(charge.unit.name)
    }
    if (!row.oldestDueDate || charge.dueDate < row.oldestDueDate) {
      row.oldestDueDate = charge.dueDate
      row.daysOverdue = Math.max(0, daysOverdue(charge.dueDate, asOf))
    }
  }

  const rows = [...byParty.values()].sort(
    (a, b) => b.totalOutstandingMinor - a.totalOutstandingMinor
  )

  const totalsByBucket = EMPTY_BUCKETS()
  let totalOutstandingMinor = 0
  for (const row of rows) {
    for (const key of Object.keys(totalsByBucket) as AgeBucket[]) {
      totalsByBucket[key] += row.buckets[key]
    }
    totalOutstandingMinor += row.totalOutstandingMinor
  }

  return {
    asOf,
    rows,
    totalsByBucket,
    totalOutstandingMinor,
    currency,
    tenantsInArrears: rows.filter((r) => r.daysOverdue > 0).length,
  }
}

/**
 * Collection rate: of everything that fell due in a window, how much came in.
 * The number that tells an owner whether the building is being run well.
 */
export async function collectionRate(options: {
  actor: Actor
  from: Date
  to: Date
  currency?: Currency
  propertyId?: string
}): Promise<{
  chargedMinor: number
  collectedMinor: number
  rate: number
  currency: Currency
}> {
  const currency = options.currency ?? 'GHS'

  const charges = await db.charge.findMany({
    where: {
      currency,
      dueDate: { gte: dateOnly(options.from), lt: dateOnly(options.to) },
      status: { notIn: ['REVERSED', 'WAIVED'] },
      ...(options.propertyId ? { propertyId: options.propertyId } : propertyWhere(options.actor)),
    },
    include: { allocations: true },
  })

  const chargedMinor = charges.reduce((s, c) => s + c.amountMinor, 0)
  const collectedMinor = charges.reduce(
    (s, c) => s + c.allocations.reduce((a, x) => a + x.amountMinor, 0),
    0
  )

  return {
    chargedMinor,
    collectedMinor,
    rate: chargedMinor === 0 ? 1 : collectedMinor / chargedMinor,
    currency,
  }
}

/** Tenants with nothing outstanding and a credit balance — paid ahead. */
export async function tenantsInCredit(actor: Actor, currency: Currency = 'GHS') {
  const payments = await db.payment.findMany({
    where: {
      currency,
      status: 'CONFIRMED',
      party: { isTenant: true },
      ...propertyWhere(actor),
    },
    include: { allocations: true, party: { select: { id: true, name: true, phone: true } } },
  })

  const byParty = new Map<string, { name: string; phone: string | null; creditMinor: number }>()

  for (const payment of payments) {
    const unallocated =
      payment.amountMinor - payment.allocations.reduce((s, a) => s + a.amountMinor, 0)
    if (unallocated <= 0) continue

    const existing = byParty.get(payment.partyId)
    if (existing) {
      existing.creditMinor += unallocated
    } else {
      byParty.set(payment.partyId, {
        name: payment.party.name,
        phone: payment.party.phone,
        creditMinor: unallocated,
      })
    }
  }

  return [...byParty.entries()]
    .map(([partyId, v]) => ({ partyId, ...v, currency }))
    .sort((a, b) => b.creditMinor - a.creditMinor)
}
