/**
 * The owner's dashboard: how the buildings are doing, in one read.
 *
 * Everything an owner asks first — what did we earn, how full are we, which
 * rooms carry the building, what is happening today — answered from five
 * queries for the whole window, whatever the number of rooms. The database
 * runs behind a pool with a single connection, so a loop of per-room queries
 * would serialise and time out; fetch once, then split by room and month here.
 *
 * Revenue follows the same rule as the owner statements: charges, by the date
 * they fall due, converted to the base currency at the rate they were posted
 * at. Deposits are not revenue. Nights are counted the way the room dashboard
 * counts them, so the two never disagree.
 *
 * No guest's name or contact details leave this module: an owner sees dates
 * and money, not who is staying.
 */

import type { Currency } from '@prisma/client'
import { db } from '@/lib/db'
import { baseCurrency } from '@/lib/core/ledger'
import { dateOnly, nightsBetween } from '@/lib/core/dates'

const NON_REVENUE_TYPES = ['SECURITY_DEPOSIT'] as const

export type OwnerMonth = {
  /** First day of the month, UTC. */
  start: Date
  label: string
  revenueMinor: number
  nightsSold: number
  nightsAvailable: number
  occupancy: number
  /** Average earned per night sold. */
  adrMinor: number
  bookings: number
}

export type OwnerRoomRow = {
  unitId: string
  name: string
  propertyName: string
  thisMonth: { revenueMinor: number; nightsSold: number; occupancy: number; adrMinor: number }
  lastMonth: { revenueMinor: number; nightsSold: number; occupancy: number }
}

export type OwnerDashboard = {
  currency: Currency
  /** Oldest first; the last entry is the current month. */
  months: OwnerMonth[]
  rooms: OwnerRoomRow[]
  today: { inHouse: number; arriving: number; leaving: number }
  /** Confirmed stays starting in the next 30 days, and the nights they hold. */
  ahead: { bookings: number; nights: number }
  roomCount: number
  /** Rooms occupancy is measured against: listed, or let during the window. */
  roomsOnTheMarket: number
}

const DAY = 24 * 60 * 60 * 1000
const monthStart = (y: number, m: number) => new Date(Date.UTC(y, m, 1))

export async function ownerDashboard(args: {
  ownerPartyId: string
  /** Limit to these buildings (a scoped member of staff). null = all the owner's. */
  propertyIds?: string[] | null
  months?: number
}): Promise<OwnerDashboard> {
  const monthCount = args.months ?? 6
  const now = new Date()
  const today = dateOnly(now)
  const windowStart = monthStart(now.getUTCFullYear(), now.getUTCMonth() - (monthCount - 1))
  const windowEnd = monthStart(now.getUTCFullYear(), now.getUTCMonth() + 1)
  const base = baseCurrency()

  const units = await db.unit.findMany({
    where: {
      isAmenity: false,
      property: {
        ownerPartyId: args.ownerPartyId,
        active: true,
        ...(args.propertyIds ? { id: { in: args.propertyIds } } : {}),
      },
    },
    select: { id: true, name: true, sortOrder: true, published: true, property: { select: { name: true } } },
    orderBy: [{ property: { name: 'asc' } }, { sortOrder: 'asc' }],
  })
  const unitIds = units.map((u) => u.id)

  const emptyMonths: OwnerMonth[] = Array.from({ length: monthCount }, (_, i) => {
    const start = monthStart(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + i)
    return {
      start,
      label: start.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      revenueMinor: 0,
      nightsSold: 0,
      nightsAvailable: 0,
      occupancy: 0,
      adrMinor: 0,
      bookings: 0,
    }
  })

  if (unitIds.length === 0) {
    return {
      currency: base,
      months: emptyMonths,
      rooms: [],
      today: { inHouse: 0, arriving: 0, leaving: 0 },
      ahead: { bookings: 0, nights: 0 },
      roomCount: 0,
      roomsOnTheMarket: 0,
    }
  }

  const [charges, reservations, leases, upcoming] = await Promise.all([
    db.charge.findMany({
      where: {
        unitId: { in: unitIds },
        dueDate: { gte: windowStart, lt: windowEnd },
        status: { notIn: ['REVERSED', 'WAIVED'] },
        type: { notIn: [...NON_REVENUE_TYPES] },
      },
      select: {
        unitId: true,
        dueDate: true,
        amountMinor: true,
        ledgerEntries: { where: { kind: 'CHARGE' }, select: { fxRateToBase: true }, take: 1 },
      },
    }),
    db.reservation.findMany({
      where: {
        unitId: { in: unitIds },
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        checkIn: { lt: windowEnd },
        checkOut: { gt: windowStart },
      },
      select: { unitId: true, status: true, checkIn: true, checkOut: true },
    }),
    db.lease.findMany({
      where: {
        unitId: { in: unitIds },
        status: { in: ['ACTIVE', 'ENDED'] },
        startDate: { lt: windowEnd },
        endDate: { gt: windowStart },
      },
      select: { unitId: true, startDate: true, endDate: true },
    }),
    db.reservation.findMany({
      where: {
        unitId: { in: unitIds },
        status: 'CONFIRMED',
        checkIn: { gt: today, lte: new Date(today.getTime() + 30 * DAY) },
      },
      select: { checkIn: true, checkOut: true },
    }),
  ])

  // month index -> unit id -> figures
  type Cell = { revenueMinor: number; nightsSold: number; bookings: number }
  const grid: Array<Map<string, Cell>> = emptyMonths.map(() => new Map())
  const cell = (m: number, unitId: string): Cell => {
    let c = grid[m].get(unitId)
    if (!c) grid[m].set(unitId, (c = { revenueMinor: 0, nightsSold: 0, bookings: 0 }))
    return c
  }
  const monthIndex = (d: Date) =>
    (d.getUTCFullYear() - windowStart.getUTCFullYear()) * 12 + d.getUTCMonth() - windowStart.getUTCMonth()
  const monthEnd = (m: number) =>
    monthStart(emptyMonths[m].start.getUTCFullYear(), emptyMonths[m].start.getUTCMonth() + 1)

  for (const c of charges) {
    if (!c.unitId) continue
    const m = monthIndex(c.dueDate)
    if (m < 0 || m >= monthCount) continue
    cell(m, c.unitId).revenueMinor += Math.round(c.amountMinor * Number(c.ledgerEntries[0]?.fxRateToBase ?? 1))
  }

  /** Split a stay across the months it touches. */
  const spread = (unitId: string, rawStart: Date, rawEnd: Date, countsAsBooking: boolean) => {
    const start = dateOnly(rawStart)
    const end = dateOnly(rawEnd)
    for (let m = 0; m < monthCount; m++) {
      const from = emptyMonths[m].start
      const to = monthEnd(m)
      const a = start < from ? from : start
      const b = end > to ? to : end
      if (b <= a) continue
      const c = cell(m, unitId)
      c.nightsSold += nightsBetween(a, b)
      if (countsAsBooking) c.bookings += 1
    }
  }
  for (const r of reservations) spread(r.unitId, r.checkIn, r.checkOut, true)
  for (const l of leases) spread(l.unitId, l.startDate, l.endDate, false)

  // Occupancy is measured against rooms that could actually be sold: those
  // listed on the website, plus any unlisted room that was let anyway. A home
  // still being fitted out should not make a full building look half empty.
  const onTheMarket = new Set(units.filter((u) => u.published).map((u) => u.id))
  for (const month of grid) for (const [unitId, c] of month) if (c.nightsSold > 0) onTheMarket.add(unitId)

  const months = emptyMonths.map((month, m) => {
    const nightsInMonth = nightsBetween(month.start, monthEnd(m))
    let revenueMinor = 0
    let nightsSold = 0
    let bookings = 0
    for (const c of grid[m].values()) {
      revenueMinor += c.revenueMinor
      nightsSold += Math.min(c.nightsSold, nightsInMonth)
      bookings += c.bookings
    }
    const nightsAvailable = onTheMarket.size * nightsInMonth
    return {
      ...month,
      revenueMinor,
      nightsSold,
      nightsAvailable,
      occupancy: nightsAvailable === 0 ? 0 : Math.min(1, nightsSold / nightsAvailable),
      adrMinor: nightsSold === 0 ? 0 : Math.round(revenueMinor / nightsSold),
      bookings,
    }
  })

  const cur = monthCount - 1
  const prev = monthCount - 2
  const nightsIn = (m: number) => nightsBetween(emptyMonths[m].start, monthEnd(m))
  const rooms: OwnerRoomRow[] = units.map((u) => {
    const a = grid[cur].get(u.id) ?? { revenueMinor: 0, nightsSold: 0, bookings: 0 }
    const b = prev >= 0 ? (grid[prev].get(u.id) ?? { revenueMinor: 0, nightsSold: 0, bookings: 0 }) : null
    const aNights = Math.min(a.nightsSold, nightsIn(cur))
    const bNights = b ? Math.min(b.nightsSold, nightsIn(prev)) : 0
    return {
      unitId: u.id,
      name: u.name,
      propertyName: u.property.name,
      thisMonth: {
        revenueMinor: a.revenueMinor,
        nightsSold: aNights,
        occupancy: aNights / nightsIn(cur),
        adrMinor: aNights === 0 ? 0 : Math.round(a.revenueMinor / aNights),
      },
      lastMonth: {
        revenueMinor: b?.revenueMinor ?? 0,
        nightsSold: bNights,
        occupancy: b ? bNights / nightsIn(prev) : 0,
      },
    }
  })

  const sameDay = (d: Date) => dateOnly(d).getTime() === today.getTime()
  return {
    currency: base,
    months,
    rooms,
    today: {
      inHouse: reservations.filter((r) => r.status === 'CHECKED_IN').length,
      arriving: reservations.filter((r) => r.status === 'CONFIRMED' && sameDay(r.checkIn)).length,
      leaving: reservations.filter((r) => r.status === 'CHECKED_IN' && sameDay(r.checkOut)).length,
    },
    ahead: {
      bookings: upcoming.length,
      nights: upcoming.reduce((s, r) => s + nightsBetween(dateOnly(r.checkIn), dateOnly(r.checkOut)), 0),
    },
    roomCount: unitIds.length,
    roomsOnTheMarket: onTheMarket.size,
  }
}
