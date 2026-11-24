'use server'

/**
 * A guest moving their own booking to different dates.
 *
 * Three outcomes, decided on the server from live prices and availability:
 *   - the new dates cost the same: the booking simply moves;
 *   - they cost more: the booking moves and the difference is added to the
 *     guest's balance, payable from the portal;
 *   - they cost less: nothing moves. The office is alerted and handles the
 *     change and the refund, because money going back is a person's decision.
 *
 * Guard rails:
 *   - the booking is found through the guest's own account, never by id alone;
 *   - only while a cancellation would still be refunded in full. Otherwise a
 *     guest inside the non-refundable window could move the stay a year out
 *     and then cancel it for a full refund;
 *   - at most three moves per booking, so dates cannot be held and shuffled.
 */

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireParty } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { dateOnly, formatDate, nightsBetween } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import { refundPercent } from '@/lib/core/cancellation'
import { getCancellationPolicy } from '@/lib/policies'
import { changeReservationDates, quoteDateChange } from '@/lib/short-stay/date-change'
import { refreshUnitFeeds } from '@/lib/short-stay/ical'
import { raiseAlert } from '@/lib/alerts/dispatch'
import { emailHtml, queueMessage } from '@/lib/notify'
import { siteUrl } from '@/lib/site-url'

const MAX_MOVES = 3
const MAX_NIGHTS = 60
const CALL_US = 'Please call or WhatsApp us on 054 170 4048.'

export type DateChangePreview =
  | {
      ok: true
      kind: 'same' | 'more' | 'less'
      nights: number
      /** Formatted, ready to show. */
      difference: string
      newTotal: string
      message: string
    }
  | { ok: false; error: string }

export type DateChangeOutcome = { ok: true; moved: boolean; message: string } | { ok: false; error: string }

function parseDay(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Everything that must be true before a guest may move this booking. */
async function eligible(reservationId: string, rawIn: string, rawOut: string) {
  const { actor, partyId } = await requireParty()

  const checkIn = parseDay(rawIn)
  const checkOut = parseDay(rawOut)
  if (!checkIn || !checkOut) return { error: 'Choose both dates.' } as const
  const today = dateOnly(new Date())
  if (checkIn <= today) return { error: 'The new arrival date must be in the future.' } as const
  if (checkOut <= checkIn) return { error: 'Check-out must be after check-in.' } as const
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) {
    return { error: `Stays of more than ${MAX_NIGHTS} nights are arranged with our team. ${CALL_US}` } as const
  }

  const stay = await db.reservation.findFirst({
    where: { id: reservationId, guestPartyId: partyId },
    select: { id: true, code: true, status: true, checkIn: true, unitId: true },
  })
  if (!stay) return { error: 'That booking was not found on your account.' } as const
  if (stay.status !== 'CONFIRMED' || dateOnly(stay.checkIn) <= today) {
    return { error: `This booking can no longer be changed online. ${CALL_US}` } as const
  }

  const policy = await getCancellationPolicy()
  if (refundPercent(policy, stay.checkIn) < 100) {
    return { error: `Your stay is too close to change online. ${CALL_US}` } as const
  }

  const moves = await db.auditEvent.count({
    where: { entityType: 'Reservation', entityId: stay.id, action: 'booking.dates_changed' },
  })
  if (moves >= MAX_MOVES) {
    return { error: `This booking has already been moved ${MAX_MOVES} times. ${CALL_US}` } as const
  }

  return { actor, stay, checkIn, checkOut } as const
}

export async function previewDateChangeAction(
  reservationId: string,
  rawIn: string,
  rawOut: string
): Promise<DateChangePreview> {
  try {
    const check = await eligible(reservationId, rawIn, rawOut)
    if ('error' in check) return { ok: false, error: check.error ?? 'Not available.' }

    // A booking taken on Airbnb or Booking.com a minute ago must count.
    await refreshUnitFeeds(check.stay.unitId)

    const quote = await quoteDateChange(check.stay.id, { checkIn: check.checkIn, checkOut: check.checkOut })
    if (!quote.ok) return { ok: false, error: quote.error }

    const diff = formatMinor(Math.abs(quote.differenceMinor), quote.currency)
    const kind = quote.differenceMinor === 0 ? 'same' : quote.differenceMinor > 0 ? 'more' : 'less'
    return {
      ok: true,
      kind,
      nights: quote.nights,
      difference: diff,
      newTotal: formatMinor(quote.newTotalMinor, quote.currency),
      message:
        kind === 'same'
          ? 'Those dates are free, at the same price.'
          : kind === 'more'
            ? `Those dates are free. They cost ${diff} more, which is added to your balance to pay before you arrive.`
            : `Those dates are free and cost ${diff} less. Because money is due back to you, our team makes this change: send the request and we will confirm it and your refund within one working day.`,
    }
  } catch (error) {
    console.error('[portal] date change preview failed', error)
    return { ok: false, error: `We could not check those dates just now. ${CALL_US}` }
  }
}

export async function changeMyStayDatesAction(
  reservationId: string,
  rawIn: string,
  rawOut: string
): Promise<DateChangeOutcome> {
  try {
    const check = await eligible(reservationId, rawIn, rawOut)
    if ('error' in check) return { ok: false, error: check.error ?? 'Not available.' }
    const { actor, stay, checkIn, checkOut } = check

    await refreshUnitFeeds(stay.unitId)
    const quote = await quoteDateChange(stay.id, { checkIn, checkOut })
    if (!quote.ok) return { ok: false, error: quote.error }

    // Costs less: a request for the office, not a change.
    if (quote.differenceMinor < 0) {
      const unit = await db.unit.findUnique({ where: { id: stay.unitId }, select: { name: true, propertyId: true } })
      await logAudit({
        actor,
        action: 'booking.date_change_requested',
        entityType: 'Reservation',
        entityId: stay.id,
        after: { checkIn: rawIn, checkOut: rawOut, differenceMinor: quote.differenceMinor },
      })
      await raiseAlert('booking.changed', {
        title: `Date change requested: ${unit?.name ?? 'a room'}, ${stay.code}`,
        body: `The guest asks to move to ${formatDate(checkIn)} to ${formatDate(checkOut)} (${quote.nights} nights). That costs ${formatMinor(-quote.differenceMinor, quote.currency)} less, so it needs the office: make the change and settle the refund under the cancellation policy. The new dates are NOT held.`,
        link: `/admin/bookings/${stay.id}`,
        propertyId: unit?.propertyId ?? null,
        metadata: { ref: stay.code },
      })
      return {
        ok: true,
        moved: false,
        message:
          'Your request has been sent. We will confirm the new dates and your refund within one working day. Until then your current dates stand, and the new ones are not held.',
      }
    }

    const result = await changeReservationDates(stay.id, { checkIn, checkOut, actorUserId: actor.id })

    await logAudit({
      actor,
      action: 'booking.dates_changed',
      entityType: 'Reservation',
      entityId: stay.id,
      before: { checkIn: result.before.checkIn, checkOut: result.before.checkOut, totalMinor: result.before.totalMinor },
      after: { checkIn: result.after.checkIn, checkOut: result.after.checkOut, totalMinor: result.after.totalMinor },
    })

    const extra = result.differenceMinor > 0 ? formatMinor(result.differenceMinor, result.currency) : null
    const when = `${formatDate(result.after.checkIn)} to ${formatDate(result.after.checkOut)}`

    // None of what follows may undo a change that has already been made.
    try {
      const guest = await db.party.findUnique({
        where: { id: result.guestPartyId },
        select: { name: true, email: true, phone: true },
      })
      const first = guest?.name.split(' ')[0] ?? 'there'
      if (guest?.email) {
        await queueMessage({
          channel: 'EMAIL',
          to: guest.email,
          template: 'booking_dates_changed',
          entityType: 'Reservation',
          entityId: stay.id,
          subject: `Your new dates · ${result.code}`,
          body: emailHtml({
            heading: 'Your dates have been changed',
            lines: [
              `<b>${result.unitName}</b>`,
              `New dates: <b>${when}</b> · ${result.after.nights} night${result.after.nights === 1 ? '' : 's'}`,
              `Before: ${formatDate(result.before.checkIn)} to ${formatDate(result.before.checkOut)}`,
              extra
                ? `The new dates cost ${extra} more. It has been added to your balance; please pay it in your portal before you arrive.`
                : 'The price is unchanged.',
            ],
            cta: { label: 'Open my portal', url: `${siteUrl()}/portal` },
          }),
        })
      }
      if (guest?.phone) {
        await queueMessage({
          channel: 'SMS',
          to: guest.phone,
          template: 'booking_dates_changed',
          entityType: 'Reservation',
          entityId: stay.id,
          body: `Hello ${first}, your stay at ${result.unitName} is now ${when}. Ref ${result.code}.${extra ? ` ${extra} more is due before arrival.` : ''} ABN Homes, 054 170 4048.`,
        })
      }
      await raiseAlert('booking.changed', {
        title: `Dates changed by guest: ${result.unitName}, ${result.code}`,
        body: `Now ${when} (was ${formatDate(result.before.checkIn)} to ${formatDate(result.before.checkOut)}).${extra ? ` ${extra} more has been charged and is unpaid.` : ' Same price.'}`,
        link: `/admin/bookings/${stay.id}`,
        propertyId: result.propertyId,
        metadata: { ref: result.code },
      })
    } catch (error) {
      console.error('[portal] date change notices failed', error)
    }

    revalidatePath('/portal/tenant')
    return {
      ok: true,
      moved: true,
      message: extra
        ? `Done. Your stay is now ${when}. ${extra} more has been added to your balance.`
        : `Done. Your stay is now ${when}, at the same price.`,
    }
  } catch (error) {
    const ours = error instanceof Error && error.constructor === Error
    if (!ours) console.error('[portal] date change failed', error)
    return { ok: false, error: ours ? (error as Error).message : `We could not change the dates just now. ${CALL_US}` }
  }
}
