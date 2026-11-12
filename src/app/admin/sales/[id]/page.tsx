import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Mail, Phone } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { PageHeader, Panel, StatGrid, StatCard, TableScroll, Pill, EmptyState, humanise } from '@/components/admin/ui'
import { formatMinor } from '@/lib/core/money'
import { formatDate } from '@/lib/core/dates'
import { CompleteSaleButton, SalePaymentForm } from '@/components/admin/sale-payment-form'

export const dynamic = 'force-dynamic'

type PlanLine = { label: string; amountMinor: number; dueDate: string }

const TONE: Record<string, 'positive' | 'warning' | 'neutral' | 'negative'> = {
  APPLICATION: 'warning',
  APPROVED: 'warning',
  CONTRACTED: 'positive',
  COMPLETED: 'positive',
  DECLINED: 'negative',
  CANCELLED: 'neutral',
}

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('sales:read')
  const { id } = await params

  const purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      unit: {
        select: {
          name: true, images: true, propertyId: true,
          property: { select: { name: true, city: true } },
        },
      },
      buyer: { select: { name: true, email: true, phone: true, idVerifiedAt: true } },
      charges: {
        where: { status: { notIn: ['REVERSED', 'WAIVED'] } },
        orderBy: { dueDate: 'asc' },
        include: {
          allocations: {
            include: { payment: { select: { receiptNumber: true, channel: true, receivedAt: true, reference: true } } },
          },
        },
      },
    },
  })
  if (!purchase) notFound()

  const owed = purchase.charges.reduce((s, c) => s + c.amountMinor, 0)
  const paid = purchase.charges.reduce((s, c) => s + c.allocations.reduce((a, al) => a + al.amountMinor, 0), 0)
  const outstanding = Math.max(0, owed - paid)
  const plan = (purchase.plan as PlanLine[] | null) ?? []
  const nextUnpaid = purchase.charges.find(
    (c) => c.allocations.reduce((s, al) => s + al.amountMinor, 0) < c.amountMinor
  )

  return (
    <div>
      <Link href="/admin/sales" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All sales
      </Link>

      <PageHeader
        title={purchase.code}
        description={`${purchase.unit.name} · ${purchase.unit.property.name}, ${purchase.unit.property.city} · applied ${formatDate(purchase.createdAt)}`}
        actions={
          <Link
            href={`/track/${purchase.code}`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-sm font-medium transition hover:bg-black/5"
          >
            <ExternalLink className="size-4" />
            Buyer's tracking page
          </Link>
        }
      />

      <StatGrid>
        <StatCard label="Agreed price" value={formatMinor(purchase.offerMinor, purchase.currency)} sublabel={`asking was on the unit`} />
        <StatCard label="Paid so far" value={formatMinor(paid, purchase.currency)} sublabel={`${purchase.charges.length} installment charge${purchase.charges.length === 1 ? '' : 's'}`} tone="positive" />
        <StatCard label="Outstanding" value={formatMinor(outstanding, purchase.currency)} sublabel={outstanding === 0 ? 'fully settled' : 'across open installments'} />
        <StatCard
          label="Status"
          value={humanise(purchase.status)}
          sublabel={purchase.completedAt ? `completed ${formatDate(purchase.completedAt)}` : purchase.reviewedAt ? `last review ${formatDate(purchase.reviewedAt)}` : 'awaiting review'}
        />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Installment schedule */}
          <Panel title="Installment schedule" description="Charges live in the ledger. A payment settles them oldest-first.">
            {purchase.charges.length === 0 ? (
              <EmptyState
                title="No installments yet"
                description="Charges appear when the sale is contracted with a payment plan."
              />
            ) : (
              <TableScroll>
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-black/8 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">Installment</th>
                      <th className="px-3 py-2.5 font-medium">Due</th>
                      <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                      <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.charges.map((c) => {
                      const cPaid = c.allocations.reduce((s, al) => s + al.amountMinor, 0)
                      return (
                        <tr key={c.id} className="border-b border-black/5 last:border-0">
                          <td className="px-5 py-2.5">{c.description.replace(` — ${purchase.code}`, '')}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{formatDate(c.dueDate)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatMinor(c.amountMinor, c.currency)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-[#0f766e]">{formatMinor(cPaid, c.currency)}</td>
                          <td className="px-5 py-2.5">
                            <Pill tone={cPaid >= c.amountMinor ? 'positive' : cPaid > 0 ? 'warning' : 'neutral'}>
                              {cPaid >= c.amountMinor ? 'SETTLED' : cPaid > 0 ? 'PART_PAID' : humanise(c.status)}
                            </Pill>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Panel>

          {/* Payments received */}
          <Panel title="Payments received" description="Every cedi, with its receipt number and channel.">
            {paid === 0 ? (
              <EmptyState title="Nothing received yet" description="Record the first payment from the right-hand panel." />
            ) : (
              <TableScroll>
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-black/8 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">Receipt</th>
                      <th className="px-3 py-2.5 font-medium">Received</th>
                      <th className="px-3 py-2.5 font-medium">Channel</th>
                      <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.charges.flatMap((c) =>
                      c.allocations.map((al) => (
                        <tr key={al.id} className="border-b border-black/5 last:border-0">
                          <td className="px-5 py-2.5 font-mono text-[13px]">{al.payment?.receiptNumber ?? '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {al.payment ? formatDate(al.payment.receivedAt) : '—'}
                            {al.payment?.reference && <span className="block text-[11px] opacity-70">{al.payment.reference}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{humanise(al.payment?.channel ?? '')}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums">{formatMinor(al.amountMinor, purchase.currency)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Panel>

          {/* Frozen plan */}
          {plan.length > 0 && (
            <Panel title="Contracted plan" description="Frozen at signing — the schedule the charges were posted from.">
              <ul className="grid grid-cols-2 gap-2 px-5 py-4 sm:grid-cols-3">
                {plan.map((line, i) => (
                  <li key={i} className="rounded-lg border border-black/8 bg-[#faf8f3] px-3 py-2 text-xs">
                    <p className="font-medium text-[#1a1f2e]">{line.label}</p>
                    <p className="mt-0.5 tabular-nums text-muted-foreground">
                      {formatMinor(line.amountMinor, purchase.currency)} · due {line.dueDate}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <Panel title="The buyer">
            <div className="px-5 py-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-black/8 bg-[#e8e3d8]">
                  {purchase.unit.images[0] && <Image src={purchase.unit.images[0]} alt="" fill sizes="56px" className="object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-[#1a1f2e]">{purchase.buyerName}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="size-3" />{purchase.buyerPhone}
                  </p>
                  {purchase.buyer.email && (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Mail className="size-3" />{purchase.buyer.email}
                    </p>
                  )}
                </div>
              </div>
              {purchase.buyerNotes && (
                <p className="mt-3 rounded bg-black/[0.04] px-2.5 py-2 text-xs italic text-muted-foreground">“{purchase.buyerNotes}”</p>
              )}
              {purchase.decisionNote && (
                <p className="mt-2 text-xs text-muted-foreground">Last review note: {purchase.decisionNote}</p>
              )}
            </div>
          </Panel>

          {purchase.status === 'CONTRACTED' && (
            <>
              <Panel title="Record a payment" description={`Next due: ${nextUnpaid ? nextUnpaid.description.replace(` — ${purchase.code}`, '') : 'any open installment'}`}>
                <div className="px-5 pb-5 pt-4">
                  <SalePaymentForm
                    purchaseId={purchase.id}
                    suggestedAmountMinor={nextUnpaid ? nextUnpaid.amountMinor - nextUnpaid.allocations.reduce((s, al) => s + al.amountMinor, 0) : null}
                    currency={purchase.currency}
                  />
                </div>
              </Panel>
              <Panel title="Handover">
                <div className="px-5 pb-5 pt-4">
                  <CompleteSaleButton purchaseId={purchase.id} outstandingMinor={outstanding} currency={purchase.currency} />
                </div>
              </Panel>
            </>
          )}
          {purchase.status === 'COMPLETED' && (
            <Panel title="Sold 🎉">
              <p className="px-5 py-4 text-sm text-muted-foreground">
                Keys handed over {purchase.completedAt ? formatDate(purchase.completedAt) : ''}. The unit is marked SOLD,
                off /own, and the buyer is flagged as an owner in the system.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
