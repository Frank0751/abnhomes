/**
 * Portfolio analytics — one definition of each number, used by the reports
 * page, the CSV exports and the owner statements alike. When the same figure
 * appears in three places, it is because it was computed in one.
 */

import { db } from '@/lib/db'
import { dateOnly, nightsBetween } from '@/lib/core/dates'

export type PeriodReport = {
  from: Date
  to: Date
  nightsAvailable: number
  nightsSold: number
  occupancy: number // 0..1
  accommodationMinor: number
  extrasMinor: number
  revenueMinor: number
  adr: number // average daily rate, minor units
  revPAR: number // revenue per available night, minor units
  bookings: number
  cancellations: number
  cancellationRate: number
  averageLeadDays: number | null
  sourceMix: { source: string; count: number; valueMinor: number }[]
  monthly: { month: string; revenueMinor: number; nights: number }[]
  byUnit: {
    unitId: string
    unitName: string
    propertyName: string
    nightsSold: number
    nightsAvailable: number
    occupancy: number
    revenueMinor: number
    adr: number
  }[]
}

export async function portfolioReport(args: {
  from: Date
  to: Date
  propertyId?: string
}): Promise<PeriodReport> {
  const from = dateOnly(args.from)
  const to = dateOnly(args.to)
  const periodNights = Math.max(nightsBetween(from, to), 1)

  const units = await db.unit.findMany({
    where: {
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      status: { not: 'OFF_MARKET' },
      ...(args.propertyId ? { propertyId: args.propertyId } : {}),
    },
    include: { property: { select: { id: true, name: true } } },
  })
  const unitIds = units.map((u) => u.id)
  const nightsAvailable = units.length * periodNights

  const reservations = await db.reservation.findMany({
    where: {
      unitId: { in: unitIds },
      checkIn: { lt: to },
      checkOut: { gt: from },
      status: { notIn: ['INQUIRY'] },
    },
    select: {
      id: true,
      unitId: true,
      nights: true,
      checkIn: true,
      checkOut: true,
      createdAt: true,
      status: true,
      source: true,
      totalMinor: true,
      currency: true,
      cleaningFeeMinor: true,
    },
  })

  // Count sold nights within the window only (clipped to the period).
  let nightsSold = 0
  let revenueMinor = 0
  const perUnit = new Map<string, { nights: number; revenueMinor: number }>()
  let cancellations = 0
  let leadTotal = 0
  let leadCount = 0

  for (const r of reservations) {
    if (r.status === 'CANCELLED') {
      cancellations++
      continue
    }
    const start = r.checkIn < from ? from : r.checkIn
    const end = r.checkOut > to ? to : r.checkOut
    const nights = Math.max(nightsBetween(start, end), 0)
    if (nights === 0) continue
    const nightly = Math.round(r.totalMinor / Math.max(r.nights, 1))
    const revenue = nightly * nights
    nightsSold += nights
    revenueMinor += revenue
    const agg = perUnit.get(r.unitId) ?? { nights: 0, revenueMinor: 0 }
    agg.nights += nights
    agg.revenueMinor += revenue
    perUnit.set(r.unitId, agg)
    if (r.checkIn >= from && r.checkIn < to) {
      leadTotal += Math.round((r.checkIn.getTime() - r.createdAt.getTime()) / 86_400_000)
      leadCount++
    }
  }

  // Extras (cleaning + add-on charges) recorded in the period.
  const extras = await db.charge.aggregate({
    where: {
      type: { in: ['CLEANING_FEE', 'ADD_ON'] },
      dueDate: { gte: from, lt: to },
      unitId: { in: unitIds },
      status: { not: 'REVERSED' },
    },
    _sum: { amountMinor: true },
  })

  // GBV and source mix across bookings created in the window.
  const created = await db.reservation.findMany({
    where: {
      unitId: { in: unitIds },
      createdAt: { gte: from, lt: to },
      status: { notIn: ['INQUIRY'] },
    },
    select: { source: true, totalMinor: true, currency: true, status: true, checkOut: true },
  })
  const sourceAgg = new Map<string, { count: number; valueMinor: number }>()
  for (const r of created) {
    const agg = sourceAgg.get(r.source) ?? { count: 0, valueMinor: 0 }
    agg.count++
    agg.valueMinor += r.status === 'CANCELLED' ? 0 : r.totalMinor
    sourceAgg.set(r.source, agg)
  }

  // Monthly revenue split for the period.
  const monthlyAgg = new Map<string, { revenueMinor: number; nights: number }>()
  for (const r of reservations) {
    if (r.status === 'CANCELLED') continue
    const start = r.checkIn < from ? from : r.checkIn
    const end = r.checkOut > to ? to : r.checkOut
    const nights = Math.max(nightsBetween(start, end), 0)
    if (nights === 0) continue
    const nightly = Math.round(r.totalMinor / Math.max(r.nights, 1))
    const cursor = new Date(start)
    while (cursor < end) {
      const monthKey = cursor.toISOString().slice(0, 7)
      const agg = monthlyAgg.get(monthKey) ?? { revenueMinor: 0, nights: 0 }
      agg.revenueMinor += nightly
      agg.nights++
      monthlyAgg.set(monthKey, agg)
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  const bookings = created.filter((r) => r.status !== 'CANCELLED').length

  return {
    from,
    to,
    nightsAvailable,
    nightsSold,
    occupancy: nightsAvailable > 0 ? nightsSold / nightsAvailable : 0,
    accommodationMinor: revenueMinor,
    extrasMinor: extras._sum.amountMinor ?? 0,
    revenueMinor: revenueMinor + (extras._sum.amountMinor ?? 0),
    adr: nightsSold > 0 ? Math.round(revenueMinor / nightsSold) : 0,
    revPAR: nightsAvailable > 0 ? Math.round(revenueMinor / nightsAvailable) : 0,
    bookings,
    cancellations,
    cancellationRate: created.length > 0 ? cancellations / created.length : 0,
    averageLeadDays: leadCount > 0 ? Math.round(leadTotal / leadCount) : null,
    sourceMix: [...sourceAgg.entries()]
      .map(([source, agg]) => ({ source, ...agg }))
      .sort((a, b) => b.count - a.count),
    monthly: [...monthlyAgg.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, agg]) => ({ month, ...agg })),
    byUnit: units.map((u) => {
      const agg = perUnit.get(u.id) ?? { nights: 0, revenueMinor: 0 }
      return {
        unitId: u.id,
        unitName: u.name,
        propertyName: u.property.name,
        nightsSold: agg.nights,
        nightsAvailable: periodNights,
        occupancy: agg.nights / periodNights,
        revenueMinor: agg.revenueMinor,
        adr: agg.nights > 0 ? Math.round(agg.revenueMinor / agg.nights) : 0,
      }
    }),
  }
}

/** CSV export for the reports page. Values are the same as the screen shows. */
export function reportToCsv(report: PeriodReport): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines: string[] = []
  lines.push(`# ABN Homes portfolio report ${report.from.toISOString().slice(0, 10)} to ${report.to.toISOString().slice(0, 10)}`)
  lines.push(`nights_available,${report.nightsAvailable}`)
  lines.push(`nights_sold,${report.nightsSold}`)
  lines.push(`occupancy_pct,${(report.occupancy * 100).toFixed(1)}`)
  lines.push(`adr,${report.adr}`)
  lines.push(`revpar,${report.revPAR}`)
  lines.push(`revenue_minor,${report.revenueMinor}`)
  lines.push(`bookings,${report.bookings}`)
  lines.push(`cancellations,${report.cancellations}`)
  lines.push(`avg_lead_days,${report.averageLeadDays ?? ''}`)
  lines.push('')
  lines.push('unit,property,nights_sold,occupancy_pct,revenue_minor,adr')
  for (const u of report.byUnit) {
    lines.push([esc(u.unitName), esc(u.propertyName), u.nightsSold, (u.occupancy * 100).toFixed(1), u.revenueMinor, u.adr].join(','))
  }
  lines.push('')
  lines.push('source,bookings,value_minor')
  for (const s of report.sourceMix) {
    lines.push([esc(s.source), s.count, s.valueMinor].join(','))
  }
  lines.push('')
  lines.push('month,nights,revenue_minor')
  for (const m of report.monthly) {
    lines.push([m.month, m.nights, m.revenueMinor].join(','))
  }
  return lines.join('\n') + '\n'
}
