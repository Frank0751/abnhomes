import Link from 'next/link'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { db } from '@/lib/db'
import { formatMinor } from '@/lib/core/money'
import { settleFromProvider, loadIntent, gatewayIsSimulated } from '@/lib/payments/gateway'
import { formatDate } from '@/lib/core/dates'

export const dynamic = 'force-dynamic'

/**
 * Where Paystack sends the payer back. The redirect itself proves nothing,
 * so the payment is verified server-side and settled here if the webhook has
 * not already done it. Idempotent end to end.
 */
export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; simulated?: string; missing?: string }>
}) {
  const sp = await searchParams
  const reference = sp.reference ?? ''

  let payment = reference
    ? await db.payment.findFirst({
        where: { OR: [{ reference }, { providerRef: reference }] },
        include: {
          allocations: { include: { charge: { include: { reservation: { include: { unit: { select: { name: true } } } } } } } },
        },
      })
    : null

  // The webhook usually wins the race, but if the guest lands here first and
  // the provider is live, settle now.
  if (!payment && reference && !gatewayIsSimulated() && !sp.missing) {
    const intent = await loadIntent(reference)
    if (intent) {
      await settleFromProvider({
        reference,
        propertyId: intent.propertyId,
        partyId: intent.partyId,
      })
      payment = await db.payment.findFirst({
        where: { OR: [{ reference }, { providerRef: reference }] },
        include: {
          allocations: { include: { charge: { include: { reservation: { include: { unit: { select: { name: true } } } } } } } },
        },
      })
    }
  }

  const reservation = payment?.allocations.map((a) => a.charge.reservation).find(Boolean) ?? null

  const status = payment?.status === 'CONFIRMED' ? 'success' : sp.missing ? 'unknown' : 'pending'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f7f5f0] bg-[radial-gradient(1100px_420px_at_50%_-120px,rgba(13,148,136,0.1),transparent)] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-black/[0.08] bg-white p-8 text-center shadow-lifted">
        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto size-12 text-emerald-600" strokeWidth={1.5} />
            <h1 className="mt-4 font-serif text-2xl tracking-tight text-[#0a0e1a]">Payment received</h1>
            <p className="mt-2 text-sm text-[#5b6472]">
              {formatMinor(payment!.amountMinor, payment!.currency)} · Receipt{' '}
              {payment!.receiptNumber}
              {sp.simulated ? ' · (test mode)' : ''}
            </p>
            {reservation && (
              <div className="mt-5 rounded-xl bg-[#f7f5f0] px-4 py-3 text-left">
                <p className="text-sm font-medium text-[#0a0e1a]">{reservation.unit.name}</p>
                <p className="text-xs text-[#5b6472]">
                  {formatDate(reservation.checkIn)} → {formatDate(reservation.checkOut)} · Booking{' '}
                  {reservation.code}
                </p>
              </div>
            )}
            <p className="mt-4 text-sm text-[#5b6472]">
              {reservation?.status === 'CONFIRMED' || reservation?.status === 'CHECKED_IN'
                ? 'Your booking is confirmed — a confirmation email and SMS are on their way.'
                : 'Our team will confirm your booking shortly, and you will receive an email and SMS.'}
            </p>
            <div className="mt-6 flex gap-2">
              <Link
                href="/portal"
                className="flex-1 rounded-xl bg-[#0a0e1a] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#1a2233]"
              >
                Open my portal
              </Link>
              <Link
                href="/book"
                className="flex-1 rounded-xl border border-black/10 px-4 py-3 text-sm font-medium text-[#5b6472] transition hover:bg-black/[0.03]"
              >
                Done
              </Link>
            </div>
          </>
        )}

        {status === 'pending' && (
          <>
            <Clock className="mx-auto size-12 text-amber-500" strokeWidth={1.5} />
            <h1 className="mt-4 font-serif text-2xl tracking-tight text-[#0a0e1a]">Payment not completed yet</h1>
            <p className="mt-2 text-sm text-[#5b6472]">
              We have not received a confirmation for reference{' '}
              <span className="font-mono text-xs">{reference}</span>. If you aborted the payment you can
              try again; if you paid by bank transfer, we will confirm it as soon as it lands.
            </p>
            <Link
              href={reservation ? `/pay/${reservation.code}` : '/book'}
              className="mt-6 inline-block rounded-xl bg-[#0d9488] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f8578]"
            >
              Try payment again
            </Link>
          </>
        )}

        {status === 'unknown' && (
          <>
            <XCircle className="mx-auto size-12 text-red-500" strokeWidth={1.5} />
            <h1 className="mt-4 font-serif text-2xl tracking-tight text-[#0a0e1a]">Payment not found</h1>
            <p className="mt-2 text-sm text-[#5b6472]">
              We could not match that payment reference. If money left your account, call or
              WhatsApp +233 54 170 4048 and we will sort it out quickly.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-[#0a0e1a] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#1a2233]"
            >
              Back to home
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
