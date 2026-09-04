/**
 * Availability.
 *
 * The most expensive bug this system could ship is a double booking: a guest
 * arrives from abroad to a unit someone else is asleep in. So availability is
 * defended twice.
 *
 *   - Here, in the application, with a clear check and a readable error.
 *   - In Postgres, with an exclusion constraint that makes an overlapping
 *     reservation physically impossible to insert (see prisma/sql/001_constraints.sql).
 *
 * The application check gives a good message. The database constraint is what
 * makes it true under concurrency, when two clerks confirm the same dates in
 * the same second.
 */

import type { ReservationStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { dateOnly, eachNight, nightsBetween, toISODate } from '@/lib/core/dates'

/**
 * Reservation states that occupy the calendar. An enquiry does not hold dates;
 * a pending booking does, or a guest could lose the room while paying for it.
 */
export const BLOCKING_STATUSES: ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
]

export type AvailabilityConflict =
  | { kind: 'reservation'; id: string; code: string; checkIn: Date; checkOut: Date; guest: string }
  | { kind: 'block'; id: string; startDate: Date; endDate: Date; reason: string; source: string }

/**
 * Everything standing in the way of a stay. Empty means the dates are free.
 * `excludeReservationId` lets an existing booking be edited without colliding
 * with itself.
 */
export async function findConflicts(args: {
  unitId: string
  checkIn: Date
  checkOut: Date
  excludeReservationId?: string
}): Promise<AvailabilityConflict[]> {
  const checkIn = dateOnly(args.checkIn)
  const checkOut = dateOnly(args.checkOut)

  if (checkOut <= checkIn) {
    throw new Error('Check-out must be after check-in.')
  }

  // Half-open overlap: a stay ending on the 14th does not clash with one
  // starting on the 14th. Written as (existing.start < new.end AND
  // existing.end > new.start).
  const [reservations, blocks] = await Promise.all([
    db.reservation.findMany({
      where: {
        unitId: args.unitId,
        status: { in: BLOCKING_STATUSES },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
        ...(args.excludeReservationId ? { id: { not: args.excludeReservationId } } : {}),
      },
      include: { guest: { select: { name: true } } },
    }),
    db.calendarBlock.findMany({
      where: {
        unitId: args.unitId,
        startDate: { lt: checkOut },
        endDate: { gt: checkIn },
        ...(args.excludeReservationId
          ? { OR: [{ reservationId: null }, { reservationId: { not: args.excludeReservationId } }] }
          : {}),
      },
    }),
  ])

  return [
    ...reservations.map((r) => ({
      kind: 'reservation' as const,
      id: r.id,
      code: r.code,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      guest: r.guest.name,
    })),
    ...blocks.map((b) => ({
      kind: 'block' as const,
      id: b.id,
      startDate: b.startDate,
      endDate: b.endDate,
      reason: b.reason ?? 'Unavailable',
      source: b.source,
    })),
  ]
}

export async function isUnitAvailable(args: {
  unitId: string
  checkIn: Date
  checkOut: Date
  excludeReservationId?: string
}): Promise<boolean> {
  const conflicts = await findConflicts(args)
  return conflicts.length === 0
}

export class AvailabilityError extends Error {
  conflicts: AvailabilityConflict[]
  constructor(message: string, conflicts: AvailabilityConflict[]) {
    super(message)
    this.name = 'AvailabilityError'
    this.conflicts = conflicts
  }
}

export async function assertAvailable(args: {
  unitId: string
  checkIn: Date
  checkOut: Date
  excludeReservationId?: string
}): Promise<void> {
  const conflicts = await findConflicts(args)
  if (conflicts.length === 0) return

  const first = conflicts[0]
  const detail =
    first.kind === 'reservation'
      ? `booking ${first.code} for ${first.guest} runs ${toISODate(first.checkIn)} to ${toISODate(first.checkOut)}`
      : `the unit is blocked ${toISODate(first.startDate)} to ${toISODate(first.endDate)} (${first.reason})`

  throw new AvailabilityError(`Those dates are not available: ${detail}.`, conflicts)
}

/**
 * Units that are free for a whole stay. Used by the booking form and by the
 * public site's search.
 */
export async function findAvailableUnits(args: {
  checkIn: Date
  checkOut: Date
  propertyId?: string
  guests?: number
  publishedOnly?: boolean
}) {
  const checkIn = dateOnly(args.checkIn)
  const checkOut = dateOnly(args.checkOut)

  const candidates = await db.unit.findMany({
    where: {
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      status: { notIn: ['OFF_MARKET', 'MAINTENANCE'] },
      ...(args.propertyId ? { propertyId: args.propertyId } : {}),
      ...(args.guests ? { maxGuests: { gte: args.guests } } : {}),
      ...(args.publishedOnly ? { published: true, property: { published: true } } : {}),
      // Exclude anything with an overlapping reservation or block, in SQL.
      reservations: {
        none: {
          status: { in: BLOCKING_STATUSES },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      },
      blocks: {
        none: {
          startDate: { lt: checkOut },
          endDate: { gt: checkIn },
        },
      },
    },
    include: {
      property: { select: { id: true, name: true, slug: true, addressLine: true, city: true } },
      ratePlans: { where: { active: true } },
    },
    orderBy: [{ propertyId: 'asc' }, { code: 'asc' }],
  })

  return candidates
}

export type CalendarDay = {
  date: string
  available: boolean
  reservationId?: string
  reservationCode?: string
  guestName?: string
  status?: ReservationStatus
  blockReason?: string
  isCheckIn?: boolean
  isCheckOut?: boolean
}

/**
 * Day-by-day view for the calendar grid. Marks arrivals and departures
 * separately so the interface can show a changeover day as half-and-half
 * rather than pretending the unit is free all day or busy all day.
 */
export async function unitCalendar(args: {
  unitId: string
  from: Date
  to: Date
}): Promise<CalendarDay[]> {
  const from = dateOnly(args.from)
  const to = dateOnly(args.to)

  const [reservations, blocks] = await Promise.all([
    db.reservation.findMany({
      where: {
        unitId: args.unitId,
        status: { in: BLOCKING_STATUSES },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      include: { guest: { select: { name: true } } },
    }),
    db.calendarBlock.findMany({
      where: { unitId: args.unitId, startDate: { lt: to }, endDate: { gt: from } },
    }),
  ])

  const days: CalendarDay[] = []

  for (const night of eachNight(from, to)) {
    const iso = toISODate(night)

    const reservation = reservations.find(
      (r) => dateOnly(r.checkIn) <= night && night < dateOnly(r.checkOut)
    )
    const block = blocks.find(
      (b) => dateOnly(b.startDate) <= night && night < dateOnly(b.endDate)
    )

    if (reservation) {
      days.push({
        date: iso,
        available: false,
        reservationId: reservation.id,
        reservationCode: reservation.code,
        guestName: reservation.guest.name,
        status: reservation.status,
        isCheckIn: dateOnly(reservation.checkIn).getTime() === night.getTime(),
        isCheckOut: false,
      })
    } else if (block) {
      days.push({
        date: iso,
        available: false,
        blockReason: block.reason ?? 'Blocked',
      })
    } else {
      days.push({ date: iso, available: true })
    }
  }

  // Mark departure days so a changeover reads correctly in the grid.
  for (const reservation of reservations) {
    const iso = toISODate(reservation.checkOut)
    const day = days.find((d) => d.date === iso)
    if (day) day.isCheckOut = true
  }

  return days
}

/**
 * Occupancy for a period: nights sold over nights available.
 * The denominator counts only units that were actually lettable, so a unit
 * held off-market for refurbishment does not depress the figure.
 */
export async function occupancyRate(args: {
  from: Date
  to: Date
  propertyId?: string
}): Promise<{ nightsSold: number; nightsAvailable: number; rate: number }> {
  const from = dateOnly(args.from)
  const to = dateOnly(args.to)
  const periodNights = nightsBetween(from, to)

  const units = await db.unit.findMany({
    where: {
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      status: { not: 'OFF_MARKET' },
      ...(args.propertyId ? { propertyId: args.propertyId } : {}),
    },
    select: { id: true },
  })

  if (units.length === 0 || periodNights === 0) {
    return { nightsSold: 0, nightsAvailable: 0, rate: 0 }
  }

  const reservations = await db.reservation.findMany({
    where: {
      unitId: { in: units.map((u) => u.id) },
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      checkIn: { lt: to },
      checkOut: { gt: from },
    },
    select: { checkIn: true, checkOut: true },
  })

  // Count only the nights that fall inside the window.
  const nightsSold = reservations.reduce((total, r) => {
    const start = dateOnly(r.checkIn) < from ? from : dateOnly(r.checkIn)
    const end = dateOnly(r.checkOut) > to ? to : dateOnly(r.checkOut)
    return total + nightsBetween(start, end)
  }, 0)

  const nightsAvailable = units.length * periodNights

  return {
    nightsSold,
    nightsAvailable,
    rate: nightsAvailable === 0 ? 0 : nightsSold / nightsAvailable,
  }
}
