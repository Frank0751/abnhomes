import { NextRequest, NextResponse } from 'next/server'
import { processOutbox } from '@/lib/notify'
import {
  expirePendingReservations,
  sendCheckInReminders,
  sendCheckoutReminders,
  sendReviewRequests,
  generatePreventiveTickets,
} from '@/lib/short-stay/sweeper'
import { revealExpiredWindows } from '@/lib/marketplace/reviews'
import { sendPaymentReminders } from '@/lib/short-stay/payment-reminders'

export const maxDuration = 60

/**
 * Drains the notification outbox (email / SMS / WhatsApp with retry and
 * backoff), expires stale unpaid booking requests, sends day-before check-in
 * reminders and post-stay review requests, raises preventive maintenance
 * work orders, and reveals double-blind reviews whose window has closed.
 * Protected by the CRON_SECRET bearer header.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const expiredReservations = await expirePendingReservations()
  const paymentReminders = await sendPaymentReminders()
  const checkInReminders = await sendCheckInReminders()
  const checkoutReminders = await sendCheckoutReminders()
  const reviewRequests = await sendReviewRequests()
  const reviewsRevealed = await revealExpiredWindows()
  const maintenanceRaised = await generatePreventiveTickets()
  // Last, so the reminders queued just above go out in this same run.
  const outbox = await processOutbox(60)
  return NextResponse.json({
    ok: true,
    outbox,
    expiredReservations,
    paymentReminders,
    checkInReminders,
    checkoutReminders,
    reviewRequests,
    reviewsRevealed,
    maintenanceRaised,
  })
}
