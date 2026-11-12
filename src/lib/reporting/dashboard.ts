/**
 * The management dashboard.
 *
 * Every series here answers one management question:
 *   - "is the business earning?"        -> revenue trend (all money in)
 *   - "are the rooms working?"          -> occupancy by property
 *   - "where do guests come from?"      -> booking channel mix
 *   - "is the funnel leaking?"          -> application funnel, rent + sales
 *   - "who owes us money?"              -> arrears, from the ledger
 *
 * Figures come from the same tables the ledger guards, so a chart and a
 * statement can never disagree.
 */

import { db } from '@/lib/db'
import { dateOnly } from '@/lib/core/dates'

export type RevenuePoint = { month: string; revenueMinor: number; payments: number }

export async function revenueTrend(months = 9): Promise<RevenuePoint[]> {
  const since = new Date()
  since.setMonth(since.getMonth() - (months - 1))
  since.setDate(1)
  since.setHours(0, 0, 0, 0)

  // Money in = CREDIT ledger entries of kind PAYMENT, confirmed by posting.
  const entries = await db.ledgerEntry.findMany({
    where: { kind: 'PAYMENT', direction: 'CREDIT', occurredAt: { gte: since } },
    select: { amountMinor: true, currency: true, occurredAt: true, fxRateToBase: true },
    orderBy: { occurredAt: 'asc' },
  })

  const byMonth = new Map<string, { revenueMinor: number; payments: number }>()
  for (const e of entries) {
    const key = `${e.occurredAt.getFullYear()}-${String(e.occurredAt.getMonth() + 1).padStart(2, '0')}`
    const bucket = byMonth.get(key) ?? { revenueMinor: 0, payments: 0 }
    // Normalise to the reporting base so mixed-currency months still sum honestly.
    bucket.revenueMinor += Math.round(e.amountMinor * Number(e.fxRateToBase))
    bucket.payments += 1
    byMonth.set(key, bucket)
  }

  // Fill empty months so the line shows silence as silence, not a gap.
  const out: RevenuePoint[] = []
  const cursor = new Date(since)
  for (let i = 0; i < months; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const bucket = byMonth.get(key)
    out.push({ month: key, revenueMinor: bucket?.revenueMinor ?? 0, payments: bucket?.payments ?? 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return out
}

export type OccupancyBar = { property: string; occupancy: number; nightsSold: number }

export async function occupancyByProperty(from: Date, to: Date): Promise<OccupancyBar[]> {
  const fromD = dateOnly(from)
  const toD = dateOnly(to)
  const periodNights = Math.max(1, Math.round((toD.getTime() - fromD.getTime()) / 86400_000))

  // Same definition as the reports page: nights actually stayed (clipped to
  // the window) over nights the letting inventory could have sold.
  const units = await db.unit.findMany({
    where: { lettingMode: { in: ['SHORT_STAY', 'BOTH'] }, status: { notIn: ['OFF_MARKET', 'MAINTENANCE', 'SOLD'] } },
    select: { propertyId: true, property: { select: { name: true } } },
  })
  const reservations = await db.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      checkIn: { lt: toD },
      checkOut: { gt: fromD },
    },
    select: { checkIn: true, checkOut: true, unit: { select: { propertyId: true } } },
  })

  const available = new Map<string, { name: string; units: number }>()
  for (const u of units) {
    available.set(u.propertyId, { name: u.property.name, units: (available.get(u.propertyId)?.units ?? 0) + 1 })
  }

  const sold = new Map<string, number>()
  for (const r of reservations) {
    const start = r.checkIn > fromD ? r.checkIn : fromD
    const end = r.checkOut < toD ? r.checkOut : toD
    const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400_000))
    sold.set(r.unit.propertyId, (sold.get(r.unit.propertyId) ?? 0) + nights)
  }

  return [...available.entries()]
    .map(([propertyId, { name, units: n }]) => {
      const nightsSold = sold.get(propertyId) ?? 0
      return {
        property: name,
        nightsSold,
        occupancy: n > 0 ? Math.min(1, nightsSold / (n * periodNights)) : 0,
      }
    })
    .sort((a, b) => b.occupancy - a.occupancy)
}

export type FunnelStep = { stage: string; count: number }

export async function applicationFunnel(): Promise<{
  tenancy: FunnelStep[]
  sales: FunnelStep[]
}> {
  const [tenancyByStatus, purchaseByStatus] = await Promise.all([
    db.tenancyApplication.groupBy({ by: ['status'], _count: { id: true } }),
    db.purchase.groupBy({ by: ['status'], _count: { id: true } }),
  ])

  const pick = (rows: { status: string; _count: { id: number } }[], keys: string[], labels: string[]) =>
    labels.map((label, i) => ({
      stage: label,
      count: rows.find((r) => r.status === keys[i])?._count.id ?? 0,
    }))

  return {
    tenancy: pick(
      tenancyByStatus,
      ['NEW', 'SCREENING', 'APPROVED', 'CONVERTED'],
      ['Applied', 'Screening', 'Approved', 'Living here']
    ),
    sales: pick(
      purchaseByStatus,
      ['APPLICATION', 'APPROVED', 'CONTRACTED', 'COMPLETED'],
      ['Offer', 'Approved', 'Contracted', 'Own it']
    ),
  }
}

export type DashboardData = {
  revenue: RevenuePoint[]
  occupancy: OccupancyBar[]
  tenancyFunnel: FunnelStep[]
  salesFunnel: FunnelStep[]
  sourceMix: { source: string; count: number }[]
  kpis: {
    monthRevenueMinor: number
    monthPayments: number
    activeLeases: number
    openApplications: number
    purchasesInFlight: number
    arrearsMinor: number
    occupancy: number
  }
}

export async function dashboardData(args: { from: Date; to: Date }): Promise<DashboardData> {
  const [revenue, occupancy, funnel, report, activeLeases, tenancyOpen, purchaseOpen] =
    await Promise.all([
      revenueTrend(9),
      occupancyByProperty(args.from, args.to),
      applicationFunnel(),
      // Source mix over the period only — cheap aggregate on reservations.
      db.reservation.groupBy({
        by: ['source'],
        where: { createdAt: { gte: dateOnly(args.from), lte: dateOnly(args.to) } },
        _count: { id: true },
      }),
      db.lease.count({ where: { status: 'ACTIVE' } }),
      db.tenancyApplication.count({ where: { status: { in: ['NEW', 'SCREENING', 'APPROVED'] } } }),
      db.purchase.count({ where: { status: { in: ['APPLICATION', 'APPROVED', 'CONTRACTED'] } } }),
    ])

  // This month's collections: the last point of the trend — one definition,
  // one code path. (A separate aggregate here would multiply summed fx rates
  // by summed amounts, which is how dashboards start lying.)
  const thisMonth = revenue[revenue.length - 1]

  // Arrears, properly: open charges minus what has been allocated to them.
  const openCharges = await db.charge.aggregate({
    where: { status: { in: ['OPEN', 'PART_PAID'] }, currency: 'GHS' },
    _sum: { amountMinor: true },
  })
  const chargeIds = await db.charge.findMany({
    where: { status: { in: ['OPEN', 'PART_PAID'] } },
    select: { id: true },
  })
  const allocations = await db.allocation.aggregate({
    where: { chargeId: { in: chargeIds.map((c) => c.id) } },
    _sum: { amountMinor: true },
  })

  return {
    revenue,
    occupancy,
    tenancyFunnel: funnel.tenancy,
    salesFunnel: funnel.sales,
    sourceMix: report.map((r) => ({ source: r.source, count: r._count.id })),
    kpis: {
      monthRevenueMinor: thisMonth?.revenueMinor ?? 0,
      monthPayments: thisMonth?.payments ?? 0,
      activeLeases,
      openApplications: tenancyOpen + purchaseOpen,
      purchasesInFlight: purchaseOpen,
      arrearsMinor: Math.max(0, (openCharges._sum.amountMinor ?? 0) - (allocations._sum.amountMinor ?? 0)),
      occupancy: occupancy.length > 0 ? occupancy.reduce((s, o) => s + o.occupancy, 0) / occupancy.length : 0,
    },
  }
}
