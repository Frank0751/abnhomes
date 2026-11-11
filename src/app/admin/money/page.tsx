/**
 * Payments and reconciliation.
 *
 * The pending queue at the top is the important part: cash captured on a phone
 * with no signal is real money that the office has not yet seen. It stays
 * visible until someone confirms it against the float.
 */

import Link from 'next/link'
import { requirePermission } from '@/lib/session'
import { can, propertyWhere } from '@/lib/rbac'
import { db } from '@/lib/db'
import { currentMonthPeriod, formatDate, formatDateTime } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import { formatPhone } from '@/lib/core/phone'
import {
  EmptyState,
  Money,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  StatusPill,
  SyncBadge,
  TableScroll,
  humanise,
} from '@/components/admin/ui'
import { ConfirmPaymentButton } from './confirm-button'
import { RefundPaymentButton } from './refund-button'
import { gatewayIsSimulated } from '@/lib/payments/gateway'

export default async function MoneyPage() {
  const actor = await requirePermission('money:read')
  const period = currentMonthPeriod()
  const scope = propertyWhere(actor)

  const [pending, recent, monthTotals, byChannel] = await Promise.all([
    db.payment.findMany({
      where: { syncState: 'PENDING', status: 'PENDING', ...scope },
      include: {
        party: { select: { name: true, phone: true } },
        property: { select: { name: true } },
        recordedBy: { select: { name: true } },
      },
      orderBy: { receivedAt: 'asc' },
    }),
    db.payment.findMany({
      where: scope,
      include: {
        party: { select: { name: true } },
        property: { select: { name: true } },
        allocations: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: 100,
    }),
    db.payment.groupBy({
      by: ['currency'],
      where: {
        status: 'CONFIRMED',
        receivedAt: { gte: period.start, lt: period.end },
        ...scope,
      },
      _sum: { amountMinor: true },
      _count: true,
    }),
    db.payment.groupBy({
      by: ['channel'],
      where: {
        status: 'CONFIRMED',
        receivedAt: { gte: period.start, lt: period.end },
        currency: 'GHS',
        ...scope,
      },
      _sum: { amountMinor: true },
    }),
  ])

  const canReconcile = can(actor, 'money:reconcile')
  const canAdjust = can(actor, 'money:adjust')

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every payment, every channel. Receipt numbers are sequential and never reused."
      />

      {gatewayIsSimulated() && (
        <p className="mb-6 rounded border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-sm text-blue-900">
          The payment gateway is in simulation mode — no Paystack key is configured, so card and
          mobile money flows return test references instead of charging anyone.
        </p>
      )}

      <StatGrid>
        {monthTotals.map((row) => (
          <StatCard
            key={row.currency}
            label={`Received this month (${row.currency})`}
            value={formatMinor(row._sum.amountMinor ?? 0, row.currency)}
            sublabel={`${row._count} payment${row._count === 1 ? '' : 's'}`}
          />
        ))}
        <StatCard
          label="Awaiting confirmation"
          value={String(pending.length)}
          sublabel="Recorded offline, not yet reconciled"
          tone={pending.length > 0 ? 'warning' : 'default'}
        />
      </StatGrid>

      {pending.length > 0 && (
        <Panel
          className="mt-8 border-amber-300"
          title="Awaiting confirmation"
          description="Captured on a device without signal. Confirm each against the cash float before it counts as received."
        >
          <TableScroll>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Receipt</th>
                  <th className="px-4 py-2.5 text-left font-semibold">From</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Recorded by</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Received</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  {canReconcile && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {pending.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{payment.receiptNumber}</td>
                    <td className="px-4 py-2.5">
                      {payment.party.name}
                      {payment.party.phone && (
                        <span className="block text-xs text-muted-foreground">
                          {formatPhone(payment.party.phone)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {payment.recordedBy?.name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {formatDateTime(payment.receivedAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Money minor={payment.amountMinor} currency={payment.currency} />
                    </td>
                    {canReconcile && (
                      <td className="px-4 py-2.5 text-right">
                        <ConfirmPaymentButton paymentId={payment.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Panel>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Panel title="Recent payments">
          {recent.length === 0 ? (
            <EmptyState
              title="No payments yet"
              description="Payments appear here as soon as they are recorded at the desk or confirmed by the gateway."
            />
          ) : (
            <TableScroll>
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Receipt</th>
                    <th className="px-4 py-2.5 text-left font-semibold">From</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Channel</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Received</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Unapplied</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {recent.map((payment) => {
                    const allocated = payment.allocations.reduce((s, a) => s + a.amountMinor, 0)
                    const unapplied = payment.amountMinor - allocated

                    return (
                      <tr key={payment.id} className="hover:bg-black/[0.02]">
                        <td className="px-4 py-2.5 font-mono text-xs">{payment.receiptNumber}</td>
                        <td className="px-4 py-2.5">
                          {payment.party.name}
                          <span className="block text-xs text-muted-foreground">
                            {payment.property.name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {humanise(payment.channel)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {formatDate(payment.receivedAt)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Money minor={payment.amountMinor} currency={payment.currency} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {unapplied > 0 ? (
                            <Pill tone="info">
                              <Money minor={unapplied} currency={payment.currency} />
                            </Pill>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <StatusPill status={payment.status} />
                            <SyncBadge state={payment.syncState} />
                            {canAdjust && payment.status === 'CONFIRMED' && (
                              <RefundPaymentButton paymentId={payment.id} />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Panel>

        <aside className="space-y-4">
          <Panel title="By channel this month" description="Cedi payments only.">
            <dl className="divide-y divide-black/6">
              {byChannel.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing received yet this month.
                </p>
              )}
              {byChannel.map((row) => (
                <div key={row.channel} className="flex items-center justify-between px-4 py-2.5">
                  <dt className="text-sm">{humanise(row.channel)}</dt>
                  <dd className="text-sm">
                    <Money minor={row._sum.amountMinor ?? 0} currency="GHS" />
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Unapplied credit">
            <p className="px-4 py-3 text-xs text-muted-foreground">
              Money on account that no charge has claimed yet. For a tenant paying a year up
              front, this is the advance rent — it settles each month automatically as the rent
              run raises the charge.
            </p>
            <div className="border-t border-black/8 px-4 py-3">
              <Link href="/admin/arrears" className="text-sm underline underline-offset-2">
                See tenants in credit and arrears
              </Link>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  )
}
