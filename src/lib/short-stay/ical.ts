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
  const feed = await db.icalFeed.findUniqueOrThrow({ where: { id: feedId } })

  try {
    const nodeIcal = await import('node-ical')
    const events = await nodeIcal.async.fromURL(feed.url)

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

    return { feedId, label: feed.label, ok: true, ...result }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // A feed that fails must not silently drop its blocks — the existing ones
    // stay in place and the error surfaces in the interface.
    await db.icalFeed.update({
      where: { id: feedId },
      data: { lastSyncAt: new Date(), lastError: message },
    })

    return { feedId, label: feed.label, ok: false, imported: 0, removed: 0, error: message }
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
