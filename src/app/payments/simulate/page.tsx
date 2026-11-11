import Link from 'next/link'
import { formatMinor } from '@/lib/core/money'
import { loadIntent } from '@/lib/payments/gateway'
import { db } from '@/lib/db'
import { completeSimulatedPaymentAction } from './actions'

export const dynamic = 'force-dynamic'

/**
 * Simulated Paystack checkout — only reachable when no merchant keys are
 * configured. Clearly labelled as a test rail so nobody mistakes it for a
 * live gateway.
 */
export default async function SimulateCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; amount?: string; currency?: string; channel?: string }>
}) {
  const sp = await searchParams
  const reference = sp.reference ?? ''
  const intent = reference ? await loadIntent(reference) : null

  const amountMinor = intent?.amountMinor ?? Number(sp.amount ?? 0)
  const currency = (intent?.currency ?? sp.currency ?? 'GHS') as 'GHS' | 'USD'

  let summary: { label: string; sub: string } | null = null
  if (intent?.reservationId) {
    const reservation = await db.reservation.findUnique({
      where: { id: intent.reservationId },
      include: { unit: { include: { property: { select: { name: true } } } } },
    })
    if (reservation) {
      summary = {
        label: `${reservation.unit.name} · ${reservation.unit.property.name}`,
        sub: `Booking ${reservation.code}`,
      }
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0a0e1a] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-6 shadow-lifted">
          <div className="mb-5 flex items-center justify-between border-b border-black/[0.06] pb-4">
            <span className="font-serif text-lg tracking-tight text-[#0a0e1a]">Checkout</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-300">
              TEST MODE — no real money
            </span>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a93a5]">Amount due</p>
          <p className="mt-1 font-serif text-4xl tracking-tight tabular-nums text-[#0a0e1a]">
            {formatMinor(amountMinor, currency)}
          </p>

          {summary && (
            <div className="mt-4 rounded-xl bg-[#f7f5f0] px-4 py-3">
              <p className="text-sm font-medium text-[#0a0e1a]">{summary.label}</p>
              <p className="text-xs text-[#5b6472]">{summary.sub}</p>
            </div>
          )}

          <dl className="mt-4 space-y-1.5 text-sm text-[#5b6472]">
            <div className="flex justify-between">
              <dt>Method</dt>
              <dd className="font-medium text-[#0a0e1a]">{(intent?.channel ?? sp.channel ?? 'CARD').replace(/_/g, ' ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Reference</dt>
              <dd className="font-mono text-xs">{reference}</dd>
            </div>
          </dl>

          <form action={completeSimulatedPaymentAction} className="mt-6">
            <input type="hidden" name="reference" value={reference} />
            <button className="w-full rounded-xl bg-[#0d9488] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0f8578]">
              Complete test payment
            </button>
          </form>
          <Link
            href={summary ? `/pay/${summary.sub.replace('Booking ', '')}` : '/book'}
            className="mt-3 block rounded-xl border border-black/10 px-4 py-3 text-center text-sm font-medium text-[#5b6472] transition hover:bg-black/[0.03]"
          >
            Cancel
          </Link>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-[#8a93a5]">
            This page appears because Paystack merchant keys are not configured. Add
            PAYSTACK_SECRET_KEY to switch every flow to the live gateway — no code changes.
          </p>
        </div>
      </div>
    </div>
  )
}
