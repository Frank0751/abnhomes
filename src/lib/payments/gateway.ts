/**
 * The payment seam.
 *
 * Every rail the business takes money on goes through here, so the ledger
 * never learns which provider was used. That is the point: PayPal is unproven
 * for a Ghanaian merchant, and if it turns out ABN can receive through it, or
 * through Flutterwave, or a bank API, adding it means writing one adapter —
 * not touching a single line of the money code.
 */

import type { Currency, PaymentChannel } from '@prisma/client'
import { db } from '@/lib/db'
import { recordPayment } from '@/lib/core/ledger'
import { shortCode } from '@/lib/core/ids'
import * as paystack from './paystack'

export type SupportedChannel = {
  channel: PaymentChannel
  label: string
  description: string
  currencies: Currency[]
  available: boolean
  note?: string
}

/**
 * What ABN can actually accept today. `available: false` entries are shown in
 * the interface as unavailable rather than hidden, so nobody wonders whether
 * the option was forgotten.
 */
export function supportedChannels(): SupportedChannel[] {
  return [
    {
      channel: 'MOMO_MTN',
      label: 'MTN MoMo',
      description: 'Approve the prompt on your handset',
      currencies: ['GHS'],
      available: true,
    },
    {
      channel: 'MOMO_TELECEL',
      label: 'Telecel Cash',
      description: 'Approve the prompt on your handset',
      currencies: ['GHS'],
      available: true,
    },
    {
      channel: 'MOMO_AIRTELTIGO',
      label: 'AirtelTigo Money',
      description: 'Approve the prompt on your handset',
      currencies: ['GHS'],
      available: true,
    },
    {
      channel: 'CARD',
      label: 'Visa or Mastercard',
      description: 'Pay by debit or credit card, including from abroad',
      currencies: ['GHS', 'USD'],
      available: true,
    },
    {
      channel: 'BANK_TRANSFER',
      label: 'Bank transfer',
      description: 'Transfer to the ABN Homes account and send us the reference',
      currencies: ['GHS', 'USD'],
      available: true,
    },
    {
      channel: 'CASH',
      label: 'Cash',
      description: 'Paid to an ABN Homes officer against a numbered receipt',
      currencies: ['GHS', 'USD'],
      available: true,
    },
    {
      channel: 'PAYPAL',
      label: 'PayPal',
      description: 'For guests paying from outside Ghana',
      currencies: ['USD'],
      available: false,
      note:
        'Not enabled. PayPal has historically been send-only for Ghanaian accounts — confirm with PayPal that ABN Homes can receive and withdraw before switching this on.',
    },
  ]
}

export function isChannelAvailable(channel: PaymentChannel): boolean {
  return supportedChannels().find((c) => c.channel === channel)?.available ?? false
}

export type StartPaymentArgs = {
  propertyId: string
  partyId: string
  amountMinor: number
  currency: Currency
  channel: PaymentChannel
  email?: string | null
  phone?: string | null
  callbackUrl?: string
  /** What this payment is for, carried through to the webhook. */
  metadata?: Record<string, unknown>
}

export type StartPaymentResult = {
  reference: string
  redirectUrl: string
  simulated: boolean
}

/**
 * Begin an online payment. Nothing is written to the ledger here — money is
 * only recorded once the provider confirms it, in `settleFromProvider`.
 */
export async function startPayment(args: StartPaymentArgs): Promise<StartPaymentResult> {
  if (!isChannelAvailable(args.channel)) {
    const channel = supportedChannels().find((c) => c.channel === args.channel)
    throw new Error(channel?.note ?? `${args.channel} is not enabled.`)
  }

  if (args.channel === 'CASH') {
    throw new Error('Cash is recorded directly by staff, not through the gateway.')
  }

  const reference = `ABN${Date.now().toString(36).toUpperCase()}${shortCode(4)}`

  const party = await db.party.findUniqueOrThrow({ where: { id: args.partyId } })
  const email = args.email ?? party.email ?? `${party.id}@guests.abnhomes.com.gh`

  const result = await paystack.initialisePayment({
    amountMinor: args.amountMinor,
    currency: args.currency,
    email,
    channel: args.channel,
    reference,
    phone: args.phone ?? party.phone,
    callbackUrl: args.callbackUrl,
    metadata: {
      ...args.metadata,
      propertyId: args.propertyId,
      partyId: args.partyId,
    },
  })

  return {
    reference: result.reference,
    redirectUrl: result.authorizationUrl,
    simulated: result.simulated,
  }
}

/**
 * Record a payment the provider has confirmed.
 *
 * Idempotent on the provider reference, because a webhook and a callback will
 * both arrive for the same transaction, sometimes at the same moment, and
 * sometimes more than once.
 */
export async function settleFromProvider(args: {
  reference: string
  propertyId: string
  partyId: string
  notes?: string | null
}): Promise<{ recorded: boolean; paymentId?: string; reason?: string }> {
  const verified = await paystack.verifyPayment(args.reference)

  if (verified.status !== 'success') {
    return { recorded: false, reason: `Payment is ${verified.status}.` }
  }

  const existing = await db.payment.findFirst({
    where: { OR: [{ providerRef: verified.providerRef }, { reference: args.reference }] },
  })
  if (existing) {
    return { recorded: false, paymentId: existing.id, reason: 'Already recorded.' }
  }

  const { payment } = await recordPayment({
    propertyId: args.propertyId,
    partyId: args.partyId,
    amountMinor: verified.amountMinor,
    currency: verified.currency,
    channel: paystack.channelFromPaystack(verified.channel, verified.payerPhone),
    receivedAt: verified.paidAt ?? new Date(),
    reference: args.reference,
    providerRef: verified.providerRef,
    payerName: verified.payerName,
    payerPhone: verified.payerPhone,
    status: 'CONFIRMED',
    notes: args.notes ?? null,
    idempotencyKey: `provider:${verified.providerRef}`,
  })

  return { recorded: true, paymentId: payment.id }
}

export const verifyWebhookSignature = paystack.verifyWebhookSignature
export const gatewayIsSimulated = paystack.isSimulated
