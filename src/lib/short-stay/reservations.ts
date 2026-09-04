/**
 * Reservations.
 *
 * Creating a booking is never just one row. It has to reserve the dates, price
 * the stay, raise the charge, hold the deposit and queue the changeover clean —
 * and either all of that happens or none of it does. A booking that exists
 * without its charge is a free stay nobody notices until the owner asks why
 * occupancy is up and revenue is not.
 */

import { Prisma, type Currency, type ReservationSource } from '@prisma/client'
import { db } from '@/lib/db'
import { postCharge, postEntry, reverseEntry } from '@/lib/core/ledger'
import { reservationCode } from '@/lib/core/ids'
import { dateOnly, nightsBetween } from '@/lib/core/dates'
import { normalisePhone } from '@/lib/core/phone'
import { assertAvailable } from './availability'
import { quoteFromUnit, type Quote } from './pricing'
import { sendSms, templates } from '@/lib/messaging'
import { formatMinor } from '@/lib/core/money'
import { formatDate } from '@/lib/core/dates'

export type GuestInput = {
  partyId?: string
  name: string
  phone?: string | null
  email?: string | null
  nationality?: string | null
  ghanaCard?: string | null
}

/**
 * Match an existing guest on phone or email before creating a new one.
 * Guests return, and a returning guest with two records has half a history.
 */
export async function findOrCreateGuest(
  input: GuestInput,
  tx: Prisma.TransactionClient
): Promise<string> {
  if (input.partyId) return input.partyId

  const phone = normalisePhone(input.phone ?? '')
  const email = input.email?.toLowerCase().trim() || null

  if (phone || email) {
    const existing = await tx.party.findFirst({
      where: {
        OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
      },
    })
    if (existing) {
      if (!existing.isGuest) {
        await tx.party.update({ where: { id: existing.id }, data: { isGuest: true } })
      }
      return existing.id
    }
  }

  const created = await tx.party.create({
    data: {
      type: 'PERSON',
      name: input.name,
      phone,
      email,
      nationality: input.nationality ?? null,
      ghanaCard: input.ghanaCard ?? null,
      isGuest: true,
    },
  })
  return created.id
}

export type CreateReservationInput = {
  unitId: string
  guest: GuestInput
  checkIn: Date
  checkOut: Date
  adults?: number
  children?: number
  source?: ReservationSource
  discountMinor?: number
  guestNotes?: string | null
  internalNotes?: string | null
  /** CONFIRMED skips the held state, e.g. a walk-in paying at the desk. */
  status?: 'PENDING' | 'CONFIRMED'
  /** Allow a stay below the minimum-night rule, with a manager's blessing. */
  overrideViolations?: boolean
  actorUserId?: string | null
  idempotencyKey?: string | null
}

export async function createReservation(input: CreateReservationInput) {
  if (input.idempotencyKey) {
    const existing = await db.reservation.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    })
    if (existing) return { reservation: existing, quote: null, created: false as const }
  }

  // Checked before the transaction for a clean error, and again inside it —
  // plus an exclusion constraint in Postgres that settles genuine races.
  await assertAvailable({
    unitId: input.unitId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
  })

  return db.$transaction(async (tx) => {
    const unit = await tx.unit.findUniqueOrThrow({
      where: { id: input.unitId },
      include: { ratePlans: { where: { active: true } }, property: true },
    })

    const quote: Quote = quoteFromUnit(unit, {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: (input.adults ?? 1) + (input.children ?? 0),
      discountMinor: input.discountMinor,
    })

    const blocking = quote.violations.filter((v) => !v.startsWith('Weekly rate applied'))
    if (blocking.length > 0 && !input.overrideViolations) {
      throw new Error(blocking.join(' '))
    }

    const guestPartyId = await findOrCreateGuest(input.guest, tx)
    const status = input.status ?? 'PENDING'

    const reservation = await tx.reservation.create({
      data: {
        code: reservationCode(),
        unitId: unit.id,
        guestPartyId,
        checkIn: dateOnly(input.checkIn),
        checkOut: dateOnly(input.checkOut),
        nights: quote.nights,
        adults: input.adults ?? 1,
        children: input.children ?? 0,
        status,
        source: input.source ?? 'DIRECT',
        currency: quote.currency,
        nightlyRateMinor: quote.averageNightlyMinor,
        cleaningFeeMinor: quote.cleaningFeeMinor,
        discountMinor: quote.discountMinor,
        totalMinor: quote.totalMinor,
        depositMinor: quote.depositMinor,
        guestNotes: input.guestNotes ?? null,
        internalNotes: input.internalNotes ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    })

    // The stay itself, due on arrival.
    await postCharge(
      {
        propertyId: unit.propertyId,
        partyId: guestPartyId,
        unitId: unit.id,
        type: 'NIGHTLY_STAY',
        description: `${quote.nights} night${quote.nights === 1 ? '' : 's'} at ${unit.name}, ${formatDate(reservation.checkIn)} to ${formatDate(reservation.checkOut)}`,
        amountMinor: quote.accommodationMinor - quote.discountMinor,
        currency: quote.currency,
        dueDate: reservation.checkIn,
        periodStart: reservation.checkIn,
        periodEnd: reservation.checkOut,
        reservationId: reservation.id,
        actorUserId: input.actorUserId,
      },
      tx
    )

    if (quote.cleaningFeeMinor > 0) {
      await postCharge(
        {
          propertyId: unit.propertyId,
          partyId: guestPartyId,
          unitId: unit.id,
          type: 'CLEANING_FEE',
          description: `Cleaning fee — booking ${reservation.code}`,
          amountMinor: quote.cleaningFeeMinor,
          currency: quote.currency,
          dueDate: reservation.checkIn,
          reservationId: reservation.id,
          actorUserId: input.actorUserId,
        },
        tx
      )
    }

    // The changeover clean, due at checkout.
    await tx.housekeepingTask.create({
      data: {
        unitId: unit.id,
        reservationId: reservation.id,
        type: 'TURNOVER',
        dueAt: reservation.checkOut,
        status: 'PENDING',
      },
    })

    await tx.unit.update({
      where: { id: unit.id },
      data: { status: status === 'CONFIRMED' ? 'RESERVED' : unit.status },
    })

    return { reservation, quote, created: true as const }
  })
}

export async function confirmReservation(
  reservationId: string,
  actorUserId?: string | null
) {
  const reservation = await db.reservation.update({
    where: { id: reservationId },
    data: { status: 'CONFIRMED' },
    include: { guest: true, unit: true },
  })

  await db.unit.update({ where: { id: reservation.unitId }, data: { status: 'RESERVED' } })

  if (reservation.guest.phone) {
    await sendSms({
      to: reservation.guest.phone,
      body: templates.bookingConfirmed(
        reservation.guest.name.split(' ')[0],
        reservation.unit.name,
        formatDate(reservation.checkIn),
        reservation.code
      ),
      template: 'booking_confirmed',
      entityType: 'Reservation',
      entityId: reservation.id,
    })
  }

  return reservation
}

/**
 * Cancelling reverses every ledger entry raised for the stay, so a cancelled
 * booking leaves a visible history rather than a hole where a charge was.
 */
export async function cancelReservation(
  reservationId: string,
  args: { reason: string; actorUserId?: string | null }
) {
  return db.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: { chargeRows: { include: { ledgerEntries: true } } },
    })

    for (const charge of reservation.chargeRows) {
      for (const entry of charge.ledgerEntries) {
        if (entry.kind === 'CHARGE') {
          await reverseEntry(
            entry.id,
            { reason: `Booking ${reservation.code} cancelled: ${args.reason}`, actorUserId: args.actorUserId },
            tx
          )
        }
      }
    }

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: args.reason },
    })

    await tx.housekeepingTask.updateMany({
      where: { reservationId, status: 'PENDING' },
      data: { status: 'SKIPPED' },
    })

    await tx.calendarBlock.deleteMany({ where: { reservationId } })

    const stillBusy = await tx.reservation.count({
      where: {
        unitId: reservation.unitId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
    })
    if (stillBusy === 0) {
      await tx.unit.update({ where: { id: reservation.unitId }, data: { status: 'AVAILABLE' } })
    }

    return updated
  })
}

export async function checkInGuest(reservationId: string, actorUserId?: string | null) {
  return db.$transaction(async (tx) => {
    const reservation = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: 'CHECKED_IN', checkedInAt: new Date() },
      include: { unit: true },
    })

    await tx.unit.update({ where: { id: reservation.unitId }, data: { status: 'OCCUPIED' } })

    // A deposit becomes a liability only once we are actually holding it.
    if (reservation.depositMinor > 0) {
      await postEntry(
        {
          propertyId: reservation.unit.propertyId,
          partyId: reservation.guestPartyId,
          unitId: reservation.unitId,
          direction: 'CREDIT',
          kind: 'DEPOSIT_HELD',
          amountMinor: reservation.depositMinor,
          currency: reservation.currency,
          description: `Security deposit held — booking ${reservation.code}`,
          reservationId: reservation.id,
          actorUserId,
        },
        tx
      )
    }

    return reservation
  })
}

export async function checkOutGuest(
  reservationId: string,
  args: { releaseDeposit?: boolean; deductionMinor?: number; deductionReason?: string; actorUserId?: string | null } = {}
) {
  return db.$transaction(async (tx) => {
    const reservation = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: 'CHECKED_OUT', checkedOutAt: new Date() },
      include: { unit: true },
    })

    const deduction = args.deductionMinor ?? 0

    if (reservation.depositMinor > 0 && args.releaseDeposit !== false) {
      const releasable = Math.max(0, reservation.depositMinor - deduction)

      if (releasable > 0) {
        await postEntry(
          {
            propertyId: reservation.unit.propertyId,
            partyId: reservation.guestPartyId,
            unitId: reservation.unitId,
            direction: 'DEBIT',
            kind: 'DEPOSIT_RELEASED',
            amountMinor: releasable,
            currency: reservation.currency,
            description: `Security deposit released — booking ${reservation.code}`,
            reservationId: reservation.id,
            actorUserId: args.actorUserId,
          },
          tx
        )
      }

      if (deduction > 0) {
        await postEntry(
          {
            propertyId: reservation.unit.propertyId,
            partyId: reservation.guestPartyId,
            unitId: reservation.unitId,
            direction: 'DEBIT',
            kind: 'DEPOSIT_FORFEITED',
            amountMinor: deduction,
            currency: reservation.currency,
            description: `Deposit deduction — ${args.deductionReason ?? 'damage or extra cleaning'} — booking ${reservation.code}`,
            reservationId: reservation.id,
            actorUserId: args.actorUserId,
          },
          tx
        )
      }
    }

    // The unit is dirty until housekeeping says otherwise.
    await tx.unit.update({ where: { id: reservation.unitId }, data: { status: 'MAINTENANCE' } })

    const task = await tx.housekeepingTask.findFirst({
      where: { reservationId, type: 'TURNOVER', status: 'PENDING' },
    })
    if (!task) {
      await tx.housekeepingTask.create({
        data: {
          unitId: reservation.unitId,
          reservationId: reservation.id,
          type: 'TURNOVER',
          dueAt: new Date(),
          status: 'PENDING',
        },
      })
    }

    return reservation
  })
}

/** Arrivals, departures and stay-overs for a given day. The desk's morning view. */
export async function dayBook(date: Date, propertyId?: string) {
  const day = dateOnly(date)
  const next = new Date(day.getTime() + 86_400_000)
  const unitFilter = propertyId ? { unit: { propertyId } } : {}

  const [arrivals, departures, inHouse] = await Promise.all([
    db.reservation.findMany({
      where: {
        checkIn: { gte: day, lt: next },
        status: { in: ['PENDING', 'CONFIRMED'] },
        ...unitFilter,
      },
      include: { guest: true, unit: { include: { property: true } } },
      orderBy: { unit: { code: 'asc' } },
    }),
    db.reservation.findMany({
      where: { checkOut: { gte: day, lt: next }, status: 'CHECKED_IN', ...unitFilter },
      include: { guest: true, unit: { include: { property: true } } },
      orderBy: { unit: { code: 'asc' } },
    }),
    db.reservation.findMany({
      where: {
        checkIn: { lte: day },
        checkOut: { gt: next },
        status: 'CHECKED_IN',
        ...unitFilter,
      },
      include: { guest: true, unit: { include: { property: true } } },
      orderBy: { unit: { code: 'asc' } },
    }),
  ])

  return { arrivals, departures, inHouse }
}

/** Total booked revenue for a window, used on the dashboard. */
export async function bookedRevenue(args: {
  from: Date
  to: Date
  currency: Currency
  propertyId?: string
}) {
  const result = await db.reservation.aggregate({
    where: {
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      currency: args.currency,
      checkIn: { gte: dateOnly(args.from), lt: dateOnly(args.to) },
      ...(args.propertyId ? { unit: { propertyId: args.propertyId } } : {}),
    },
    _sum: { totalMinor: true },
    _count: true,
  })

  return {
    totalMinor: result._sum.totalMinor ?? 0,
    bookings: result._count,
    label: formatMinor(result._sum.totalMinor ?? 0, args.currency),
  }
}

export function stayLength(checkIn: Date, checkOut: Date): number {
  return nightsBetween(checkIn, checkOut)
}
