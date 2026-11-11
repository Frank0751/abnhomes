/**
 * Production E2E: the full guest journey, driving the same library functions
 * the UI server actions call (requestBookingAction / completeSimulatedPayment-
 * Action), against the live database:
 *
 *   1. create a PENDING hold (createReservation, 48h expiry, source WEBSITE)
 *   2. start a simulated MoMo payment (gateway.startPayment -> intent)
 *   3. settle it exactly like the simulated checkout does
 *      (loadIntent -> recordPayment -> afterPaymentRecorded)
 *   4. assert: booking CONFIRMED, payment + ledger + notifications + messages
 *   5. refund (ledger reversal + payment REVERSED) and assert again
 *
 * Leaves one clearly-named test booking behind as evidence.
 *
 *    DATABASE_URL=... npx tsx scripts/e2e_journey.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

function assert(label: string, condition: boolean, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!condition) process.exitCode = 1
}

async function main() {
  const startedAt = new Date()

  // --- 0. pick a published, bookable unit ---------------------------------
  const unit = await db.unit.findFirst({
    where: {
      published: true,
      property: { published: true, active: true },
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      status: { notIn: ['OFF_MARKET', 'MAINTENANCE'] },
    },
    select: { id: true, name: true, propertyId: true },
    orderBy: { createdAt: 'asc' },
  })
  assert('published short-stay unit exists', Boolean(unit), unit?.name ?? 'none found')
  if (!unit) return

  // --- 1. hold -------------------------------------------------------------
  // Random window ~2-6 weeks out, so reruns don't collide with the evidence
  // booking a previous run left behind (the availability guard would —
  // correctly — refuse).
  const startOffset = 14 + Math.floor(Math.random() * 28)
  const checkIn = new Date(Date.now() + startOffset * 86400_000)
  const checkOut = new Date(Date.now() + (startOffset + 2) * 86400_000)

  // Mirror of createReservation's public call path (book/actions.ts), kept
  // inline here because server actions cannot be imported outside Next.
  const { createReservation } = await import('@/lib/short-stay/reservations')
  const { reservation, quote } = await createReservation({
    unitId: unit.id,
    guest: {
      name: 'E2E Production Check',
      phone: '+233550000001',
      email: 'e2e-check@abnhomes.com.gh',
    },
    checkIn,
    checkOut,
    adults: 2,
    source: 'WEBSITE',
    guestNotes: 'Automated end-to-end verification booking. Safe to ignore.',
    expiresAt: new Date(Date.now() + 48 * 3600_000),
    status: 'PENDING',
  })
  assert('hold created', reservation.status === 'PENDING', `code ${reservation.code}`)
  const totalMinor = quote?.totalMinor ?? 0
  const currency = quote?.currency ?? 'GHS'
  assert('quote produced', totalMinor > 0, `${totalMinor} minor ${currency}`)

  // --- 2. start simulated payment ------------------------------------------
  const { startPayment, loadIntent } = await import('@/lib/payments/gateway')
  const started = await startPayment({
    propertyId: unit.propertyId,
    partyId: reservation.guestPartyId,
    amountMinor: totalMinor,
    currency,
    channel: 'MOMO_MTN',
    email: 'e2e-check@abnhomes.com.gh',
    phone: '+233550000001',
    metadata: { reservationId: reservation.id, purpose: 'E2E journey' },
  })
  assert('payment started (simulation)', started.simulated === true, started.reference)
  const intent = await loadIntent(started.reference)
  assert('payment intent stored', intent?.amountMinor === totalMinor)

  // --- 3. settle like the simulated checkout -------------------------------
  const { recordPayment } = await import('@/lib/core/ledger')
  const { afterPaymentRecorded } = await import('@/lib/payments/after-payment')
  const { payment } = await recordPayment({
    propertyId: intent!.propertyId,
    partyId: intent!.partyId,
    amountMinor: intent!.amountMinor,
    currency: intent!.currency,
    channel: intent!.channel,
    reference: started.reference,
    providerRef: `sim_${started.reference}`,
    payerName: 'Simulated payment',
    status: 'CONFIRMED',
    notes: 'E2E simulated gateway checkout',
    idempotencyKey: `provider:sim_${started.reference}`,
  })
  await afterPaymentRecorded(payment.id)

  // --- 4. assert the world moved -------------------------------------------
  const after = await db.reservation.findUnique({ where: { id: reservation.id } })
  assert('booking auto-confirmed', after?.status === 'CONFIRMED', after?.status)

  const ledger = await db.ledgerEntry.findMany({ where: { paymentId: payment.id } })
  // One CREDIT entry belongs to the payment; the DEBIT charges it settles sit
  // on the reservation and are linked through allocations.
  assert('ledger entry recorded', ledger.length === 1, `${ledger.length} entries`)

  const allocations = await db.allocation.findMany({ where: { paymentId: payment.id } })
  assert('payment allocated to charges', allocations.length >= 1, `${allocations.length} allocation(s)`)

  const messages = await db.messageLog.findMany({
    where: { entityType: 'Reservation', entityId: reservation.id },
  })
  assert(
    'outbox messages for the guest',
    messages.length >= 1,
    messages.map((m) => `${m.channel}:${m.status}`).join(', ')
  )

  const notifications = await db.notification.findMany({
    where: { category: 'booking', createdAt: { gte: startedAt } },
  })
  assert('staff bell notifications', notifications.length >= 1, `${notifications.length}`)

  // Audit events are written by the HTTP server actions (requestBookingAction
  // logs 'booking.requested.public'), which this script bypasses by driving
  // the library functions directly — so there is nothing to assert here.

  // --- 5. refund path -------------------------------------------------------
  const { refundPayment } = await import('@/lib/payments/gateway')
  const refund = await refundPayment({
    paymentId: payment.id,
    reason: 'E2E verification refund',
  })
  assert('refund accepted', refund.ok, refund.error ?? '')

  const reversed = await db.payment.findUnique({ where: { id: payment.id } })
  assert('payment reversed', reversed?.status === 'REVERSED', reversed?.status)

  const reversalEntries = await db.ledgerEntry.count({
    where: { paymentId: payment.id, reversesId: { not: null } },
  })
  assert('ledger reversal recorded', reversalEntries >= 1, `${reversalEntries}`)

  console.log(`\nE2E booking reference: ${reservation.code} (left in admin as evidence)`)
  await db.$disconnect()
}

main().catch(async (error) => {
  console.error('E2E FAILED:', error)
  process.exitCode = 1
  await db.$disconnect()
})
