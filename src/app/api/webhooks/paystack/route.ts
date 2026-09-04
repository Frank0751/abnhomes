/**
 * Paystack webhook.
 *
 * Three rules, all learned the hard way by everyone who has built one:
 *
 *   1. VERIFY THE SIGNATURE against the raw body. An unsigned webhook endpoint
 *      is an open invitation to credit any account by any amount.
 *   2. NEVER TRUST THE PAYLOAD'S AMOUNT. We re-verify the transaction with
 *      Paystack directly before a single pesewa touches the ledger.
 *   3. ALWAYS RETURN 200 once the signature checks out. Paystack retries on
 *      anything else, and a bug in our handling should not become a storm of
 *      duplicate deliveries. Failures are logged, not signalled by status code.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { settleFromProvider, verifyWebhookSignature } from '@/lib/payments/gateway'
import { logAudit } from '@/lib/audit'

type PaystackEvent = {
  event: string
  data: {
    reference: string
    status: string
    metadata?: { propertyId?: string; partyId?: string; purpose?: string }
  }
}

export async function POST(request: Request) {
  // Must be the raw text — re-serialising the parsed JSON changes the bytes
  // and the signature will never match.
  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature')

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[paystack] rejected a webhook with an invalid signature')
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let event: PaystackEvent
  try {
    event = JSON.parse(rawBody) as PaystackEvent
  } catch {
    return NextResponse.json({ ok: true, ignored: 'unparseable' })
  }

  // Record every delivery, so a payment dispute has a trail.
  await db.idempotencyRecord
    .create({
      data: {
        key: `paystack:${event.event}:${event.data?.reference}`,
        endpoint: 'webhook/paystack',
        statusCode: 200,
        response: { event: event.event, reference: event.data?.reference } as never,
      },
    })
    .catch(() => {
      // Already seen this delivery. Paystack retries; that is expected.
    })

  if (event.event !== 'charge.success') {
    return NextResponse.json({ ok: true, ignored: event.event })
  }

  const { reference, metadata } = event.data

  if (!metadata?.propertyId || !metadata?.partyId) {
    console.error('[paystack] charge.success without routing metadata', reference)
    return NextResponse.json({ ok: true, ignored: 'missing metadata' })
  }

  try {
    const result = await settleFromProvider({
      reference,
      propertyId: metadata.propertyId,
      partyId: metadata.partyId,
      notes: metadata.purpose ?? null,
    })

    if (result.recorded) {
      await logAudit({
        action: 'payment.settled.webhook',
        entityType: 'Payment',
        entityId: result.paymentId ?? reference,
        actorLabel: 'Paystack webhook',
        after: { reference },
      })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    // Swallowed deliberately: a 500 makes Paystack retry, and if our ledger
    // write is broken, retrying will not fix it. The alert belongs in logs.
    console.error('[paystack] failed to settle', reference, error)
    return NextResponse.json({ ok: true, error: 'logged' })
  }
}
