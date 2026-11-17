/**
 * Rooms, treated as independent businesses.
 *
 * ABN runs each room on its own: its own calendar, its own manager, its own
 * revenue. This module is where that view is computed, so the board, the room
 * dashboard and the room calendar all read the same numbers from one place
 * rather than each inventing their own.
 *
 * Two rules worth knowing before changing anything here:
 *
 *   The rooftop is an amenity, not a room. It appears on the board so
 *   housekeeping and maintenance can see it, but it is never bookable, so it
 *   is excluded from every occupancy and revenue figure. A rooftop counted as
 *   an empty room would drag portfolio occupancy down by a seventh, for ever.
 *
 *   Revenue is what the room EARNED, not what was collected against it. A
 *   guest who pays a year of rent up front has not made that room's January
 *   spectacular — the same accrual rule the owner statements use applies here,
 *   so the two can never disagree.
 */

import type { Currency, ReservationStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { baseCurrency } from '@/lib/core/ledger'
import { dateOnly, nightsBetween, addDays } from '@/lib/core/dates'
import { propertyWhere, type Actor } from '@/lib/rbac'

/** Charge types that are held money rather than income. */
const NON_REVENUE_TYPES = ['SECURITY_DEPOSIT'] as const

/** Reservation states that actually occupy a calendar. */
const BLOCKING: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']

export type RoomState =
  | 'FREE'
  | 'HELD'
  | 'CONFIRMED'
  | 'OCCUPIED'
  | 'BLOCKED'
  | 'AMENITY'

export const ROOM_STATE_LABEL: Record<RoomState, string> = {
  FREE: 'Empty',
  HELD: 'Yet to confirm',
  CONFIRMED: 'Confirmed',
  OCCUPIED: 'Occupied',
  BLOCKED: 'Blocked',
  AMENITY: 'Shared space',
}

/** Maps a state onto the shared colour tokens so a colour never means two things. */
export const ROOM_STATE_CLASS: Record<RoomState, string> = {
  FREE: 'state-free',
  HELD: 'state-held',
  CONFIRMED: 'state-confirmed',
  OCCUPIED: 'state-occupied',
  BLOCKED: 'state-blocked',
  AMENITY: 'state-blocked',
}

export type RoomCard = {
  id: string
  code: string
  name: string
  typeLabel: string
  propertyName: string
  isAmenity: boolean
  bedrooms: number
  maxGuests: number
  images: string[]

  state: RoomState
  /** Who is in it now, guest or tenant. */
  occupantName: string | null
  occupantKind: 'guest' | 'tenant' | null
  /** When the current occupancy ends — a checkout date or a lease end. */
  until: Date | null
  /** The next arrival, when the room is empty or about to turn over. */
  nextArrival: { date: Date; guestName: string; status: ReservationStatus } | null

  managerName: string | null
  managerId: string | null

  nightlyMinor: number | null
  rentMinor: number | null
  currency: Currency

  /** This month, in the reporting base currency. */
  revenueMinor: number
  occupancy: number
  nightsSold: number

  openTickets: number
  housekeepingDue: number
}

/**
 * Every room, with its state right now and how it has done this month.
 *
 * One query per concern rather than per room — a board of forty rooms should
 * still be two round trips, not eighty.
 */
export async function roomBoard(args: {
  actor: Actor
  propertyId?: string
  from: Date
  to: Date
  asOf?: Date
}): Promise<RoomCard[]> {
  const asOf = dateOnly(args.asOf ?? new Date())
  const tomorrow = addDays(asOf, 1)
  const from = dateOnly(args.from)
  const to = dateOnly(args.to)

  const units = await db.unit.findMany({
    where: {
      ...(args.propertyId ? { propertyId: args.propertyId } : propertyWhere(args.actor)),
      status: { not: 'SOLD' },
    },
    include: {
      property: { select: { name: true } },
      manager: { select: { id: true, name: true } },
      reservations: {
        where: { status: { in: BLOCKING }, checkOut: { gt: asOf } },
        include: { guest: { select: { name: true } } },
        orderBy: { checkIn: 'asc' },
      },
      blocks: {
        where: { startDate: { lt: tomorrow }, endDate: { gt: asOf } },
        take: 1,
      },
      leases: {
        where: { status: 'ACTIVE' },
        include: { tenant: { select: { name: true } } },
        take: 1,
      },
      tickets: {
        where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] } },
        select: { id: true },
      },
      tasks: {
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] }, dueAt: { lt: tomorrow } },
        select: { id: true },
      },
    },
    orderBy: [{ property: { name: 'asc' } }, { sortOrder: 'asc' }, { code: 'asc' }],
  })

  const unitIds = units.map((u) => u.id)

  // Revenue for the period, accrued, converted at the rate each entry carried
  // when it was posted.
  const charges = await db.charge.findMany({
    where: {
      unitId: { in: unitIds },
      dueDate: { gte: from, lt: to },
      status: { notIn: ['REVERSED', 'WAIVED'] },
      type: { notIn: [...NON_REVENUE_TYPES] },
    },
    select: {
      unitId: true,
      amountMinor: true,
      ledgerEntries: { where: { kind: 'CHARGE' }, select: { fxRateToBase: true }, take: 1 },
    },
  })

  const revenueByUnit = new Map<string, number>()
  for (const charge of charges) {
    if (!charge.unitId) continue
    const rate = Number(charge.ledgerEntries[0]?.fxRateToBase ?? 1)
    revenueByUnit.set(
      charge.unitId,
      (revenueByUnit.get(charge.unitId) ?? 0) + Math.round(charge.amountMinor * rate)
    )
  }

  // Nights sold in the period, for occupancy.
  const sold = await db.reservation.findMany({
    where: {
      unitId: { in: unitIds },
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      checkIn: { lt: to },
      checkOut: { gt: from },
    },
    select: { unitId: true, checkIn: true, checkOut: true },
  })

  const nightsByUnit = new Map<string, number>()
  for (const r of sold) {
    const start = dateOnly(r.checkIn) < from ? from : dateOnly(r.checkIn)
    const end = dateOnly(r.checkOut) > to ? to : dateOnly(r.checkOut)
    nightsByUnit.set(r.unitId, (nightsByUnit.get(r.unitId) ?? 0) + nightsBetween(start, end))
  }

  const periodNights = Math.max(1, nightsBetween(from, to))

  return units.map((unit) => {
    const lease = unit.leases[0]
    const current = unit.reservations.find(
      (r) => dateOnly(r.checkIn) <= asOf && asOf < dateOnly(r.checkOut)
    )
    const upcoming = unit.reservations.find((r) => dateOnly(r.checkIn) > asOf)

    let state: RoomState = 'FREE'
    let occupantName: string | null = null
    let occupantKind: 'guest' | 'tenant' | null = null
    let until: Date | null = null

    if (unit.isAmenity) {
      state = 'AMENITY'
    } else if (lease) {
      // A sitting tenant occupies the room regardless of what the nightly
      // calendar says.
      state = 'OCCUPIED'
      occupantName = lease.tenant.name
      occupantKind = 'tenant'
      until = lease.endDate
    } else if (current) {
      state =
        current.status === 'CHECKED_IN'
          ? 'OCCUPIED'
          : current.status === 'PENDING'
            ? 'HELD'
            : 'CONFIRMED'
      occupantName = current.guest.name
      occupantKind = 'guest'
      until = current.checkOut
    } else if (unit.blocks.length > 0) {
      state = 'BLOCKED'
      until = unit.blocks[0].endDate
    } else if (unit.status === 'MAINTENANCE' || unit.status === 'OFF_MARKET') {
      state = 'BLOCKED'
    }

    const nightsSold = unit.isAmenity ? 0 : (nightsByUnit.get(unit.id) ?? 0)

    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      typeLabel: humaniseType(unit.type),
      propertyName: unit.property.name,
      isAmenity: unit.isAmenity,
      bedrooms: unit.bedrooms,
      maxGuests: unit.maxGuests,
      images: unit.images,

      state,
      occupantName,
      occupantKind,
      until,
      nextArrival: upcoming
        ? { date: upcoming.checkIn, guestName: upcoming.guest.name, status: upcoming.status }
        : null,

      managerName: unit.manager?.name ?? null,
      managerId: unit.manager?.id ?? null,

      nightlyMinor: unit.baseNightlyMinor,
      rentMinor: unit.baseRentMinor,
      currency: unit.currency,

      revenueMinor: unit.isAmenity ? 0 : (revenueByUnit.get(unit.id) ?? 0),
      occupancy: unit.isAmenity ? 0 : nightsSold / periodNights,
      nightsSold,

      openTickets: unit.tickets.length,
      housekeepingDue: unit.tasks.length,
    }
  })
}

export type RoomPerformance = {
  revenueMinor: number
  currency: Currency
  nightsSold: number
  nightsAvailable: number
  occupancy: number
  adrMinor: number
  revParMinor: number
  bookings: number
  cancellations: number
  averageStayNights: number
  expensesMinor: number
  netMinor: number
}

/** How one room has performed over a period. Powers the room dashboard. */
export async function roomPerformance(
  unitId: string,
  args: { from: Date; to: Date }
): Promise<RoomPerformance> {
  const from = dateOnly(args.from)
  const to = dateOnly(args.to)
  const periodNights = Math.max(1, nightsBetween(from, to))
  const base = baseCurrency()

  const [unit, charges, reservations, cancelled, expenses] = await Promise.all([
    db.unit.findUniqueOrThrow({ where: { id: unitId }, select: { isAmenity: true } }),
    db.charge.findMany({
      where: {
        unitId,
        dueDate: { gte: from, lt: to },
        status: { notIn: ['REVERSED', 'WAIVED'] },
        type: { notIn: [...NON_REVENUE_TYPES] },
      },
      select: {
        amountMinor: true,
        ledgerEntries: { where: { kind: 'CHARGE' }, select: { fxRateToBase: true }, take: 1 },
      },
    }),
    db.reservation.findMany({
      where: {
        unitId,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      select: { checkIn: true, checkOut: true },
    }),
    db.reservation.count({
      where: { unitId, status: 'CANCELLED', checkIn: { gte: from, lt: to } },
    }),
    db.ledgerEntry.findMany({
      where: { unitId, kind: 'EXPENSE', occurredAt: { gte: from, lt: to } },
      select: { amountMinor: true, fxRateToBase: true },
    }),
  ])

  const revenueMinor = charges.reduce(
    (sum, c) => sum + Math.round(c.amountMinor * Number(c.ledgerEntries[0]?.fxRateToBase ?? 1)),
    0
  )

  const expensesMinor = expenses.reduce(
    (sum, e) => sum + Math.round(e.amountMinor * Number(e.fxRateToBase)),
    0
  )

  let nightsSold = 0
  for (const r of reservations) {
    const start = dateOnly(r.checkIn) < from ? from : dateOnly(r.checkIn)
    const end = dateOnly(r.checkOut) > to ? to : dateOnly(r.checkOut)
    nightsSold += nightsBetween(start, end)
  }

  // An amenity has no sellable nights, so its occupancy is not zero — it is
  // undefined, and reporting it as 0% would be a lie about an empty room.
  const nightsAvailable = unit.isAmenity ? 0 : periodNights
  const occupancy = nightsAvailable === 0 ? 0 : nightsSold / nightsAvailable
  const adrMinor = nightsSold === 0 ? 0 : Math.round(revenueMinor / nightsSold)

  const totalStay = reservations.reduce(
    (sum, r) => sum + nightsBetween(dateOnly(r.checkIn), dateOnly(r.checkOut)),
    0
  )

  return {
    revenueMinor,
    currency: base,
    nightsSold,
    nightsAvailable,
    occupancy,
    adrMinor,
    revParMinor: Math.round(adrMinor * occupancy),
    bookings: reservations.length,
    cancellations: cancelled,
    averageStayNights: reservations.length === 0 ? 0 : totalStay / reservations.length,
    expensesMinor,
    netMinor: revenueMinor - expensesMinor,
  }
}

export type RoomMonth = { month: string; revenueMinor: number; nightsSold: number }

/** Month-by-month revenue for one room, for the dashboard chart. */
export async function roomRevenueTrend(unitId: string, months = 6): Promise<RoomMonth[]> {
  const now = new Date()
  const out: RoomMonth[] = []

  for (let i = months - 1; i >= 0; i -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1))
    const perf = await roomPerformance(unitId, { from: start, to: end })

    out.push({
      month: start.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
      revenueMinor: perf.revenueMinor,
      nightsSold: perf.nightsSold,
    })
  }

  return out
}

function humaniseType(type: string): string {
  const labels: Record<string, string> = {
    STUDIO: 'Studio',
    ONE_BED: 'One bedroom',
    TWO_BED: 'Two bedroom',
    THREE_BED: 'Three bedroom',
    FOUR_BED: 'Four bedroom',
    PENTHOUSE: 'Penthouse',
    TOWNHOUSE: 'Townhouse',
    DETACHED: 'Detached',
    COMMERCIAL: 'Shared space',
  }
  return labels[type] ?? type
}
