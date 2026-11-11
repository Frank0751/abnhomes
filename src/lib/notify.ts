/**
 * Notification centre.
 *
 * One seam for every outbound message the platform sends: email, SMS and
 * WhatsApp, plus in-app notifications for staff and guests.
 *
 * Design rules, learned from running the money ledger the same way:
 * - Callers describe WHAT happened; this module decides WHO hears about it
 *   and on WHICH channels. Business code never formats phone numbers or
 *   picks providers.
 * - Everything goes through a database outbox. The request that triggers a
 *   message never waits on a provider, and a provider outage retries with
 *   backoff instead of losing the message.
 * - With no provider keys configured, each channel runs in simulation:
 *   messages are recorded, rendered to the console, and marked sent with
 *   providerRef "simulated". Demos and development work end to end.
 */

import type { MessageChannel, Party, Reservation } from '@prisma/client'
import { db } from '@/lib/db'
import { formatMinor } from '@/lib/core/money'
import { normalisePhone } from '@/lib/core/phone'
import { dispatchSms } from '@/lib/messaging'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type ChannelConfig = {
  email: { configured: boolean; from: string }
  whatsapp: { configured: boolean }
  sms: { configured: boolean }
}

export function channelConfig(): ChannelConfig {
  return {
    email: {
      configured: Boolean(process.env.RESEND_API_KEY),
      from: process.env.EMAIL_FROM ?? 'ABN Homes <bookings@abnhomes.com.gh>',
    },
    whatsapp: {
      configured: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    },
    sms: {
      configured: Boolean(process.env.SMS_API_KEY) && (process.env.SMS_PROVIDER ?? 'log') !== 'log',
    },
  }
}

const MAX_ATTEMPTS = 5
const BACKOFF_MINUTES = [5, 15, 60, 180, 360]

// ---------------------------------------------------------------------------
// Outbox primitives
// ---------------------------------------------------------------------------

export type QueueMessageArgs = {
  channel: MessageChannel
  to: string
  subject?: string
  body: string
  template?: string
  entityType?: string
  entityId?: string
  scheduledFor?: Date
  metadata?: Record<string, unknown>
  /** Skip queueing when an identical message is already queued or sent. */
  dedupe?: boolean
}

export async function queueMessage(args: QueueMessageArgs): Promise<string | null> {
  if (args.dedupe) {
    const existing = await db.messageLog.findFirst({
      where: {
        channel: args.channel,
        template: args.template ?? null,
        entityType: args.entityType ?? null,
        entityId: args.entityId ?? null,
        status: { in: ['QUEUED', 'SENT', 'DELIVERED'] },
      },
      select: { id: true },
    })
    if (existing) return null
  }

  const row = await db.messageLog.create({
    data: {
      channel: args.channel,
      toAddress: args.to,
      subject: args.subject ?? null,
      template: args.template ?? null,
      body: args.body,
      status: 'QUEUED',
      entityType: args.entityType ?? null,
      entityId: args.entityId ?? null,
      scheduledFor: args.scheduledFor ?? new Date(),
      metadata: (args.metadata ?? undefined) as never,
    },
    select: { id: true },
  })
  return row.id
}

/**
 * Attempt delivery of one queued message. Never throws.
 *
 * Opens with an atomic claim: two schedulers can drain the same outbox (the
 * 15-minute GitHub Actions sweep and the daily Vercel cron may overlap), and
 * a conditional update is won by exactly one of them, so a message is never
 * handed to the provider twice. The winning caller has already counted the
 * attempt with the claim itself, which keeps the retry bookkeeping honest
 * even if the process dies mid-send.
 */
export async function deliverMessage(id: string): Promise<'SENT' | 'FAILED' | 'RETRY' | 'SKIPPED'> {
  const now = new Date()
  const claimed = await db.messageLog.updateMany({
    where: {
      id,
      status: 'QUEUED',
      scheduledFor: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: { attempts: { increment: 1 } },
  })
  if (claimed.count === 0) return 'SKIPPED'

  const msg = await db.messageLog.findUnique({ where: { id } })
  if (!msg) return 'SKIPPED'

  try {
    let providerRef: string
    if (msg.channel === 'EMAIL') {
      providerRef = await sendEmail(msg.toAddress, msg.subject ?? 'ABN Homes', msg.body)
    } else if (msg.channel === 'WHATSAPP') {
      providerRef = await sendWhatsapp(msg.toAddress, msg.body)
    } else {
      providerRef = await dispatchSms(msg.toAddress, msg.body)
    }
    await db.messageLog.update({
      where: { id },
      data: { status: 'SENT', providerRef, sentAt: new Date(), error: null },
    })
    return 'SENT'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const attempts = msg.attempts // already includes the failed attempt, counted by the claim
    const dead = attempts >= MAX_ATTEMPTS
    const backoff = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)]
    await db.messageLog.update({
      where: { id },
      data: {
        status: dead ? 'FAILED' : 'QUEUED',
        attempts,
        error: message.slice(0, 500),
        nextAttemptAt: dead ? null : new Date(Date.now() + backoff * 60_000),
      },
    })
    return dead ? 'FAILED' : 'RETRY'
  }
}

/** Drain the outbox: deliver every due message. Called by the cron route. */
export async function processOutbox(limit = 30): Promise<{ sent: number; retried: number; failed: number }> {
  const now = new Date()
  const due = await db.messageLog.findMany({
    where: {
      status: 'QUEUED',
      scheduledFor: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  })
  let sent = 0
  let retried = 0
  let failed = 0
  for (const { id } of due) {
    const outcome = await deliverMessage(id)
    if (outcome === 'SENT') sent++
    else if (outcome === 'RETRY') retried++
    else if (outcome === 'FAILED') failed++
    // SKIPPED: another drainer won the claim. Not a failure.
  }
  return { sent, retried, failed }
}

// ---------------------------------------------------------------------------
// Channel adapters
// ---------------------------------------------------------------------------

export async function sendEmail(to: string, subject: string, html: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.info(`[email:simulated] -> ${to} :: ${subject}\n${html.slice(0, 400)}`)
    return 'simulated'
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: channelConfig().email.from, to: [to], subject, html }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Resend responded ${response.status}: ${text.slice(0, 200)}`)
  }
  const json = (await response.json()) as { id?: string }
  return json.id ?? 'sent'
}

export async function sendWhatsapp(to: string, body: string): Promise<string> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneId) {
    console.info(`[whatsapp:simulated] -> ${to}\n${body}`)
    return 'simulated'
  }
  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'text', text: { body } }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`WhatsApp responded ${response.status}: ${text.slice(0, 200)}`)
  }
  const json = (await response.json()) as { messages?: Array<{ id?: string }> }
  return json.messages?.[0]?.id ?? 'sent'
}

// ---------------------------------------------------------------------------
// In-app notifications
// ---------------------------------------------------------------------------

export type InAppArgs = {
  category: 'booking' | 'payment' | 'task' | 'message' | 'review' | 'system'
  title: string
  body?: string
  link?: string
  userId?: string
  partyId?: string
}

export async function notifyInApp(args: InAppArgs): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: args.userId ?? null,
        partyId: args.partyId ?? null,
        category: args.category,
        title: args.title,
        body: args.body ?? null,
        link: args.link ?? null,
      },
    })
  } catch (error) {
    console.error('[notify] in-app notification failed', error)
  }
}

/** Fan out an in-app notification to every active staff member with a role. */
export async function notifyStaff(
  roles: string[],
  args: Omit<InAppArgs, 'userId' | 'partyId'>,
): Promise<void> {
  try {
    const users = await db.user.findMany({
      where: { active: true, suspendedAt: null, role: { in: roles as never } },
      select: { id: true },
    })
    if (users.length === 0) return
    await db.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        category: args.category,
        title: args.title,
        body: args.body ?? null,
        link: args.link ?? null,
      })),
    })
  } catch (error) {
    console.error('[notify] staff fanout failed', error)
  }
}

// ---------------------------------------------------------------------------
// Guest contact resolution
// ---------------------------------------------------------------------------

type GuestContact = { name: string; email?: string | null; phone?: string | null }

async function guestContact(partyId: string): Promise<GuestContact> {
  const party = await db.party.findUnique({ where: { id: partyId } })
  return { name: party?.name ?? 'there', email: party?.email, phone: party?.phone }
}

function splitName(full: string): string {
  return full.split(' ')[0] ?? full
}

// ---------------------------------------------------------------------------
// Branded email HTML
// ---------------------------------------------------------------------------

export function emailHtml(opts: { heading: string; lines: string[]; cta?: { label: string; url: string }; footer?: string }): string {
  const rows = opts.lines
    .map((line) => `<tr><td style="padding:6px 0;color:#3a4354;font-size:15px;line-height:1.6;">${line}</td></tr>`)
    .join('')
  const cta = opts.cta
    ? `<tr><td style="padding:22px 0 4px;"><a href="${opts.cta.url}" style="background:#0d9488;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;display:inline-block;">${opts.cta.label}</a></td></tr>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;padding:32px 12px;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fffdf8;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(10,14,26,0.08);">
    <tr><td style="background:#0a0e1a;padding:26px 32px;">
      <span style="color:#f7f5f0;font-size:20px;letter-spacing:0.04em;">ABN<span style="color:#14b8a6;">&#8202;Homes</span></span>
      <div style="color:#8a93a5;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin-top:4px;">Serviced Apartments · Accra</div>
    </td></tr>
    <tr><td style="padding:30px 32px 8px;">
      <h1 style="margin:0 0 14px;color:#0a0e1a;font-size:22px;font-weight:600;">${opts.heading}</h1>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}${cta}</table>
    </td></tr>
    <tr><td style="padding:18px 32px 28px;border-top:1px solid #eee6d9;margin-top:18px;">
      <p style="margin:0;color:#8a93a5;font-size:12px;line-height:1.7;">${opts.footer ?? 'Questions? Call or WhatsApp +233 54 170 4048 · abnhomes.com.gh'}</p>
    </td></tr>
  </table></body></html>`
}

// ---------------------------------------------------------------------------
// Domain events
// ---------------------------------------------------------------------------

const APP_URL = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://abnhomes.vercel.app'
export { APP_URL }

type ReservationLike = Pick<
  Reservation,
  'id' | 'code' | 'guestPartyId' | 'checkIn' | 'checkOut' | 'nights' | 'totalMinor' | 'depositMinor' | 'currency' | 'portalCode' | 'doorCode' | 'accessNotes' | 'checkInNoticeSentAt' | 'reviewRequestedAt'
> & { unit?: { name: string; property?: { name: string; addressLine: string } | null } | null }

async function loadReservation(reservationId: string): Promise<{ reservation: ReservationLike; guest: GuestContact } | null> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    include: { unit: { include: { property: { select: { name: true, addressLine: true } } } } },
  })
  if (!reservation) return null
  const guest = await guestContact(reservation.guestPartyId)
  return { reservation, guest }
}

function dateLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Booking received (public website request). Tells the guest what happens
 * next and gives them the link to pay. Replaces the old behaviour where the
 * success page claimed a message had been sent and none was.
 */
export async function notifyBookingRequested(reservationId: string): Promise<void> {
  const loaded = await loadReservation(reservationId)
  if (!loaded) return
  const { reservation, guest } = loaded
  const where = reservation.unit ? `${reservation.unit.name} · ${reservation.unit.property?.name ?? ''}` : 'your apartment'
  const total = formatMinor(reservation.totalMinor, reservation.currency)
  const payUrl = `${APP_URL}/pay/${reservation.code}`

  if (guest.email) {
    await queueMessage({
      channel: 'EMAIL',
      to: guest.email,
      template: 'booking_requested',
      entityType: 'Reservation',
      entityId: reservation.id,
      dedupe: true,
      subject: `We received your booking request · ${reservation.code}`,
      body: emailHtml({
        heading: `Thank you, ${splitName(guest.name)} — your request is in`,
        lines: [
          `<b>${where}</b> · ${dateLabel(reservation.checkIn)} → ${dateLabel(reservation.checkOut)} · ${reservation.nights} night${reservation.nights === 1 ? '' : 's'}`,
          `Total for the stay: <b>${total}</b>`,
          'Our team reviews every request quickly — usually within a few hours. The moment your booking is confirmed we will let you know here and by SMS.',
          `Your booking reference is <b>${reservation.code}</b>. You can also pay now to confirm instantly:`,
        ],
        cta: { label: `Pay ${total} now`, url: payUrl },
      }),
    })
  }
  if (guest.phone) {
    await queueMessage({
      channel: 'SMS',
      to: guest.phone,
      template: 'booking_requested',
      entityType: 'Reservation',
      entityId: reservation.id,
      dedupe: true,
      body: `Hello ${splitName(guest.name)}, we received your booking request ${reservation.code} for ${where} (${dateLabel(reservation.checkIn)}). Total ${total}. We will confirm shortly — pay anytime: ${payUrl}. ABN Homes.`,
    })
  }
  await notifyInApp({
    category: 'booking',
    title: `New booking request ${reservation.code}`,
    body: `${guest.name} · ${where} · ${total}`,
    link: `/admin/bookings/${reservation.id}`,
  })
  await notifyStaff(['SUPER_ADMIN', 'PROPERTY_MANAGER', 'FRONT_DESK'], {
    category: 'booking',
    title: `New booking request ${reservation.code}`,
    body: `${guest.name} requested ${where}, ${dateLabel(reservation.checkIn)} (${total}).`,
    link: `/admin/bookings/${reservation.id}`,
  })
}

/**
 * Booking confirmed by staff (or instantly on payment). Email + SMS + WhatsApp,
 * including the portal code and, when issued, the door code.
 */
export async function notifyBookingConfirmed(reservationId: string): Promise<void> {
  const loaded = await loadReservation(reservationId)
  if (!loaded) return
  const { reservation, guest } = loaded
  const where = reservation.unit ? `${reservation.unit.name} · ${reservation.unit.property?.name ?? ''}` : 'your apartment'
  const address = reservation.unit?.property?.addressLine ?? 'Address in your portal'
  const total = formatMinor(reservation.totalMinor, reservation.currency)
  const portalUrl = `${APP_URL}/portal`

  const portalLine = reservation.portalCode
    ? `Manage your stay, pay balances and download receipts in your portal — sign in with ${guest.email ?? guest.phone ?? 'your contact details'} and code <b>${reservation.portalCode}</b>.`
    : ''
  const doorLine = reservation.doorCode
    ? `Your door code, active from check-in day: <b>${reservation.doorCode}</b>. ${reservation.accessNotes ?? ''}`
    : 'Check-in details and door codes are released in your portal 24 hours before arrival.'

  if (guest.email) {
    await queueMessage({
      channel: 'EMAIL',
      to: guest.email,
      template: 'booking_confirmed',
      entityType: 'Reservation',
      entityId: reservation.id,
      dedupe: true,
      subject: `Your stay is confirmed · ${reservation.code}`,
      body: emailHtml({
        heading: `You're confirmed, ${splitName(guest.name)}!`,
        lines: [
          `<b>${where}</b><br/>${dateLabel(reservation.checkIn)} → ${dateLabel(reservation.checkOut)} · ${reservation.nights} night${reservation.nights === 1 ? '' : 's'} · ${total}`,
          `Address: ${address}`,
          doorLine,
          portalLine,
        ],
        cta: { label: 'Open my portal', url: portalUrl },
      }),
    })
  }
  if (guest.phone) {
    const sms = `Hello ${splitName(guest.name)}, your stay at ${where} is CONFIRMED for ${dateLabel(reservation.checkIn)}. Ref ${reservation.code}.${reservation.doorCode ? ` Door code ${reservation.doorCode}.` : ''}${reservation.portalCode ? ` Portal code ${reservation.portalCode}.` : ''} ABN Homes, 054 170 4048.`
    await queueMessage({ channel: 'SMS', to: guest.phone, template: 'booking_confirmed', entityType: 'Reservation', entityId: reservation.id, dedupe: true, body: sms })
    await queueMessage({
      channel: 'WHATSAPP',
      to: guest.phone,
      template: 'booking_confirmed',
      entityType: 'Reservation',
      entityId: reservation.id,
      dedupe: true,
      body: `*Your ABN Homes stay is confirmed* ✅\n\n${where}\n${dateLabel(reservation.checkIn)} → ${dateLabel(reservation.checkOut)}\nRef *${reservation.code}* · ${total}\n\n${reservation.doorCode ? `🔐 Door code: *${reservation.doorCode}*\n` : ''}${reservation.portalCode ? `Portal code: *${reservation.portalCode}*\n` : ''}Questions? Just reply here or call 054 170 4048.`,
    })
  }
  await notifyStaff(['SUPER_ADMIN', 'PROPERTY_MANAGER', 'FRONT_DESK'], {
    category: 'booking',
    title: `Booking confirmed ${reservation.code}`,
    body: `Guest notified on all channels.`,
    link: `/admin/bookings/${reservation.id}`,
  })
}

export async function notifyBookingCancelled(reservationId: string, reason?: string): Promise<void> {
  const loaded = await loadReservation(reservationId)
  if (!loaded) return
  const { reservation, guest } = loaded
  const where = reservation.unit?.name ?? 'your apartment'
  if (guest.email) {
    await queueMessage({
      channel: 'EMAIL',
      to: guest.email,
      template: 'booking_cancelled',
      entityType: 'Reservation',
      entityId: reservation.id,
      dedupe: true,
      subject: `Booking ${reservation.code} cancelled`,
      body: emailHtml({
        heading: `Your booking has been cancelled`,
        lines: [
          `<b>${where}</b> · ${dateLabel(reservation.checkIn)} → ${dateLabel(reservation.checkOut)}`,
          reason ? `Reason: ${reason}` : '',
          'Any amounts you have paid will be refunded per our cancellation policy. We are sorry to miss you — we would love to host you another time.',
        ],
        cta: { label: 'Browse available stays', url: `${APP_URL}/book` },
      }),
    })
  }
  if (guest.phone) {
    await queueMessage({
      channel: 'SMS',
      to: guest.phone,
      template: 'booking_cancelled',
      entityType: 'Reservation',
      entityId: reservation.id,
      dedupe: true,
      body: `Hello ${splitName(guest.name)}, your booking ${reservation.code} (${where}) has been cancelled. Refunds are processed per our policy. Questions: 054 170 4048. ABN Homes.`,
    })
  }
}

/** Receipt after money lands, whatever rail it came in on. */
export async function notifyPaymentReceived(args: {
  partyId: string
  paymentId: string
  amountMinor: number
  currency: string
  receiptNumber: string | null
  channel: string
  propertyName?: string
}): Promise<void> {
  const guest = await guestContact(args.partyId)
  const amount = formatMinor(args.amountMinor, args.currency as never)
  const receipt = args.receiptNumber ?? '—'
  const balanceUrl = `${APP_URL}/portal/tenant`

  if (guest.email) {
    await queueMessage({
      channel: 'EMAIL',
      to: guest.email,
      template: 'payment_receipt',
      entityType: 'Payment',
      entityId: args.paymentId,
      dedupe: true,
      subject: `Receipt ${receipt} · payment of ${amount} received`,
      body: emailHtml({
        heading: `Payment received — thank you`,
        lines: [
          `We have received <b>${amount}</b> from you${args.propertyName ? ` for ${args.propertyName}` : ''}.`,
          `Receipt number: <b>${receipt}</b> · Paid via ${args.channel.replace(/_/g, ' ').toLowerCase()}`,
          'You can download all your receipts from the portal at any time.',
        ],
        cta: { label: 'View my statement', url: balanceUrl },
      }),
    })
  }
  if (guest.phone) {
    await queueMessage({
      channel: 'SMS',
      to: guest.phone,
      template: 'payment_receipt',
      entityType: 'Payment',
      entityId: args.paymentId,
      dedupe: true,
      body: `Hello ${splitName(guest.name)}, we have received your payment of ${amount}. Receipt ${receipt}. Thank you. ABN Homes.`,
    })
  }
}

/** Day-before check-in message with door code and address. */
export async function notifyCheckInReminder(reservationId: string): Promise<void> {
  const loaded = await loadReservation(reservationId)
  if (!loaded) return
  const { reservation, guest } = loaded
  if (reservation.checkInNoticeSentAt) return
  const where = reservation.unit?.name ?? 'your apartment'
  const address = reservation.unit?.property?.addressLine ?? ''
  const body = `Hello ${splitName(guest.name)}, we look forward to welcoming you to ${where} tomorrow (${dateLabel(reservation.checkIn)}). Address: ${address}.${reservation.doorCode ? ` Door code: ${reservation.doorCode}.` : ''} Arriving late or need airport pickup? Reply to this message or call 054 170 4048. ABN Homes.`

  if (guest.phone) {
    await queueMessage({ channel: 'SMS', to: guest.phone, template: 'check_in_reminder', entityType: 'Reservation', entityId: reservation.id, dedupe: true, body })
    await queueMessage({
      channel: 'WHATSAPP',
      to: guest.phone,
      template: 'check_in_reminder',
      entityType: 'Reservation',
      entityId: reservation.id,
      dedupe: true,
      body: `*Check-in tomorrow* 🗝️\n\n${where}\n📍 ${address}\n🕙 From ${reservation.unit && 'checkInFrom' in reservation.unit ? '15:00' : '15:00'}\n${reservation.doorCode ? `🔐 Door code: *${reservation.doorCode}*\n` : ''}\nEverything you need — Wi-Fi, house manual, directions — is in your portal: ${APP_URL}/portal\n\nSafe travels!`,
    })
  }
  if (guest.email) {
    await queueMessage({
      channel: 'EMAIL',
      to: guest.email,
      template: 'check_in_reminder',
      entityType: 'Reservation',
      entityId: reservation.id,
      dedupe: true,
      subject: `Check-in tomorrow · ${reservation.code}`,
      body: emailHtml({
        heading: `Tomorrow you check in`,
        lines: [`${where} · ${dateLabel(reservation.checkIn)}`, `Address: ${address}`, reservation.doorCode ? `Door code: <b>${reservation.doorCode}</b>` : 'Door codes are released 24 hours before arrival.', 'Wi-Fi details and the house manual are waiting in your portal.'],
        cta: { label: 'Open my portal', url: `${APP_URL}/portal` },
      }),
    })
  }
  await db.reservation.update({ where: { id: reservation.id }, data: { checkInNoticeSentAt: new Date() } })
}

/** Post-stay review prompt (double-blind window opener). */
export async function notifyReviewRequest(reservationId: string): Promise<void> {
  const loaded = await loadReservation(reservationId)
  if (!loaded) return
  const { reservation, guest } = loaded
  if (reservation.reviewRequestedAt) return
  const where = reservation.unit?.name ?? 'your apartment'
  const reviewUrl = `${APP_URL}/portal/tenant?review=${reservation.id}`
  if (guest.email) {
    await queueMessage({
      channel: 'EMAIL',
      to: guest.email,
      template: 'review_request',
      entityType: 'Reservation',
      entityId: reservation.id,
      dedupe: true,
      subject: `How was ${where}?`,
      body: emailHtml({
        heading: `Tell us about your stay`,
        lines: [`You recently stayed at <b>${where}</b>. Your honest review helps fellow travellers — and helps us fix anything that fell short.`, 'Reviews are published only after you and your host have both had their say, so please be candid.'],
        cta: { label: 'Write a review', url: reviewUrl },
      }),
    })
  }
  if (guest.phone) {
    await queueMessage({
      channel: 'SMS',
      to: guest.phone,
      template: 'review_request',
      entityType: 'Reservation',
      entityId: reservation.id,
      dedupe: true,
      body: `Hello ${splitName(guest.name)}, thank you for staying at ${where}! How was it? Share a quick review: ${reviewUrl}. ABN Homes.`,
    })
  }
  await db.reservation.update({ where: { id: reservation.id }, data: { reviewRequestedAt: new Date() } })
}

/** Refund accepted by the gateway — tell the guest when it will land. */
export async function notifyRefundProcessed(args: {
  partyId: string
  amountMinor: number
  currency: string
  receiptNumber: string | null
  reference: string
}): Promise<void> {
  const guest = await guestContact(args.partyId)
  const amount = formatMinor(args.amountMinor, args.currency as never)
  if (guest.email) {
    await queueMessage({
      channel: 'EMAIL',
      to: guest.email,
      template: 'refund_processed',
      entityType: 'Payment',
      entityId: args.reference,
      dedupe: true,
      subject: `Refund of ${amount} on its way`,
      body: emailHtml({
        heading: 'Your refund is being processed',
        lines: [
          `We have refunded <b>${amount}</b> to your original payment method (receipt ${args.receiptNumber ?? args.reference}).`,
          'Depending on your bank or mobile money provider, it takes 5–10 working days to appear. Your reference is ' + args.reference + '.',
        ],
      }),
    })
  }
  if (guest.phone) {
    await queueMessage({
      channel: 'SMS',
      to: guest.phone,
      template: 'refund_processed',
      entityType: 'Payment',
      entityId: args.reference,
      dedupe: true,
      body: `Hello ${splitName(guest.name)}, your refund of ${amount} (receipt ${args.receiptNumber ?? args.reference}) is being processed and should reach you in 5-10 working days. ABN Homes.`,
    })
  }
}

/** Welcome / onboarding message when a guest account is created. */
export async function notifyGuestWelcome(party: Pick<Party, 'id' | 'name' | 'email' | 'phone'>, portalCode: string): Promise<void> {
  if (party.email) {
    await queueMessage({
      channel: 'EMAIL',
      to: party.email,
      template: 'guest_welcome',
      entityType: 'Party',
      entityId: party.id,
      dedupe: true,
      subject: 'Welcome to ABN Homes',
      body: emailHtml({
        heading: `Welcome, ${splitName(party.name)}`,
        lines: ['Your guest portal is ready: trips, payments, receipts, maintenance requests and check-in details, all in one place.', `Sign in with your email or phone and this code: <b>${portalCode}</b>.`],
        cta: { label: 'Open my portal', url: `${APP_URL}/portal` },
      }),
    })
  }
  if (party.phone) {
    await queueMessage({
      channel: 'SMS',
      to: party.phone,
      template: 'guest_welcome',
      entityType: 'Party',
      entityId: party.id,
      dedupe: true,
      body: `Welcome to ABN Homes, ${splitName(party.name)}! Your portal code is ${portalCode} — sign in at ${APP_URL}/portal. ABN Homes.`,
    })
  }
}
