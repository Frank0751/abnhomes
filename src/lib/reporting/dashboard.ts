/**
 * The management dashboard.
 *
 * Every series here answers one management question:
 *   - "is the business earning?"        -> revenue trend + window vs previous window
 *   - "are the rooms working?"          -> occupancy by property and by month
 *   - "where do guests come from?"      -> booking channel mix, with value
 *   - "is demand growing?"              -> booking pace (created per month)
 *   - "is the funnel leaking?"          -> application funnel, rent + sales
 *   - "who owes us money, how late?"    -> arrears, aged from the ledger
 *   - "which homes carry the portfolio?"-> top performers
 *
 * Figures come from the same tables the ledger guards, so a chart and a
 * statement can never disagree.
 */

import { db } from '@/lib/db'
import { ageBucket, dateOnly, type AgeBucket } from '@/lib/core/dates'

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

/** Confirmed payments posted inside a window, normalised to base currency. */
async function windowRevenue(from: Date, to: Date): Promise<number> {
  const agg = await db.ledgerEntry.findMany({
    where: { kind: 'PAYMENT', direction: 'CREDIT', occurredAt: { gte: from, lt: to } },
    select: { amountMinor: true, fxRateToBase: true },
  })
  return agg.reduce((s, e) => s + Math.round(e.amountMinor * Number(e.fxRateToBase)), 0)
}

export type OccupancyBar = { property: string; occupancy: number; nightsSold: number }

export async function occupancyByProperty(
  from: Date,
  to: Date,
  propertyId?: string
): Promise<OccupancyBar[]> {
  const fromD = dateOnly(from)
  const toD = dateOnly(to)
  const periodNights = Math.max(1, Math.round((toD.getTime() - fromD.getTime()) / 86400_000))

  // Same definition as the reports page: nights actually stayed (clipped to
  // the window) over nights the letting inventory could have sold.
  const units = await db.unit.findMany({
    where: {
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      status: { notIn: ['OFF_MARKET', 'MAINTENANCE', 'SOLD'] },
      ...(propertyId ? { propertyId } : {}),
    },
    select: { propertyId: true, property: { select: { name: true } } },
  })
  const reservations = await db.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      checkIn: { lt: toD },
      checkOut: { gt: fromD },
      ...(propertyId ? { unit: { propertyId } } : {}),
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
    .map(([pid, { name, units: n }]) => {
      const nightsSold = sold.get(pid) ?? 0
      return {
        property: name,
        nightsSold,
        occupancy: n > 0 ? Math.min(1, nightsSold / (n * periodNights)) : 0,
      }
    })
    .sort((a, b) => b.occupancy - a.occupancy)
}

export type OccupancyMonth = { month: string; occupancy: number; nightsSold: number }

/**
 * Occupancy by month across the window — the trend, not the snapshot. A month
 * partially inside the window counts only the nights of it that fall inside.
 */
export async function occupancyTrend(
  from: Date,
  to: Date,
  propertyId?: string
): Promise<OccupancyMonth[]> {
  const fromD = dateOnly(from)
  const toD = dateOnly(to)

  const units = await db.unit.findMany({
    where: {
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      status: { notIn: ['OFF_MARKET', 'MAINTENANCE', 'SOLD'] },
      ...(propertyId ? { propertyId } : {}),
    },
    select: { id: true },
  })
  const unitCount = units.length
  if (unitCount === 0) return []

  const reservations = await db.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      checkIn: { lt: toD },
      checkOut: { gt: fromD },
      ...(propertyId ? { unit: { propertyId } } : {}),
    },
    select: { checkIn: true, checkOut: true },
  })

  const byMonth = new Map<string, number>()
  const months: string[] = []
  const cursor = new Date(fromD)
  while (cursor < toD) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
    cursor.setMonth(cursor.getMonth() + 1)
    cursor.setDate(1)
  }

  for (const r of reservations) {
    const start = r.checkIn > fromD ? r.checkIn : fromD
    const end = r.checkOut < toD ? r.checkOut : toD
    const c = new Date(start)
    while (c < end) {
      const key = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}`
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
      c.setDate(c.getDate() + 1)
    }
  }

  // Nights available per month = units × days of that month inside the window.
  const daysInWindowPerMonth = new Map<string, number>()
  for (const m of months) daysInWindowPerMonth.set(m, 0)
  const c2 = new Date(fromD)
  while (c2 < toD) {
    const key = `${c2.getFullYear()}-${String(c2.getMonth() + 1).padStart(2, '0')}`
    daysInWindowPerMonth.set(key, (daysInWindowPerMonth.get(key) ?? 0) + 1)
    c2.setDate(c2.getDate() + 1)
  }

  return months.map((month) => {
    const nightsSold = byMonth.get(month) ?? 0
    const available = (daysInWindowPerMonth.get(month) ?? 0) * unitCount
    return { month, nightsSold, occupancy: available > 0 ? Math.min(1, nightsSold / available) : 0 }
  })
}

export type PaceMonth = { month: string; bookings: number; cancelled: number }

/** Bookings created per month inside the window — the pace of new demand. */
export async function bookingPace(
  from: Date,
  to: Date,
  propertyId?: string
): Promise<PaceMonth[]> {
  const created = await db.reservation.findMany({
    where: {
      createdAt: { gte: dateOnly(from), lte: dateOnly(to) },
      status: { notIn: ['INQUIRY'] },
      ...(propertyId ? { unit: { propertyId } } : {}),
    },
    select: { createdAt: true, status: true },
  })

  const byMonth = new Map<string, { bookings: number; cancelled: number }>()
  for (const r of created) {
    const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`
    const bucket = byMonth.get(key) ?? { bookings: 0, cancelled: 0 }
    if (r.status === 'CANCELLED') bucket.cancelled += 1
    else bucket.bookings += 1
    byMonth.set(key, bucket)
  }

  const out: PaceMonth[] = []
  const cursor = new Date(dateOnly(from))
  const end = dateOnly(to)
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const bucket = byMonth.get(key)
    out.push({ month: key, bookings: bucket?.bookings ?? 0, cancelled: bucket?.cancelled ?? 0 })
    cursor.setMonth(cursor.getMonth() + 1)
    cursor.setDate(1)
  }
  return out
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

export type TopUnit = {
  unitId: string
  unitName: string
  propertyName: string
  nightsSold: number
  occupancy: number
  revenueMinor: number
  adrMinor: number
}

/** The homes that carried the window, by clipped revenue inside it. */
export async function topUnits(
  from: Date,
  to: Date,
  propertyId?: string,
  limit = 6
): Promise<TopUnit[]> {
  const fromD = dateOnly(from)
  const toD = dateOnly(to)
  const periodNights = Math.max(1, Math.round((toD.getTime() - fromD.getTime()) / 86400_000))

  const units = await db.unit.findMany({
    where: {
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      status: { notIn: ['OFF_MARKET'] },
      ...(propertyId ? { propertyId } : {}),
    },
    select: { id: true, name: true, property: { select: { name: true } } },
  })
  const unitIds = units.map((u) => u.id)

  const reservations = await db.reservation.findMany({
    where: {
      unitId: { in: unitIds },
      checkIn: { lt: toD },
      checkOut: { gt: fromD },
      status: { notIn: ['INQUIRY', 'CANCELLED'] },
    },
    select: { unitId: true, nights: true, checkIn: true, checkOut: true, totalMinor: true },
  })

  const perUnit = new Map<string, { nights: number; revenueMinor: number }>()
  for (const r of reservations) {
    const start = r.checkIn > fromD ? r.checkIn : fromD
    const end = r.checkOut < toD ? r.checkOut : toD
    const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400_000))
    if (nights === 0) continue
    const nightly = Math.round(r.totalMinor / Math.max(r.nights, 1))
    const agg = perUnit.get(r.unitId) ?? { nights: 0, revenueMinor: 0 }
    agg.nights += nights
    agg.revenueMinor += nightly * nights
    perUnit.set(r.unitId, agg)
  }

  return units
    .map((u) => {
      const agg = perUnit.get(u.id) ?? { nights: 0, revenueMinor: 0 }
      return {
        unitId: u.id,
        unitName: u.name,
        propertyName: u.property.name,
        nightsSold: agg.nights,
        occupancy: agg.nights / periodNights,
        revenueMinor: agg.revenueMinor,
        adrMinor: agg.nights > 0 ? Math.round(agg.revenueMinor / agg.nights) : 0,
      }
    })
    .filter((u) => u.revenueMinor > 0 || u.nightsSold > 0)
    .sort((a, b) => b.revenueMinor - a.revenueMinor)
    .slice(0, limit)
}

export type ArrearsBucket = { bucket: AgeBucket; label: string; minor: number }

/** Open GHS charges (minus allocations to each charge), aged by due date. */
export async function arrearsAging(): Promise<ArrearsBucket[]> {
  const charges = await db.charge.findMany({
    where: { status: { in: ['OPEN', 'PART_PAID'] }, currency: 'GHS' },
    select: { id: true, amountMinor: true, dueDate: true },
  })
  if (charges.length === 0) return []

  const allocations = await db.allocation.groupBy({
    by: ['chargeId'],
    where: { chargeId: { in: charges.map((c) => c.id) } },
    _sum: { amountMinor: true },
  })
  const allocated = new Map(allocations.map((a) => [a.chargeId, a._sum.amountMinor ?? 0]))

  const LABELS: Record<AgeBucket, string> = {
    current: 'Not yet due',
    '1-30': '1–30 days late',
    '31-60': '31–60 days late',
    '61-90': '61–90 days late',
    '90+': '90+ days late',
  }
  const ORDER: AgeBucket[] = ['current', '1-30', '31-60', '61-90', '90+']
  const totals = new Map<AgeBucket, number>()
  for (const c of charges) {
    const remaining = c.amountMinor - (allocated.get(c.id) ?? 0)
    if (remaining <= 0) continue
    const bucket = ageBucket(c.dueDate)
    totals.set(bucket, (totals.get(bucket) ?? 0) + remaining)
  }
  return ORDER.map((bucket) => ({
    bucket,
    label: LABELS[bucket],
    minor: totals.get(bucket) ?? 0,
  }))
}

export type DashboardData = {
  revenue: RevenuePoint[]
  occupancy: OccupancyBar[]
  occupancyTrend: OccupancyMonth[]
  bookingPace: PaceMonth[]
  topUnits: TopUnit[]
  arrearsAging: ArrearsBucket[]
  tenancyFunnel: FunnelStep[]
  salesFunnel: FunnelStep[]
  sourceMix: { source: string; count: number; valueMinor: number | null }[]
  kpis: {
    windowRevenueMinor: number
    prevWindowRevenueMinor: number
    monthRevenueMinor: number
    monthPayments: number
    occupancy: number
    prevOccupancy: number
    bookings: number
    prevBookings: number
    activeLeases: number
    openApplications: number
    purchasesInFlight: number
    arrearsMinor: number
  }
}

export async function dashboardData(args: {
  from: Date
  to: Date
  propertyId?: string
}): Promise<DashboardData> {
  const fromD = dateOnly(args.from)
  const toD = dateOnly(args.to)
  const windowDays = Math.max(1, Math.round((toD.getTime() - fromD.getTime()) / 86400_000))
  const prevFrom = new Date(fromD)
  prevFrom.setDate(prevFrom.getDate() - windowDays)
  const prevTo = fromD

  const [
    revenue,
    occupancy,
    occTrend,
    pace,
    funnel,
    sourceRows,
    top,
    aging,
    activeLeases,
    tenancyOpen,
    purchaseOpen,
    prevOccupancyBars,
  ] = await Promise.all([
    revenueTrend(9),
    occupancyByProperty(args.from, args.to, args.propertyId),
    occupancyTrend(args.from, args.to, args.propertyId),
    bookingPace(args.from, args.to, args.propertyId),
    applicationFunnel(),
    // Source mix over the period only — created bookings, with value.
    db.reservation.findMany({
      where: {
        createdAt: { gte: fromD, lte: toD },
        status: { notIn: ['INQUIRY'] },
        ...(args.propertyId ? { unit: { propertyId: args.propertyId } } : {}),
      },
      select: { source: true, totalMinor: true, status: true, currency: true },
    }),
    topUnits(args.from, args.to, args.propertyId),
    arrearsAging(),
    db.lease.count({ where: { status: 'ACTIVE' } }),
    db.tenancyApplication.count({ where: { status: { in: ['NEW', 'SCREENING', 'APPROVED'] } } }),
    db.purchase.count({ where: { status: { in: ['APPLICATION', 'APPROVED', 'CONTRACTED'] } } }),
    occupancyByProperty(prevFrom, prevTo, args.propertyId),
  ])

  // Channel value only sums cleanly in one currency; with a mix we show
  // counts alone rather than a number that would be wrong.
  const currencies = new Set(sourceRows.map((r) => r.currency))
  const sourceAgg = new Map<string, { count: number; valueMinor: number }>()
  for (const r of sourceRows) {
    const agg = sourceAgg.get(r.source) ?? { count: 0, valueMinor: 0 }
    agg.count++
    if (r.status !== 'CANCELLED') agg.valueMinor += r.totalMinor
    sourceAgg.set(r.source, agg)
  }
  const sourceMix = [...sourceAgg.entries()]
    .map(([source, agg]) => ({
      source,
      count: agg.count,
      valueMinor: currencies.size === 1 && currencies.has('GHS') ? agg.valueMinor : null,
    }))
    .sort((a, b) => b.count - a.count)

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

  const [windowRevenueMinor, prevWindowRevenueMinor] = await Promise.all([
    windowRevenue(fromD, toD),
    windowRevenue(prevFrom, prevTo),
  ])

  const avgOcc = (bars: OccupancyBar[]) =>
    bars.length > 0 ? bars.reduce((s, o) => s + o.occupancy, 0) / bars.length : 0

  const bookings = sourceMix.reduce((s, m) => s + m.count, 0)
  const prevSourceRows = await db.reservation.count({
    where: {
      createdAt: { gte: prevFrom, lte: prevTo },
      status: { notIn: ['INQUIRY'] },
      ...(args.propertyId ? { unit: { propertyId: args.propertyId } } : {}),
    },
  })

  return {
    revenue,
    occupancy,
    occupancyTrend: occTrend,
    bookingPace: pace,
    topUnits: top,
    arrearsAging: aging,
    tenancyFunnel: funnel.tenancy,
    salesFunnel: funnel.sales,
    sourceMix,
    kpis: {
      windowRevenueMinor,
      prevWindowRevenueMinor,
      monthRevenueMinor: thisMonth?.revenueMinor ?? 0,
      monthPayments: thisMonth?.payments ?? 0,
      occupancy: avgOcc(occupancy),
      prevOccupancy: avgOcc(prevOccupancyBars),
      bookings,
      prevBookings: prevSourceRows,
      activeLeases,
      openApplications: tenancyOpen + purchaseOpen,
      purchasesInFlight: purchaseOpen,
      arrearsMinor: Math.max(0, (openCharges._sum.amountMinor ?? 0) - (allocations._sum.amountMinor ?? 0)),
    },
  }
}
