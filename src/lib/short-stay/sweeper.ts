/**
 * Time-based sweeps that keep the marketplace honest.
 *
 * - Unpaid booking requests expire: a PENDING reservation is a hold on real
 *   inventory, so it must not live forever. Requests from the website carry
 *   an explicit expiresAt; anything PENDING older than 72 hours with no
 *   confirmed money behind it goes too.
 * - Check-in reminders go out the day before arrival.
 *
 * Called from /api/cron/outbox alongside the notification outbox drain.
 */

import { db } from '@/lib/db'
import { cancelReservation } from './reservations'
import { notifyCheckInReminder } from '@/lib/notify'

export async function expirePendingReservations(): Promise<string[]> {
  const stale = await db.reservation.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { expiresAt: { lte: new Date() } },
        { createdAt: { lte: new Date(Date.now() - 72 * 3600_000) } },
      ],
    },
    select: { id: true, code: true },
    take: 50,
  })

  const expired: string[] = []
  for (const reservation of stale) {
    try {
      await cancelReservation(reservation.id, {
        reason: 'Unpaid booking request expired (hold released)',
      })
      expired.push(reservation.code)
    } catch (error) {
      console.error(`[sweeper] could not expire ${reservation.code}`, error)
    }
  }
  return expired
}

export async function sendCheckInReminders(): Promise<number> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayStart = new Date(tomorrow)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(tomorrow)
  dayEnd.setHours(23, 59, 59, 999)

  const arriving = await db.reservation.findMany({
    where: {
      status: 'CONFIRMED',
      checkIn: { gte: dayStart, lte: dayEnd },
      checkInNoticeSentAt: null,
    },
    select: { id: true },
    take: 50,
  })

  for (const { id } of arriving) {
    try {
      await notifyCheckInReminder(id)
    } catch (error) {
      console.error('[sweeper] check-in reminder failed', error)
    }
  }
  return arriving.length
}
