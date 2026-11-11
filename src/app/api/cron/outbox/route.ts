import { NextRequest, NextResponse } from 'next/server'
import { processOutbox } from '@/lib/notify'
import { expirePendingReservations, sendCheckInReminders, sendReviewRequests } from '@/lib/short-stay/sweeper'
import { revealExpiredWindows } from '@/lib/marketplace/reviews'

export const maxDuration = 60

/**
 * Drains the notification outbox (email / SMS / WhatsApp with retry and
 * backoff), expires stale unpaid booking requests, sends day-before check-in
 * reminders and post-stay review requests, and reveals double-blind reviews
 * whose window has closed. Protected by the CRON_SECRET bearer header.
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
  const reviewRequests = await sendReviewRequests()
  const reviewsRevealed = await revealExpiredWindows()
  return NextResponse.json({ ok: true, outbox, expiredReservations, checkInReminders, reviewRequests, reviewsRevealed })
}
