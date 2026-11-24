/**
 * Changing the dates of a confirmed booking.
 *
 * The ledger is append-only, so nothing that was charged is rewritten. The
 * original charge keeps its amount and only its dates move; if the new dates
 * cost more, a second charge is added for the difference. A move that costs
 * LESS is refused here: money has to go back, and that is a decision for a
 * person, made through the cancellation policy, not a side effect of a form.
 *
 * Postgres holds an exclusion constraint on a room's dates, so two guests
 * moving onto the same nights at once cannot both succeed.
 */

import type { Currency } from '@prisma/client'
import { db, TX_OPTS } from '@/lib/db'
import { postCharge, reverseEntry } from '@/lib/core/ledger'
import { dateOnly, formatDate } from '@/lib/core/dates'
import { assertAvailable } from './availability'
import { quoteFromUnit } from './pricing'

export type DateChangeQuote =
  | {
      ok: true
      nights: number
      currency: Currency
      /** What the stay itself cost before, and costs on the new dates. */
      oldStayMinor: number
      newStayMinor: number
      /** newStay - oldStay. Positive: more to pay. Negative: costs less. */
      differenceMinor: number
      newTotalMinor: number
    }
  | { ok: false; error: string }

/**
 * Price a move to new dates without changing anything.
 *
 * The stay is re-priced at today's rates for the new nights. Cleaning and
 * extras are per booking, not per night, so they carry over as charged.
 * Bookings made with a promo code are refused: the discount was worked out
 * against the original dates and has to be redone by a person.
 */
export async function quoteDateChange(
  reservationId: string,
  args: { checkIn: Date; checkOut: Date }
): Promise<DateChangeQuote> {
  const checkIn = dateOnly(args.checkIn)
  const checkOut = dateOnly(args.checkOut)
  if (!(checkOut > checkIn)) return { ok: false, error: 'Check-out must be after check-in.' }

  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    include: {
      unit: { include: { ratePlans: { where: { active: true } } } },
      addOns: { select: { amountMinor: true } },
    },
  })
  if (!reservation) return { ok: false, error: 'That booking was not found.' }
  if (reservation.status !== 'CONFIRMED') {
    return { ok: false, error: 'Only a confirmed booking that has not started can be moved online.' }
  }
  if (reservation.discountMinor > 0) {
    return { ok: false, error: 'This booking has a discount applied, so our team needs to move it for you.' }
  }
  if (
    dateOnly(reservation.checkIn).getTime() === checkIn.getTime() &&
    dateOnly(reservation.checkOut).getTime() === checkOut.getTime()
  ) {
    return { ok: false, error: 'Those are the dates you already have.' }
  }

  const quote = quoteFromUnit(reservation.unit, {
    checkIn,
    checkOut,
    guests: reservation.adults + reservation.children,
  })
  const blocking = quote.violations.filter((v) => !v.startsWith('Weekly rate applied'))
  if (blocking.length > 0) return { ok: false, error: blocking.join(' ') }
  if (quote.currency !== reservation.currency) {
    return { ok: false, error: 'This room is now priced in a different currency, so our team needs to move it for you.' }
  }

  try {
    await assertAvailable({ unitId: reservation.unitId, checkIn, checkOut, excludeReservationId: reservation.id })
  } catch {
    // The guest is told only that the dates are taken, never by whom.
    return { ok: false, error: 'Those dates are not available for this home.' }
  }

  const addOnsMinor = reservation.addOns.reduce((s, a) => s + a.amountMinor, 0)
  const oldStayMinor = reservation.totalMinor - reservation.cleaningFeeMinor - addOnsMinor
  const newStayMinor = quote.accommodationMinor
  return {
    ok: true,
    nights: quote.nights,
    currency: reservation.currency,
    oldStayMinor,
    newStayMinor,
    differenceMinor: newStayMinor - oldStayMinor,
    newTotalMinor: newStayMinor + reservation.cleaningFeeMinor + addOnsMinor,
  }
}

export type DateChangeResult = {
  code: string
  unitName: string
  propertyId: string
  guestPartyId: string
  before: { checkIn: Date; checkOut: Date; totalMinor: number }
  after: { checkIn: Date; checkOut: Date; totalMinor: number; nights: number }
  differenceMinor: number
  currency: Currency
}

/** Move a confirmed booking to new dates. Throws a message fit to show. */
export async function changeReservationDates(
  reservationId: string,
  args: {
    checkIn: Date
    checkOut: Date
    actorUserId?: string | null
    /**
     * Staff only. Lets the stay move to dates that cost LESS. The stay's
     * charges are reversed and one new charge posted at the lower price, and
     * what the guest has paid is carried across to it. Anything paid beyond
     * the new price is left as credit on their account, for staff to refund.
     */
    allowCheaper?: boolean
  }
): Promise<DateChangeResult> {
  const priced = await quoteDateChange(reservationId, args)
  if (!priced.ok) throw new Error(priced.error)
  if (priced.differenceMinor < 0 && !args.allowCheaper) {
    throw new Error(
      'The new dates cost less than the booking. Our team needs to make this change so your refund is handled properly.'
    )
  }
  const checkIn = dateOnly(args.checkIn)
  const checkOut = dateOnly(args.checkOut)

  try {
    return await db.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: { unit: { select: { name: true, propertyId: true } } },
      })
      // Re-checked inside the transaction: the price above was read outside it.
      if (reservation.status !== 'CONFIRMED') throw new Error('This booking can no longer be moved.')

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          checkIn,
          checkOut,
          nights: priced.nights,
          nightlyRateMinor: Math.round(priced.newStayMinor / priced.nights),
          totalMinor: priced.newTotalMinor,
          // The day-before message must go out again for the new arrival.
          checkInNoticeSentAt: null,
        },
      })

      if (priced.differenceMinor < 0) {
        // Cheaper. The ledger cannot be edited, so the stay's charges are
        // reversed and one posted at the new price.
        const old = await tx.charge.findMany({
          where: { reservationId, type: 'NIGHTLY_STAY', status: { notIn: ['REVERSED', 'WAIVED'] } },
          include: { ledgerEntries: { where: { kind: 'CHARGE' } }, allocations: true },
        })
        // What each payment had put towards the stay, before anything moves.
        const paidBy = new Map<string, number>()
        for (const c of old) for (const a of c.allocations) paidBy.set(a.paymentId, (paidBy.get(a.paymentId) ?? 0) + a.amountMinor)

        for (const c of old) {
          for (const entry of c.ledgerEntries) {
            await reverseEntry(
              entry.id,
              { reason: `Dates changed on booking ${reservation.code}; stay re-priced`, actorUserId: args.actorUserId },
              tx
            )
          }
        }
        await tx.allocation.deleteMany({ where: { chargeId: { in: old.map((c) => c.id) } } })

        const { charge } = await postCharge(
          {
            propertyId: reservation.unit.propertyId,
            partyId: reservation.guestPartyId,
            unitId: reservation.unitId,
            type: 'NIGHTLY_STAY',
            description: `${priced.nights} night${priced.nights === 1 ? '' : 's'} at ${reservation.unit.name}, ${formatDate(checkIn)} to ${formatDate(checkOut)} (dates changed)`,
            amountMinor: priced.newStayMinor,
            currency: priced.currency,
            dueDate: checkIn,
            periodStart: checkIn,
            periodEnd: checkOut,
            reservationId,
            actorUserId: args.actorUserId,
          },
          tx
        )

        // Carry what was paid across to the new charge, up to its price. The
        // rest stays on the guest's account as credit.
        let remaining = priced.newStayMinor
        for (const [paymentId, paid] of paidBy) {
          const take = Math.min(paid, remaining)
          if (take <= 0) break
          await tx.allocation.create({ data: { paymentId, chargeId: charge.id, amountMinor: take } })
          remaining -= take
        }
        const settled = priced.newStayMinor - remaining
        if (settled > 0) {
          await tx.charge.update({
            where: { id: charge.id },
            data: { status: remaining === 0 ? 'SETTLED' : 'PART_PAID' },
          })
        }
      }

      // What is already charged keeps its amount; it now falls due on the new
      // arrival date, so it is counted as revenue in the right month.
      await tx.charge.updateMany({
        where: { reservationId, status: { notIn: ['REVERSED', 'WAIVED'] } },
        data: { dueDate: checkIn },
      })
      await tx.charge.updateMany({
        where: { reservationId, type: 'NIGHTLY_STAY', status: { notIn: ['REVERSED', 'WAIVED'] } },
        data: { periodStart: checkIn, periodEnd: checkOut },
      })

      if (priced.differenceMinor > 0) {
        await postCharge(
          {
            propertyId: reservation.unit.propertyId,
            partyId: reservation.guestPartyId,
            unitId: reservation.unitId,
            type: 'NIGHTLY_STAY',
            description: `Date change on booking ${reservation.code}: now ${priced.nights} night${priced.nights === 1 ? '' : 's'} at ${reservation.unit.name}, ${formatDate(checkIn)} to ${formatDate(checkOut)} (difference)`,
            amountMinor: priced.differenceMinor,
            currency: priced.currency,
            dueDate: checkIn,
            periodStart: checkIn,
            periodEnd: checkOut,
            reservationId,
            actorUserId: args.actorUserId,
          },
          tx
        )
      }

      // The changeover clean follows the new departure.
      await tx.housekeepingTask.updateMany({
        where: { reservationId, type: 'TURNOVER', status: 'PENDING' },
        data: { dueAt: checkOut },
      })

      return {
        code: reservation.code,
        unitName: reservation.unit.name,
        propertyId: reservation.unit.propertyId,
        guestPartyId: reservation.guestPartyId,
        before: { checkIn: reservation.checkIn, checkOut: reservation.checkOut, totalMinor: reservation.totalMinor },
        after: { checkIn, checkOut, totalMinor: priced.newTotalMinor, nights: priced.nights },
        differenceMinor: priced.differenceMinor,
        currency: priced.currency,
      }
    }, TX_OPTS)
  } catch (error) {
    // The exclusion constraint: someone took those nights a moment ago.
    if (error instanceof Error && /reservation_no_overlap|exclusion/i.test(error.message)) {
      throw new Error('Those dates have just been taken. Please choose others.')
    }
    throw error
  }
}
