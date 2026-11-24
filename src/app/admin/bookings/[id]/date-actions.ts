'use server'

/**
 * Staff moving a confirmed booking to other dates.
 *
 * Same price or dearer: anyone who can edit bookings in that building. A move
 * that costs LESS changes what the guest owes, so it also needs the right to
 * adjust money (administrators and finance). The front desk can take
 * bookings; it cannot quietly reduce what one costs.
 */

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireActor } from '@/lib/session'
import { AccessError, assertCanOnProperty, can } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { formatDate } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import { changeReservationDates, quoteDateChange } from '@/lib/short-stay/date-change'
import { refreshUnitFeeds } from '@/lib/short-stay/ical'
import { emailHtml, queueMessage } from '@/lib/notify'
import { siteUrl } from '@/lib/site-url'

export type StaffDatePreview =
  | { ok: true; kind: 'same' | 'more' | 'less'; allowed: boolean; message: string }
  | { ok: false; error: string }

export type StaffDateResult = { ok: true; message: string } | { ok: false; error: string }

function parseDay(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

async function load(reservationId: string) {
  const actor = await requireActor()
  const reservation = await db.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: { id: true, code: true, unitId: true, unit: { select: { propertyId: true } } },
  })
  assertCanOnProperty(actor, 'bookings:write', reservation.unit.propertyId)
  return { actor, reservation }
}

function fail(error: unknown, fallback: string): { ok: false; error: string } {
  const ours = error instanceof AccessError || (error instanceof Error && error.constructor === Error)
  if (!ours) console.error('[bookings] date change failed', error)
  return { ok: false, error: ours ? (error as Error).message : fallback }
}

export async function previewBookingDatesAction(
  reservationId: string,
  rawIn: string,
  rawOut: string
): Promise<StaffDatePreview> {
  try {
    const { actor, reservation } = await load(reservationId)
    const checkIn = parseDay(rawIn)
    const checkOut = parseDay(rawOut)
    if (!checkIn || !checkOut) return { ok: false, error: 'Choose both dates.' }

    await refreshUnitFeeds(reservation.unitId)
    const quote = await quoteDateChange(reservation.id, { checkIn, checkOut })
    if (!quote.ok) return { ok: false, error: quote.error }

    const diff = formatMinor(Math.abs(quote.differenceMinor), quote.currency)
    const total = formatMinor(quote.newTotalMinor, quote.currency)
    if (quote.differenceMinor === 0) {
      return { ok: true, kind: 'same', allowed: true, message: `Free, at the same price. ${quote.nights} nights, total ${total}.` }
    }
    if (quote.differenceMinor > 0) {
      return {
        ok: true,
        kind: 'more',
        allowed: true,
        message: `Free. ${diff} more: a charge for the difference is added to the guest’s account. ${quote.nights} nights, new total ${total}.`,
      }
    }
    const allowed = can(actor, 'money:adjust')
    return {
      ok: true,
      kind: 'less',
      allowed,
      message: allowed
        ? `Free. ${diff} less: the stay is re-priced and anything the guest has paid above the new total (${total}) is left as credit on their account for you to refund.`
        : `Free, but ${diff} less. Reducing what a booking costs needs an administrator or finance.`,
    }
  } catch (error) {
    return fail(error, 'Could not check those dates.')
  }
}

export async function changeBookingDatesAction(
  reservationId: string,
  rawIn: string,
  rawOut: string
): Promise<StaffDateResult> {
  try {
    const { actor, reservation } = await load(reservationId)
    const checkIn = parseDay(rawIn)
    const checkOut = parseDay(rawOut)
    if (!checkIn || !checkOut) return { ok: false, error: 'Choose both dates.' }

    await refreshUnitFeeds(reservation.unitId)
    const result = await changeReservationDates(reservation.id, {
      checkIn,
      checkOut,
      actorUserId: actor.id,
      allowCheaper: can(actor, 'money:adjust'),
    })

    await logAudit({
      actor,
      action: 'booking.dates_changed',
      entityType: 'Reservation',
      entityId: reservation.id,
      before: { checkIn: result.before.checkIn, checkOut: result.before.checkOut, totalMinor: result.before.totalMinor },
      after: { checkIn: result.after.checkIn, checkOut: result.after.checkOut, totalMinor: result.after.totalMinor },
    })

    const when = `${formatDate(result.after.checkIn)} to ${formatDate(result.after.checkOut)}`
    const money =
      result.differenceMinor > 0
        ? `${formatMinor(result.differenceMinor, result.currency)} more is now due.`
        : result.differenceMinor < 0
          ? `The stay now costs ${formatMinor(-result.differenceMinor, result.currency)} less.`
          : 'The price is unchanged.'

    // Telling the guest must never undo a change that has been made.
    try {
      const guest = await db.party.findUnique({
        where: { id: result.guestPartyId },
        select: { name: true, email: true, phone: true },
      })
      if (guest?.email) {
        await queueMessage({
          channel: 'EMAIL',
          to: guest.email,
          template: 'booking_dates_changed',
          entityType: 'Reservation',
          entityId: reservation.id,
          subject: `Your new dates · ${result.code}`,
          body: emailHtml({
            heading: 'Your dates have been changed',
            lines: [
              `<b>${result.unitName}</b>`,
              `New dates: <b>${when}</b> · ${result.after.nights} night${result.after.nights === 1 ? '' : 's'}`,
              `Before: ${formatDate(result.before.checkIn)} to ${formatDate(result.before.checkOut)}`,
              money,
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
          entityId: reservation.id,
          body: `Hello ${guest.name.split(' ')[0]}, your stay at ${result.unitName} is now ${when}. Ref ${result.code}. ${money} ABN Homes, 054 170 4048.`,
        })
      }
    } catch (error) {
      console.error('[bookings] date change notice failed', error)
    }

    revalidatePath(`/admin/bookings/${reservation.id}`)
    revalidatePath('/admin/calendar')
    return { ok: true, message: `Moved to ${when}. ${money} The guest has been told.` }
  } catch (error) {
    return fail(error, 'Could not change the dates.')
  }
}
