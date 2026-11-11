import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { formatMinor } from '@/lib/core/money'
import { supportedChannels } from '@/lib/payments/gateway'
import { formatDate } from '@/lib/core/dates'
import { PayForm } from './pay-form'

export const dynamic = 'force-dynamic'

/**
 * The guest payment page. Booking code in the URL is the capability — no
 * login required, but the code is unguessable. Shows exactly what is owed
 * and lets the guest pay in full or just the deposit, by MoMo or card.
 */
export default async function PayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const reservation = await db.reservation.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      unit: { include: { property: { select: { name: true, addressLine: true, city: true } } } },
      guest: { select: { name: true, email: true, phone: true } },
    },
  })
  if (!reservation) notFound()

  const paid = await db.allocation.aggregate({
    where: {
      chargeId: { in: (await db.charge.findMany({ where: { reservationId: reservation.id }, select: { id: true } })).map((c) => c.id) },
      payment: { status: 'CONFIRMED' },
    },
    _sum: { amountMinor: true },
  })
  const paidMinor = paid._sum.amountMinor ?? 0
  const balanceMinor = Math.max(reservation.totalMinor - paidMinor, 0)

  const alreadyPaid = balanceMinor <= 0 || ['CANCELLED'].includes(reservation.status)

  return (
    <div className="min-h-dvh bg-[#f7f5f0] bg-[radial-gradient(1100px_420px_at_50%_-120px,rgba(13,148,136,0.1),transparent)] py-10 px-4">
      <div className="mx-auto max-w-lg">
        <a href="/" className="mb-8 flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo/abn-badge.png" alt="" className="size-7" />
          <span className="font-serif text-lg tracking-tight text-[#0a0e1a]">ABN Homes</span>
        </a>

        <div className="rounded-2xl border border-black/[0.08] bg-white shadow-lifted">
          <div className="border-b border-black/[0.06] px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a5]">
              Booking {reservation.code}
            </p>
            <h1 className="mt-1 font-serif text-xl tracking-tight text-[#0a0e1a]">
              {reservation.unit.name} · {reservation.unit.property.name}
            </h1>
            <p className="mt-1 text-sm text-[#5b6472]">
              {formatDate(reservation.checkIn)} → {formatDate(reservation.checkOut)} · {reservation.nights} night{reservation.nights === 1 ? '' : 's'} · {reservation.adults} guest{reservation.adults === 1 ? '' : 's'}
            </p>
          </div>

          {alreadyPaid ? (
            <div className="px-6 py-10 text-center">
              <p className="font-serif text-lg text-[#0a0e1a]">This booking is settled in full. 🎉</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-[#5b6472]">
                Thank you — your receipt is in your guest portal. We look forward to welcoming you.
              </p>
              <a
                href="/portal"
                className="mt-5 inline-block rounded-lg bg-[#0a0e1a] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a2233]"
              >
                Open my portal
              </a>
            </div>
          ) : (
            <PayForm
              reservationId={reservation.id}
              currency={reservation.currency}
              balanceMinor={balanceMinor}
              depositMinor={paidMinor > 0 ? 0 : Math.min(reservation.depositMinor, balanceMinor)}
              needsPhone={reservation.guest.phone ? false : true}
              suggestedPhone={reservation.guest.phone ?? ''}
            />
          )}

          <div className="border-t border-black/[0.06] px-6 py-4">
            <p className="text-center text-xs text-[#8a93a5]">
              Total {formatMinor(reservation.totalMinor, reservation.currency)} · Paid so far {formatMinor(paidMinor, reservation.currency)} · Secure payment powered by Paystack
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#8a93a5]">
          Questions? Call or WhatsApp +233 54 170 4048 — we reply fast.
        </p>
      </div>
    </div>
  )
}
