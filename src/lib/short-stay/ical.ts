/**
 * Calendar feed sync.
 *
 * ABN lists on the booking sites but blocks dates by hand, which is exactly
 * how a guest ends up arriving at an occupied unit. Full channel management is
 * weeks of work; this is a day, and it closes most of the gap.
 *
 *   IMPORT: pull each listing's feed and block those dates here.
 *   EXPORT: publish a feed per unit so the booking sites block ours.
 *
 * It is not instant — the platforms poll every few hours — so it reduces the
 * double-booking window rather than eliminating it. Until a real channel
 * manager exists, a same-day direct booking still deserves a glance at the
 * Airbnb app.
 */

import icalGenerator from 'ical-generator'
import { db, TX_OPTS } from '@/lib/db'
import { dateOnly, toISODate } from '@/lib/core/dates'
import { raiseAlert } from '@/lib/alerts/dispatch'
import { BLOCKING_STATUSES } from './availability'

/** A booking site that does not answer in this long is treated as a failed sync. */
const FETCH_TIMEOUT_MS = 10_000
/** Real calendars are a few kilobytes; this is a guard against a wrong URL. */
const MAX_FEED_BYTES = 2 * 1024 * 1024

async function fetchFeed(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'ABN Homes calendar sync', Accept: 'text/calendar, */*' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`The booking site answered ${response.status}. Check the calendar link is still valid.`)
  const text = await response.text()
  if (text.length > MAX_FEED_BYTES) throw new Error('That link returned far more than a calendar. Check it is the calendar export link.')
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('That link did not return a calendar. Copy the export link again from the booking site.')
  return text
}

/**
 * The feed for one unit, in the form the booking sites expect: one all-day
 * VEVENT per occupied range, DTEND exclusive.
 */
export async function exportUnitCalendar(unitId: string): Promise<string> {
  const unit = await db.unit.findUniqueOrThrow({
    where: { id: unitId },
    include: { property: { select: { name: true } } },
  })

  const [reservations, blocks] = await Promise.all([
    db.reservation.findMany({
      where: {
        unitId,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        checkOut: { gte: dateOnly(new Date()) },
      },
    }),
    db.calendarBlock.findMany({
      where: {
        unitId,
        // Never echo an imported block back to its own source.
        source: { in: ['MANUAL', 'MAINTENANCE', 'OWNER_USE'] },
        endDate: { gte: dateOnly(new Date()) },
      },
    }),
  ])

  const calendar = icalGenerator({
    name: `${unit.property.name} — ${unit.name}`,
    prodId: { company: 'ABN Homes', product: 'Operations Platform', language: 'EN' },
    timezone: 'Africa/Accra',
  })

  for (const reservation of reservations) {
    calendar.createEvent({
      id: `reservation-${reservation.id}@abnhomes`,
      start: dateOnly(reservation.checkIn),
      end: dateOnly(reservation.checkOut),
      allDay: true,
      summary: 'Unavailable',
      description: `ABN booking ${reservation.code}`,
    })
  }

  for (const block of blocks) {
    calendar.createEvent({
      id: `block-${block.id}@abnhomes`,
      start: dateOnly(block.startDate),
      end: dateOnly(block.endDate),
      allDay: true,
      summary: 'Unavailable',
      description: block.reason ?? 'Blocked',
    })
  }

  return calendar.toString()
}

export type SyncResult = {
  feedId: string
  label: string
  ok: boolean
  imported: number
  removed: number
  error?: string
}

/**
 * Pull one feed and replace this feed's blocks with what it now says.
 *
 * Replacing wholesale rather than merging is deliberate: a booking cancelled
 * on Airbnb simply disappears from their feed, and a merge would keep those
 * dates blocked here forever. Only blocks belonging to this feed are touched.
 */
export async function importFeed(feedId: string): Promise<SyncResult> {
  const feed = await db.icalFeed.findUniqueOrThrow({
    where: { id: feedId },
    include: { unit: { select: { name: true, propertyId: true } } },
  })

  try {
    // node-ical is CommonJS: depending on the bundler, its API arrives on the
    // module itself or under `default`. Accept either.
    const mod = await import('node-ical')
    const nodeIcal = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod
    const events = nodeIcal.sync.parseICS(await fetchFeed(feed.url))

    const ranges: Array<{ start: Date; end: Date; summary: string; uid: string }> = []

    for (const value of Object.values(events)) {
      const event = value as {
        type?: string
        start?: Date
        end?: Date
        summary?: string
        uid?: string
      }
      if (event.type !== 'VEVENT' || !event.start || !event.end) continue

      ranges.push({
        start: dateOnly(event.start),
        end: dateOnly(event.end),
        summary: typeof event.summary === 'string' ? event.summary : 'Unavailable',
        uid: event.uid ?? `${toISODate(dateOnly(event.start))}-${toISODate(dateOnly(event.end))}`,
      })
    }

    const result = await db.$transaction(async (tx) => {
      const { count: removed } = await tx.calendarBlock.deleteMany({ where: { feedId } })

      let imported = 0
      for (const range of ranges) {
        if (range.end <= range.start) continue
        await tx.calendarBlock.create({
          data: {
            unitId: feed.unitId,
            startDate: range.start,
            endDate: range.end,
            source: 'ICAL',
            reason: `${feed.label}: ${range.summary}`,
            feedId: feed.id,
            externalUid: range.uid,
          },
        })
        imported += 1
      }

      await tx.icalFeed.update({
        where: { id: feedId },
        data: { lastSyncAt: new Date(), lastError: null, eventCount: imported },
      })

      return { imported, removed }
    }, TX_OPTS)

    await reportConflicts(feed, ranges)
    return { feedId, label: feed.label, ok: true, ...result }
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'TimeoutError'
        ? 'The booking site did not answer in time. It will be tried again at the next sync.'
        : error instanceof Error
          ? error.message
          : String(error)

    // Tell someone the first time a working feed breaks, not every hour after.
    if (!feed.lastError) {
      await raiseAlert('calendar.feed_failed', {
        title: `${feed.label} calendar for ${feed.unit.name} could not be read`,
        body: `${message} Until it is fixed, bookings made on ${feed.label} will not block this room here.`,
        link: `/admin/portfolio/${feed.unitId}`,
        propertyId: feed.unit.propertyId,
      })
    }

    // A feed that fails must not silently drop its blocks — the existing ones
    // stay in place and the error surfaces in the interface.
    await db.icalFeed.update({
      where: { id: feedId },
      data: { lastSyncAt: new Date(), lastError: message },
    })

    return { feedId, label: feed.label, ok: false, imported: 0, removed: 0, error: message }
  }
}

/**
 * A double booking: the booking site shows someone on nights we have sold.
 *
 * Airbnb and Booking.com also export the nights WE sold, copied in from our
 * feed, as "Not available". An imported block covering exactly the dates of
 * one of our bookings and labelled that way is our own booking coming back,
 * not a clash, and is ignored. Everything else that overlaps is raised, once.
 */
async function reportConflicts(
  feed: { id: string; label: string; unitId: string; unit: { name: string; propertyId: string } },
  ranges: Array<{ start: Date; end: Date; summary: string; uid: string }>
): Promise<void> {
  if (ranges.length === 0) return
  try {
    const today = dateOnly(new Date())
    const reservations = await db.reservation.findMany({
      where: { unitId: feed.unitId, status: { in: BLOCKING_STATUSES }, checkOut: { gt: today } },
      select: { id: true, code: true, checkIn: true, checkOut: true },
    })

    for (const range of ranges) {
      if (range.end <= today) continue
      for (const r of reservations) {
        const overlaps = range.start < dateOnly(r.checkOut) && range.end > dateOnly(r.checkIn)
        if (!overlaps) continue
        const echo =
          range.start.getTime() === dateOnly(r.checkIn).getTime() &&
          range.end.getTime() === dateOnly(r.checkOut).getTime() &&
          /not available|blocked|unavailable/i.test(range.summary)
        if (echo) continue

        const key = `${feed.id}:${range.uid}:${r.id}`
        const already = await db.alertLog.findFirst({
          where: { event: 'calendar.conflict', metadata: { path: ['key'], equals: key } },
          select: { id: true },
        })
        if (already) continue

        await raiseAlert('calendar.conflict', {
          title: `Possible double booking: ${feed.unit.name}`,
          body: `${feed.label} shows the room taken ${toISODate(range.start)} to ${toISODate(range.end)} ("${range.summary}"), overlapping ABN booking ${r.code}. Check ${feed.label} now and move one of the guests.`,
          link: `/admin/bookings/${r.id}`,
          propertyId: feed.unit.propertyId,
          metadata: { key, ref: r.code, source: feed.label },
        })
      }
    }
  } catch (error) {
    console.error('[ical] conflict check failed', error)
  }
}

/**
 * Re-read one room's booking-site calendars if they are older than
 * `maxAgeMs`, just before a guest books it on our site. Never throws and
 * never takes long: a slow booking site must not stop a direct booking.
 */
export async function refreshUnitFeeds(unitId: string, maxAgeMs = 10 * 60_000): Promise<void> {
  try {
    const stale = await db.icalFeed.findMany({
      where: {
        unitId,
        active: true,
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(Date.now() - maxAgeMs) } }],
      },
      select: { id: true },
    })
    await Promise.all(stale.map((f) => importFeed(f.id)))
  } catch (error) {
    console.error('[ical] refresh before booking failed', error)
  }
}

/** Sync every active feed. Called by the cron job and by the manual button. */
export async function syncAllFeeds(): Promise<SyncResult[]> {
  const feeds = await db.icalFeed.findMany({ where: { active: true } })
  const results: SyncResult[] = []

  // Sequential on purpose: a handful of feeds, and being polite to the
  // platforms matters more than shaving a few seconds.
  for (const feed of feeds) {
    results.push(await importFeed(feed.id))
  }

  return results
}

/** The public feed URL a listing should be pointed at. */
export function feedUrlForUnit(unitId: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/calendar/${unitId}.ics`
}
