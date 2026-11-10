/**
 * Outbound messaging.
 *
 * SMS is the channel that actually reaches people here, so it is the default
 * for reminders, receipts and login codes. Every message is logged whether or
 * not it was sent, so "did the tenant get the arrears notice" has an answer.
 *
 * With no provider configured the system runs in simulation mode: messages are
 * recorded and printed to the console. Development and demos work without a
 * gateway account, and nothing silently pretends to have sent.
 */

import { db } from '@/lib/db'
import { normalisePhone } from '@/lib/core/phone'

type SendArgs = {
  to: string
  body: string
  template?: string
  entityType?: string
  entityId?: string
}

export async function sendSms(args: SendArgs): Promise<{ ok: boolean; simulated: boolean }> {
  const to = normalisePhone(args.to)
  if (!to) {
    await log({ ...args, status: 'FAILED', error: 'Unrecognised phone number' })
    return { ok: false, simulated: false }
  }

  const provider = (process.env.SMS_PROVIDER ?? 'log').toLowerCase()
  const apiKey = process.env.SMS_API_KEY

  if (!apiKey || provider === 'log') {
    console.info(`[sms:simulated] -> ${to}\n${args.body}`)
    await log({ ...args, to, status: 'SENT', simulated: true })
    return { ok: true, simulated: true }
  }

  try {
    const providerRef = await dispatch(provider, to, args.body)
    await log({ ...args, to, status: 'SENT', providerRef })
    return { ok: true, simulated: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await log({ ...args, to, status: 'FAILED', error: message })
    return { ok: false, simulated: false }
  }
}

async function dispatch(provider: string, to: string, body: string): Promise<string> {
  const senderId = process.env.SMS_SENDER_ID ?? 'ABNHomes'
  const apiKey = process.env.SMS_API_KEY as string

  if (provider === 'arkesel') {
    const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: senderId, message: body, recipients: [to.replace('+', '')] }),
    })
    if (!response.ok) throw new Error(`Arkesel responded ${response.status}`)
    const json = (await response.json()) as { data?: Array<{ id?: string }> }
    return json.data?.[0]?.id ?? 'sent'
  }

  if (provider === 'hubtel') {
    const url = new URL('https://smsc.hubtel.com/v1/messages/send')
    url.searchParams.set('clientid', process.env.SMS_CLIENT_ID ?? '')
    url.searchParams.set('clientsecret', apiKey)
    url.searchParams.set('from', senderId)
    url.searchParams.set('to', to)
    url.searchParams.set('content', body)

    const response = await fetch(url, { method: 'GET' })
    if (!response.ok) throw new Error(`Hubtel responded ${response.status}`)
    const json = (await response.json()) as { messageId?: string }
    return json.messageId ?? 'sent'
  }

  throw new Error(`Unknown SMS provider "${provider}". Supported: arkesel, hubtel, log.`)
}

async function log(args: {
  to?: string
  body: string
  template?: string
  entityType?: string
  entityId?: string
  status: 'SENT' | 'FAILED' | 'QUEUED'
  providerRef?: string
  error?: string
  simulated?: boolean
}) {
  try {
    await db.messageLog.create({
      data: {
        channel: 'SMS',
        toAddress: args.to ?? 'unknown',
        template: args.template ?? null,
        body: args.body,
        status: args.status,
        providerRef: args.providerRef ?? (args.simulated ? 'simulated' : null),
        error: args.error ?? null,
        entityType: args.entityType ?? null,
        entityId: args.entityId ?? null,
        sentAt: args.status === 'SENT' ? new Date() : null,
      },
    })
  } catch (error) {
    console.error('[messaging] could not write message log', error)
  }
}

// ---------------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------------

export const templates = {
  paymentReceived: (name: string, amount: string, receipt: string) =>
    `Hello ${name}, we have received your payment of ${amount}. Receipt ${receipt}. Thank you. ABN Homes.`,

  rentDue: (name: string, amount: string, dueDate: string) =>
    `Hello ${name}, your rent of ${amount} is due on ${dueDate}. Pay by MoMo or card through your ABN Homes portal.`,

  rentOverdue: (name: string, amount: string, days: number) =>
    `Hello ${name}, your balance of ${amount} is now ${days} days overdue. Please contact us on 054 170 4048 to arrange payment. ABN Homes.`,

  bookingConfirmed: (name: string, unit: string, checkIn: string, code: string, portalCode?: string) =>
    `Hello ${name}, your stay at ${unit} is confirmed for ${checkIn}. Booking reference ${code}.${portalCode ? ` Your portal code is ${portalCode} — sign in at abnhomes.vercel.app/portal with your email or phone and this code.` : ''} ABN Homes, 054 170 4048.`,

  checkInReminder: (name: string, unit: string, checkIn: string) =>
    `Hello ${name}, we look forward to welcoming you to ${unit} on ${checkIn}. Find us at 8 Asiko Street on Bolt or Google Maps. ABN Homes.`,

  ticketLogged: (code: string, title: string) =>
    `Your maintenance request ${code} (${title}) has been logged. We will update you shortly. ABN Homes.`,

  ticketResolved: (code: string) =>
    `Your maintenance request ${code} has been resolved. Please let us know if the problem returns. ABN Homes.`,

  ownerStatement: (name: string, period: string, amount: string) =>
    `Hello ${name}, your ABN Homes statement for ${period} is ready. Net due to you: ${amount}. View it in your owner portal.`,
}
