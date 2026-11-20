/**
 * The morning digest.
 *
 * Everything that was not urgent enough to interrupt, gathered into one
 * message. The point is that nothing is lost without everything buzzing: a
 * maintenance ticket, a new tenancy and a review are each worth knowing and
 * none is worth a phone call at midnight.
 *
 * Sent to anyone set to EVERYTHING. People on IMPORTANT already had the
 * urgent ones as they happened and asked for no more than that.
 */

import { db } from '@/lib/db'
import { queueMessage, emailHtml } from '@/lib/notify'
import { DIGEST_ORDER, ALERTS, type AlertEvent } from './registry'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abnhomes.vercel.app'

export type DigestResult = {
  events: number
  recipients: number
  sent: number
  skipped: string | null
}

export async function sendDailyDigest(now = new Date()): Promise<DigestResult> {
  const pending = await db.alertLog.findMany({
    where: { urgency: 'DIGEST', digestedAt: null },
    orderBy: { occurredAt: 'asc' },
    // A cap, so a backlog after an outage produces one long message rather
    // than a query that times out. The rest go in tomorrow's.
    take: 200,
  })

  if (pending.length === 0) {
    return { events: 0, recipients: 0, sent: 0, skipped: 'nothing to report' }
  }

  const recipients = await db.user.findMany({
    where: {
      active: true,
      suspendedAt: null,
      alertLevel: 'EVERYTHING',
    },
    select: { id: true, name: true, email: true, phone: true, alertEmail: true, alertSms: true },
  })

  if (recipients.length === 0) {
    // Deliberately NOT marked as digested. Nobody is set to receive the
    // digest yet, and silently consuming the events would mean the first
    // person switched on starts from an empty history.
    return {
      events: pending.length,
      recipients: 0,
      sent: 0,
      skipped: 'nobody is set to receive the digest',
    }
  }

  // Group by the heading each event belongs under, in the registry's order.
  const groups = new Map<string, typeof pending>()
  for (const row of pending) {
    const def = ALERTS[row.event as AlertEvent]
    const heading = def?.digestGroup ?? 'Other'
    const bucket = groups.get(heading)
    if (bucket) bucket.push(row)
    else groups.set(heading, [row])
  }

  const ordered = [...DIGEST_ORDER, 'Other'].filter((h) => groups.has(h))
  const dateLabel = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })

  const lines: string[] = []
  for (const heading of ordered) {
    const rows = groups.get(heading)!
    lines.push(`<b>${heading}</b> — ${rows.length}`)
    for (const row of rows) {
      const when = row.occurredAt.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      })
      lines.push(`${when} · ${escapeHtml(row.title)}${row.body ? ` — ${escapeHtml(row.body)}` : ''}`)
    }
  }

  const subject = `ABN Homes — ${pending.length} update${pending.length === 1 ? '' : 's'}, ${dateLabel}`
  const html = emailHtml({
    heading: `Yesterday at ABN Homes`,
    lines,
    cta: { label: 'Open the console', url: `${APP_URL}/admin` },
    footer: 'Urgent items — bookings, payments, cancellations — were sent as they happened.',
  })

  let sent = 0
  // One dedupe key per recipient per calendar day, so a retried sweep cannot
  // send the same morning's digest twice.
  const day = now.toISOString().slice(0, 10)

  for (const person of recipients) {
    if (person.alertEmail && person.email) {
      const id = await queueMessage({
        channel: 'EMAIL',
        to: person.email,
        template: 'alert.digest',
        entityType: 'AlertDigest',
        entityId: `${day}:${person.id}`,
        dedupe: true,
        subject,
        body: html,
      })
      if (id) sent += 1
    }

    // SMS gets the count and the headline groups only — the detail is in the
    // email and the console, and every character here costs credits.
    if (person.alertSms && person.phone) {
      const summary = ordered.map((h) => `${h} ${groups.get(h)!.length}`).join(', ')
      const id = await queueMessage({
        channel: 'SMS',
        to: person.phone,
        template: 'alert.digest',
        entityType: 'AlertDigestSms',
        entityId: `${day}:${person.id}`,
        dedupe: true,
        body: `ABN Homes yesterday: ${summary}. Detail in the console — ABN Homes.`,
      })
      if (id) sent += 1
    }
  }

  // Mark digested only once something was queued. If every recipient has
  // both channels switched off there is nothing to mark, and the events
  // should wait rather than disappear.
  if (sent > 0) {
    await db.alertLog.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { digestedAt: now },
    })
  }

  return {
    events: pending.length,
    recipients: recipients.length,
    sent,
    skipped: sent === 0 ? 'recipients have no channel switched on' : null,
  }
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
