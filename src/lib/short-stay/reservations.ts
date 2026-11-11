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
import { reservationCode, portalAccessCode } from '@/lib/core/ids'
import { dateOnly, nightsBetween } from '@/lib/core/dates'
import { normalisePhone, phoneVariants } from '@/lib/core/phone'
import { assertAvailable } from './availability'
import { quoteFromUnit, type Quote } from './pricing'
import { validateCoupon, recordRedemption } from '@/lib/marketplace/coupons'
import { notifyBookingCancelled, notifyBookingConfirmed } from '@/lib/notify'
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
  /** Checkout extras: airport pickup, early check-in, cot… */
  addOns?: { addOnId: string; qty: number }[]
  /** Validated inside the transaction; invalid codes abort the booking. */
  couponCode?: string
  arrivalTime?: string | null
  purpose?: string | null
  /** Unpaid web requests hold inventory only this long. */
  expiresAt?: Date | null
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
    if (existing) return { reservation: existing, quote: null, created: false as const, portalCode: existing.portalCode }
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

    // Checkout extras, resolved inside the transaction so two submissions can
    // never double-apply an add-on or a coupon.
    const addOnLines: { addOnId: string; name: string; qty: number; unitAmountMinor: number; amountMinor: number; currency: Currency }[] = []
    if (input.addOns?.length) {
      const ids = input.addOns.map((a) => a.addOnId)
      const rows = await tx.addOn.findMany({
        where: { id: { in: ids }, active: true, OR: [{ unitId: null }, { unitId: unit.id }] },
      })
      for (const sel of input.addOns) {
        const row = rows.find((r) => r.id === sel.addOnId)
        if (!row) continue
        const qty = Math.max(1, Math.min(sel.qty, row.maxQty))
        addOnLines.push({ addOnId: row.id, name: row.name, qty, unitAmountMinor: row.priceMinor, amountMinor: row.priceMinor * qty, currency: row.currency })
      }
    }
    const addOnsTotalMinor = addOnLines.reduce((s, l) => s + l.amountMinor, 0)

    let couponDiscount = 0
    let couponId: string | null = null
    if (input.couponCode) {
      const check = await validateCoupon(input.couponCode, {
        propertyId: unit.propertyId,
        partyId: guestPartyId,
        subtotalMinor: quote.totalMinor,
        currency: quote.currency,
      })
      if (!check.ok) throw new Error(check.error)
      couponDiscount = check.discountMinor
      couponId = check.coupon.id
    }

    const totalMinor = Math.max(0, quote.totalMinor + addOnsTotalMinor - couponDiscount)
    const nightlyChargeMinor = Math.max(0, quote.accommodationMinor - quote.discountMinor - couponDiscount)

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
        discountMinor: quote.discountMinor + couponDiscount,
        totalMinor,
        depositMinor: quote.depositMinor,
        guestNotes: input.guestNotes ?? null,
        internalNotes: input.internalNotes ?? null,
        arrivalTime: input.arrivalTime ?? null,
        purpose: input.purpose ?? null,
        expiresAt: input.expiresAt ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    })

    // The stay itself, due on arrival. Promo discounts reduce this charge so
    // the accounting stays one line, not a shadow ledger.
    await postCharge(
      {
        propertyId: unit.propertyId,
        partyId: guestPartyId,
        unitId: unit.id,
        type: 'NIGHTLY_STAY',
        description: `${quote.nights} night${quote.nights === 1 ? '' : 's'} at ${unit.name}, ${formatDate(reservation.checkIn)} to ${formatDate(reservation.checkOut)}`,
        amountMinor: nightlyChargeMinor,
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

    // Extras become their own charges, priced from a snapshot so historical
    // prices never shift when the add-on catalogue changes.
    for (const line of addOnLines) {
      await postCharge(
        {
          propertyId: unit.propertyId,
          partyId: guestPartyId,
          unitId: unit.id,
          type: 'ADD_ON',
          description: `${line.name}${line.qty > 1 ? ` × ${line.qty}` : ''} — booking ${reservation.code}`,
          amountMinor: line.amountMinor,
          currency: line.currency,
          dueDate: reservation.checkIn,
          reservationId: reservation.id,
          actorUserId: input.actorUserId,
        },
        tx
      )
      await tx.reservationAddOn.create({
        data: {
          reservationId: reservation.id,
          addOnId: line.addOnId,
          name: line.name,
          qty: line.qty,
          unitAmountMinor: line.unitAmountMinor,
          amountMinor: line.amountMinor,
          currency: line.currency,
        },
      })
    }

    if (couponId) {
      await recordRedemption({
        couponId,
        reservationId: reservation.id,
        guestPartyId,
        amountMinor: couponDiscount,
      })
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

    // A booking the desk creates as already-confirmed (walk-in paying at the
    // desk) gets portal access on the same terms as one confirmed later.
    const portalCode =
      reservation.status === 'CONFIRMED' ? await ensurePortalAccess(reservation.id) : null

    return { reservation, quote, created: true as const, portalCode }
  })
}

// ---------------------------------------------------------------------------
// Portal access — the code management reads out to the guest
// ---------------------------------------------------------------------------

/** Statuses that earn portal access. A cancelled stay opens nothing. */
const PORTAL_ACCESS_STATUSES = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']

/**
 * Make sure a confirmed stay has a portal code and the guest has an account
 * to sign into. Safe to call repeatedly — it mints nothing that exists.
 *
 * The code is stored in plain text on purpose: management reads it out over
 * the phone and pastes it into WhatsApp, so a hash would defeat the point.
 * It is only ever usable together with the guest's email or phone.
 */
export async function ensurePortalAccess(reservationId: string): Promise<string | null> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      portalCode: true,
      guestPartyId: true,
      guest: { select: { id: true, name: true, email: true, phone: true } },
    },
  })
  if (!reservation) throw new Error('Reservation not found.')
  if (!PORTAL_ACCESS_STATUSES.includes(reservation.status)) return null

  if (reservation.portalCode) {
    // Older bookings may have a code but no guest account behind it yet.
    await ensureGuestPortalUser(reservation.guest)
    return reservation.portalCode
  }

  let issued: string | null = null
  for (let attempt = 0; attempt < 5 && !issued; attempt++) {
    const candidate = portalAccessCode()
    try {
      // The portalCode: null filter makes two desks issuing at the same
      // instant safe — exactly one of them wins, the loser reads the winner's.
      const result = await db.reservation.updateMany({
        where: { id: reservationId, portalCode: null },
        data: { portalCode: candidate, portalCodeIssuedAt: new Date() },
      })

      if (result.count === 1) {
        issued = candidate
        break
      }

      const fresh = await db.reservation.findUnique({
        where: { id: reservationId },
        select: { portalCode: true },
      })
      issued = fresh?.portalCode ?? null
    } catch (error) {
      // Another booking already holds this exact code — mint a different one.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error
      }
    }
  }
  if (!issued) throw new Error('Could not allocate a portal code. Try again.')

  await ensureGuestPortalUser(reservation.guest)
  return issued
}

/**
 * Every confirmed guest gets a portal account, so a code someone reads out
 * over the phone resolves to a real user. No password is set — the guest
 * signs in with their booking's portal code, or a one-time SMS code.
 */
async function ensureGuestPortalUser(
  party: { id: string; name: string; email: string | null; phone: string | null }
) {
  const linked = await db.user.findUnique({ where: { partyId: party.id } })
  if (linked) return linked

  const byEmail = party.email
    ? await db.user.findUnique({ where: { email: party.email.toLowerCase() } })
    : null
  const byPhone = party.phone
    ? await db.user.findFirst({ where: { phone: { in: phoneVariants(party.phone) } } })
    : null

  // An unclaimed account with the same contact details is the same person
  // coming back — link it rather than duplicate it.
  const unclaimed = [byEmail, byPhone].find((u) => u && !u.partyId && u.role === 'TENANT')
  if (unclaimed) {
    return db.user.update({ where: { id: unclaimed.id }, data: { partyId: party.id } })
  }

  return db.user.create({
    data: {
      name: party.name,
      // Email and phone are unique across every account, staff included. If
      // the contact detail already belongs to someone else, leave it off
      // rather than fail the booking.
      email: byEmail ? null : (party.email?.toLowerCase() ?? null),
      phone: byPhone ? null : party.phone,
      role: 'TENANT',
      active: true,
      partyId: party.id,
    },
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

  // Confirmation is when the guest earns portal access: the code is minted
  // here, shown to the desk for sharing, and sent with the confirmation on
  // every channel the guest has — email, SMS and WhatsApp.
  const portalCode = await ensurePortalAccess(reservationId)

  await notifyBookingConfirmed(reservation.id)

  return { ...reservation, portalCode }
}

/**
 * Cancelling reverses every ledger entry raised for the stay, so a cancelled
 * booking leaves a visible history rather than a hole where a charge was.
 */
export async function cancelReservation(
  reservationId: string,
  args: { reason: string; actorUserId?: string | null }
) {
  const result = await db.$transaction(async (tx) => {
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

  await notifyBookingCancelled(reservationId, args.reason)
  return result
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
