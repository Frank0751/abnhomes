import { NextRequest, NextResponse } from 'next/server'
import { processOutbox } from '@/lib/notify'
import { expirePendingReservations, sendCheckInReminders } from '@/lib/short-stay/sweeper'

export const maxDuration = 60

/**
 * Drains the notification outbox (email / SMS / WhatsApp with retry and
 * backoff), expires stale unpaid booking requests and sends day-before
 * check-in reminders. Protected by the CRON_SECRET bearer header, same as
 * the other crons.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const outbox = await processOutbox()
  const expiredReservations = await expirePendingReservations()
  const checkInReminders = await sendCheckInReminders()
  return NextResponse.json({ ok: true, outbox, expiredReservations, checkInReminders })
}
