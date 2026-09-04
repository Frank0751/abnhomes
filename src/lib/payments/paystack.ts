/**
 * Paystack.
 *
 * One integration covers the rails that matter here: MTN MoMo, Telecel Cash
 * and AirtelTigo Money for tenants, Visa and Mastercard for guests paying from
 * abroad, in cedis and dollars.
 *
 * Paystack denominates in the currency's lowest unit — pesewas for GHS, cents
 * for USD — which is exactly how this system stores money, so no conversion is
 * needed at the boundary. That is not a coincidence; it is why the amounts are
 * stored that way.
 *
 * With no secret key configured the module runs in SIMULATION mode: it returns
 * plausible references and marks them clearly as simulated. Development and
 * demos work without a merchant account, and nothing pretends to have charged
 * a real card.
 */

import crypto from 'node:crypto'
import type { Currency, PaymentChannel } from '@prisma/client'

const BASE_URL = 'https://api.paystack.co'

function secretKey(): string | null {
  return process.env.PAYSTACK_SECRET_KEY || null
}

export function isSimulated(): boolean {
  return secretKey() === null
}

type PaystackResponse<T> = {
  status: boolean
  message: string
  data: T
}

async function call<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown }
): Promise<PaystackResponse<T>> {
  const key = secretKey()
  if (!key) throw new Error('Paystack is not configured')

  const response = await fetch(`${BASE_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })

  const json = (await response.json()) as PaystackResponse<T>

  if (!response.ok || !json.status) {
    throw new Error(`Paystack: ${json.message || `HTTP ${response.status}`}`)
  }

  return json
}

/** Paystack's channel names for the rails we accept. */
function paystackChannels(channel: PaymentChannel): string[] {
  switch (channel) {
    case 'MOMO_MTN':
    case 'MOMO_TELECEL':
    case 'MOMO_AIRTELTIGO':
      return ['mobile_money']
    case 'CARD':
      return ['card']
    case 'BANK_TRANSFER':
      return ['bank_transfer', 'bank']
    default:
      return ['card', 'mobile_money']
  }
}

export type InitialiseArgs = {
  amountMinor: number
  currency: Currency
  email: string
  channel: PaymentChannel
  /** Our own reference, so a webhook can be tied back to the right charge. */
  reference: string
  phone?: string | null
  callbackUrl?: string
  metadata?: Record<string, unknown>
}

export type InitialiseResult = {
  authorizationUrl: string
  accessCode: string
  reference: string
  simulated: boolean
}

/**
 * Start a payment and get the URL to send the payer to.
 * Used for cards and for the hosted mobile money flow.
 */
export async function initialisePayment(args: InitialiseArgs): Promise<InitialiseResult> {
  if (isSimulated()) {
    return {
      authorizationUrl: `/payments/simulate?reference=${encodeURIComponent(args.reference)}&amount=${args.amountMinor}&currency=${args.currency}`,
      accessCode: 'simulated',
      reference: args.reference,
      simulated: true,
    }
  }

  const result = await call<{
    authorization_url: string
    access_code: string
    reference: string
  }>('/transaction/initialize', {
    method: 'POST',
    body: {
      amount: args.amountMinor,
      currency: args.currency,
      email: args.email,
      reference: args.reference,
      channels: paystackChannels(args.channel),
      ...(args.callbackUrl ? { callback_url: args.callbackUrl } : {}),
      metadata: {
        ...args.metadata,
        ...(args.phone ? { phone: args.phone } : {}),
      },
    },
  })

  return {
    authorizationUrl: result.data.authorization_url,
    accessCode: result.data.access_code,
    reference: result.data.reference,
    simulated: false,
  }
}

export type VerifyResult = {
  status: 'success' | 'failed' | 'pending'
  amountMinor: number
  currency: Currency
  reference: string
  providerRef: string
  channel: string
  paidAt: Date | null
  payerName: string | null
  payerPhone: string | null
  simulated: boolean
}

/**
 * Confirm a transaction with Paystack directly.
 *
 * Always verify server-side. A callback landing on the success page proves the
 * payer reached that page and nothing else — never credit an account on the
 * strength of a redirect.
 */
export async function verifyPayment(reference: string): Promise<VerifyResult> {
  if (isSimulated()) {
    return {
      status: 'success',
      amountMinor: 0,
      currency: 'GHS',
      reference,
      providerRef: `sim_${reference}`,
      channel: 'simulated',
      paidAt: new Date(),
      payerName: null,
      payerPhone: null,
      simulated: true,
    }
  }

  const result = await call<{
    status: string
    amount: number
    currency: string
    reference: string
    id: number
    channel: string
    paid_at: string | null
    customer?: { first_name?: string; last_name?: string; phone?: string }
    authorization?: { mobile_money_number?: string }
  }>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' })

  const data = result.data
  const name = [data.customer?.first_name, data.customer?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()

  return {
    status:
      data.status === 'success' ? 'success' : data.status === 'failed' ? 'failed' : 'pending',
    amountMinor: data.amount,
    currency: (data.currency as Currency) ?? 'GHS',
    reference: data.reference,
    providerRef: String(data.id),
    channel: data.channel,
    paidAt: data.paid_at ? new Date(data.paid_at) : null,
    payerName: name || null,
    payerPhone: data.customer?.phone ?? data.authorization?.mobile_money_number ?? null,
    simulated: false,
  }
}

/**
 * Verify a webhook came from Paystack.
 *
 * Paystack signs the raw request body with HMAC SHA-512 using the secret key.
 * The comparison is constant-time — a timing-safe check costs nothing and a
 * naive `===` here is a real vulnerability.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const key = secretKey()
  if (!key || !signature) return false

  const expected = crypto.createHmac('sha512', key).update(rawBody).digest('hex')

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return false

  return crypto.timingSafeEqual(a, b)
}

/** Map Paystack's channel back onto ours, so the receipt says the right thing. */
export function channelFromPaystack(
  paystackChannel: string,
  payerPhone?: string | null
): PaymentChannel {
  if (paystackChannel === 'card') return 'CARD'
  if (paystackChannel === 'bank' || paystackChannel === 'bank_transfer') return 'BANK_TRANSFER'

  if (paystackChannel === 'mobile_money') {
    if (payerPhone) {
      // Reuse the network detection so the receipt names the right wallet.
      const network = detectNetwork(payerPhone)
      if (network) return network
    }
    return 'MOMO_MTN'
  }

  return 'OTHER'
}

function detectNetwork(phone: string): PaymentChannel | null {
  const digits = phone.replace(/\D/g, '')
  const national = digits.startsWith('233') ? digits.slice(3) : digits.replace(/^0/, '')
  const prefix = national.slice(0, 2)

  if (['24', '25', '53', '54', '55', '59'].includes(prefix)) return 'MOMO_MTN'
  if (['20', '50'].includes(prefix)) return 'MOMO_TELECEL'
  if (['26', '27', '56', '57'].includes(prefix)) return 'MOMO_AIRTELTIGO'
  return null
}
