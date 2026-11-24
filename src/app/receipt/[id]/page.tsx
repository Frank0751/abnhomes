/**
 * The receipt.
 *
 * A real document the payer can open, read, print and keep — issued the
 * instant money is recorded, whichever rail it came in on.
 *
 * Addressed by the payment's id rather than its receipt number. Receipt
 * numbers are sequential (RCT-2026-000042), so a URL keyed on them would let
 * anyone walk the sequence and read every receipt ABN has ever issued. The id
 * is a cuid and cannot be guessed.
 *
 * No sign-in: a guest who paid by mobile money has no account, and asking them
 * to make one before they can see proof of payment would be absurd. The link
 * itself is the credential, exactly like the booking link.
 */

import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { COMPANY } from '@/lib/abn-data'
import { formatMinor } from '@/lib/core/money'
import { formatDate, formatDateTime } from '@/lib/core/dates'
import { formatPhone } from '@/lib/core/phone'
import { PrintButton } from './print-button'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Receipt',
  robots: { index: false, follow: false },
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const payment = await db.payment.findUnique({
    where: { id },
    include: {
      party: { select: { name: true, phone: true, email: true } },
      property: { select: { name: true, addressLine: true, city: true } },
      recordedBy: { select: { name: true } },
      allocations: {
        include: {
          charge: {
            select: {
              description: true,
              type: true,
              dueDate: true,
              unit: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  if (!payment) notFound()

  const allocated = payment.allocations.reduce((s, a) => s + a.amountMinor, 0)
  const unapplied = payment.amountMinor - allocated

  const tone =
    payment.status === 'CONFIRMED'
      ? {
          Icon: CheckCircle2,
          label: 'Payment received',
          note: 'This payment has been received and applied to the account.',
          cls: 'border-[var(--state-free-solid)] bg-[var(--state-free-bg)] text-[var(--state-free-fg)]',
        }
      : payment.status === 'PENDING'
        ? {
            Icon: Clock,
            label: 'Awaiting confirmation',
            note: 'This payment has been recorded but not yet confirmed by the office. Keep this receipt — it becomes final once confirmed.',
            cls: 'border-[var(--state-held-solid)] bg-[var(--state-held-bg)] text-[var(--state-held-fg)]',
          }
        : {
            Icon: XCircle,
            label: payment.status === 'REVERSED' ? 'Refunded' : 'Not completed',
            note:
              payment.status === 'REVERSED'
                ? 'This payment was refunded. It no longer settles the charges below.'
                : 'This payment did not complete. Nothing was taken.',
            cls: 'border-destructive bg-[var(--destructive-wash)] text-destructive',
          }

  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:py-14">
      <article className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-soft print:border-0 print:shadow-none">
        {/* ---------------------------------------------------------- header */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-6 sm:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo/abn-badge.png"
              alt=""
              width={44}
              height={44}
              className="rounded-md"
            />
            <div>
              <p className="text-lg font-bold tracking-tight">{COMPANY.name}</p>
              <p className="text-xs text-muted-foreground">{COMPANY.address}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Receipt
            </p>
            <p className="font-mono text-lg font-bold tabular-nums">{payment.receiptNumber}</p>
          </div>
        </header>

        {/* --------------------------------------------------------- outcome */}
        <div className={`flex items-start gap-3 border-b px-6 py-4 sm:px-8 ${tone.cls}`}>
          <tone.Icon className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">{tone.label}</p>
            <p className="mt-0.5 text-sm opacity-90">{tone.note}</p>
          </div>
        </div>

        {/* ---------------------------------------------------------- amount */}
        <div className="border-b border-border px-6 py-7 text-center sm:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Amount paid
          </p>
          <p className="mt-1 font-mono text-4xl font-bold tabular-nums sm:text-5xl">
            {formatMinor(payment.amountMinor, payment.currency)}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {humanChannel(payment.channel)} · {formatDateTime(payment.receivedAt)}
          </p>
        </div>

        {/* ------------------------------------------------------- the facts */}
        <dl className="grid gap-x-8 gap-y-4 border-b border-border px-6 py-6 sm:grid-cols-2 sm:px-8">
          <Row label="Received from" value={payment.party.name} />
          {payment.party.phone && (
            <Row label="Phone" value={formatPhone(payment.party.phone)} />
          )}
          <Row label="Property" value={payment.property.name} />
          <Row label="Date received" value={formatDate(payment.receivedAt)} />
          {payment.reference && <Row label="Reference" value={payment.reference} mono />}
          {payment.providerRef && (
            <Row label="Transaction" value={payment.providerRef} mono />
          )}
          {payment.recordedBy && (
            <Row label="Received by" value={payment.recordedBy.name} />
          )}
          {payment.confirmedAt && (
            <Row label="Confirmed" value={formatDateTime(payment.confirmedAt)} />
          )}
        </dl>

        {/* --------------------------------------------------- what it paid */}
        {payment.allocations.length > 0 && (
          <div className="border-b border-border px-6 py-6 sm:px-8">
            <h2 className="text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              What this settles
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {payment.allocations.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm">{a.charge.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.charge.unit?.name ? `${a.charge.unit.name} · ` : ''}
                      due {formatDate(a.charge.dueDate)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm tabular-nums">
                    {formatMinor(a.amountMinor, payment.currency)}
                  </span>
                </li>
              ))}
            </ul>

            {unapplied > 0 && (
              <p className="mt-3 rounded-lg bg-[var(--accent-wash)] px-3 py-2 text-xs text-[var(--accent-deep)]">
                {formatMinor(unapplied, payment.currency)} of this payment is held on your
                account as credit and will settle future charges automatically.
              </p>
            )}
          </div>
        )}

        {payment.allocations.length === 0 && payment.amountMinor > 0 && (
          <div className="border-b border-border px-6 py-5 sm:px-8">
            <p className="rounded-lg bg-[var(--accent-wash)] px-3 py-2 text-sm text-[var(--accent-deep)]">
              This payment is held on your account as credit. It will settle charges
              automatically as they fall due.
            </p>
          </div>
        )}

        {payment.notes && (
          <div className="border-b border-border px-6 py-5 sm:px-8">
            <h2 className="text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Note
            </h2>
            <p className="mt-1.5 text-sm">{payment.notes}</p>
          </div>
        )}

        {/* ---------------------------------------------------------- footer */}
        <footer className="space-y-4 px-6 py-6 sm:px-8">
          <p className="text-xs leading-relaxed text-muted-foreground">
            This is an official receipt from {COMPANY.name}. Keep it for your records.
            Questions about this payment? Call or WhatsApp{' '}
            <a
              href={COMPANY.whatsapp}
              className="font-medium text-[var(--accent-deep)] underline underline-offset-2"
            >
              {COMPANY.phone}
            </a>{' '}
            and quote receipt <span className="font-mono">{payment.receiptNumber}</span>.
          </p>

          <div className="flex flex-wrap items-center gap-3 no-print">
            <PrintButton />
            <a
              href={COMPANY.whatsapp}
              className="text-sm font-medium text-[var(--accent-deep)] underline underline-offset-2"
            >
              Query this receipt
            </a>
          </div>
        </footer>
      </article>

      <p className="mx-auto mt-5 max-w-2xl text-center text-xs text-muted-foreground no-print">
        {COMPANY.fullName} · {COMPANY.hours}
      </p>
    </main>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm ${mono ? 'font-mono break-all' : ''}`}>{value}</dd>
    </div>
  )
}

function humanChannel(channel: string): string {
  const labels: Record<string, string> = {
    MOMO_MTN: 'MTN MoMo',
    MOMO_TELECEL: 'Telecel Cash',
    MOMO_AIRTELTIGO: 'AirtelTigo Money',
    CARD: 'Card',
    BANK_TRANSFER: 'Bank transfer',
    CASH: 'Cash',
    PAYPAL: 'PayPal',
    OTHER: 'Other',
  }
  return labels[channel] ?? channel
}
