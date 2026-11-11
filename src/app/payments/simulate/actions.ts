'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { recordPayment } from '@/lib/core/ledger'
import { afterPaymentRecorded } from '@/lib/payments/after-payment'
import { loadIntent } from '@/lib/payments/gateway'

/**
 * Settle the simulated checkout. This is the demo rail: it writes a real
 * payment, a real ledger entry and real allocations, and fires the same
 * receipts and auto-confirm logic the live gateway does — so the whole
 * booking journey can be exercised end to end without merchant keys.
 */
export async function completeSimulatedPaymentAction(formData: FormData): Promise<void> {
  const reference = String(formData.get('reference') ?? '')
  const intent = await loadIntent(reference)
  if (!intent) redirect(`/payments/callback?reference=${encodeURIComponent(reference)}&missing=1`)

  const { payment } = await recordPayment({
    propertyId: intent.propertyId,
    partyId: intent.partyId,
    amountMinor: intent.amountMinor,
    currency: intent.currency,
    channel: intent.channel,
    reference,
    providerRef: `sim_${reference}`,
    payerName: 'Simulated payment',
    status: 'CONFIRMED',
    notes: 'Simulated gateway checkout (no merchant keys configured)',
    idempotencyKey: `provider:sim_${reference}`,
  })

  await afterPaymentRecorded(payment.id)

  redirect(`/payments/callback?reference=${encodeURIComponent(reference)}&simulated=1`)
}
