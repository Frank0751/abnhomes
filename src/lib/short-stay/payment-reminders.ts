/**
 * A nudge for booking requests that were started and not paid.
 *
 * An unpaid request holds the dates for 48 hours and is then released. Most
 * people who stop at the payment step meant to come back; one message, a few
 * hours later, with the link and the deadline, is what brings them. One
 * message only: the outbox refuses a second with the same template for the
 * same booking, so the hourly sweep can call this as often as it likes.
 */

import { db } from '@/lib/db'
import { emailHtml, queueMessage } from '@/lib/notify'
import { formatMinor } from '@/lib/core/money'
import { siteUrl } from '@/lib/site-url'

/** Old enough that they are not still at the payment screen. */
const AFTER_HOURS = 3

export async function sendPaymentReminders(): Promise<number> {
  const now = new Date()
  const pending = await db.reservation.findMany({
    where: {
      status: 'PENDING',
      source: 'WEBSITE',
      createdAt: { lte: new Date(now.getTime() - AFTER_HOURS * 3600_000) },
      // Still held, with at least a couple of hours left to act on it.
      expiresAt: { gt: new Date(now.getTime() + 2 * 3600_000) },
      checkIn: { gt: now },
    },
    select: {
      id: true,
      code: true,
      totalMinor: true,
      currency: true,
      checkIn: true,
      checkOut: true,
      expiresAt: true,
      unit: { select: { name: true } },
      guest: { select: { name: true, email: true, phone: true } },
    },
    take: 50,
  })

  let queued = 0
  for (const r of pending) {
    try {
      const first = r.guest.name.split(' ')[0] || 'there'
      const total = formatMinor(r.totalMinor, r.currency)
      const payUrl = `${siteUrl()}/pay/${r.code}`
      const day = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
      const until = r.expiresAt
        ? r.expiresAt.toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' GMT'
        : 'tomorrow'

      if (r.guest.email) {
        const id = await queueMessage({
          channel: 'EMAIL',
          to: r.guest.email,
          template: 'booking_payment_reminder',
          entityType: 'Reservation',
          entityId: r.id,
          dedupe: true,
          subject: `Your dates are still held · ${r.code}`,
          body: emailHtml({
            heading: `Still planning to stay, ${first}?`,
            lines: [
              `We are holding <b>${r.unit.name}</b> for you, ${day(r.checkIn)} to ${day(r.checkOut)}.`,
              `The hold ends on <b>${until}</b>. Paying ${total} confirms the booking straight away.`,
              'If your plans have changed you need do nothing: the dates are released automatically and nothing is charged.',
            ],
            cta: { label: `Pay ${total} and confirm`, url: payUrl },
          }),
        })
        if (id) queued += 1
      }
      if (r.guest.phone) {
        await queueMessage({
          channel: 'SMS',
          to: r.guest.phone,
          template: 'booking_payment_reminder',
          entityType: 'Reservation',
          entityId: r.id,
          dedupe: true,
          body: `Hello ${first}, we are still holding ${r.unit.name} for you until ${until}. Pay ${total} to confirm: ${payUrl}. ABN Homes, 054 170 4048.`,
        })
      }
    } catch (error) {
      console.error('[sweeper] payment reminder failed', r.code, error)
    }
  }
  return queued
}
