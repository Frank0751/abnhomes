/**
 * Arrears aging.
 *
 * Aged from the date each charge fell due, not from a stored balance. A tenant
 * sitting on advance rent shows as current, because their charges are settled
 * from that credit as they arise — which is the truth, and the reason this
 * report can be trusted.
 */

import { requirePermission } from '@/lib/session'
import { arrearsReport, collectionRate, tenantsInCredit } from '@/lib/reporting/arrears'
import { currentMonthPeriod, formatDate } from '@/lib/core/dates'
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
  TableScroll,
} from '@/components/admin/ui'
import { RunRemindersButton } from './reminders-button'

export default async function ArrearsPage() {
  const actor = await requirePermission('money:read')
  const period = currentMonthPeriod()

  const [report, collection, credit] = await Promise.all([
    arrearsReport({ actor, currency: 'GHS' }),
    collectionRate({ actor, from: period.start, to: period.end, currency: 'GHS' }),
    tenantsInCredit(actor, 'GHS'),
  ])

  const buckets = ['current', '1-30', '31-60', '61-90', '90+'] as const
  const bucketLabels: Record<string, string> = {
    current: 'Not yet due',
    '1-30': '1–30 days',
    '31-60': '31–60 days',
    '61-90': '61–90 days',
    '90+': 'Over 90 days',
  }

  return (
    <>
      <PageHeader
        title="Arrears"
        description={`As at ${formatDate(report.asOf)}. Aged from the day each charge fell due.`}
        actions={<RunRemindersButton />}
      />

      <StatGrid>
        <StatCard
          label="Total outstanding"
          value={formatMinor(report.totalOutstandingMinor, 'GHS')}
          sublabel={`${report.tenantsInArrears} tenant${report.tenantsInArrears === 1 ? '' : 's'} behind`}
          tone={report.totalOutstandingMinor > 0 ? 'warning' : 'positive'}
        />
        <StatCard
          label="Collection rate"
          value={`${Math.round(collection.rate * 100)}%`}
          sublabel="Of everything due this month"
          tone={collection.rate < 0.85 ? 'warning' : 'positive'}
        />
        <StatCard
          label="Over 90 days"
          value={formatMinor(report.totalsByBucket['90+'], 'GHS')}
          sublabel="Rarely recovered without escalation"
          tone={report.totalsByBucket['90+'] > 0 ? 'critical' : 'default'}
        />
        <StatCard
          label="Paid ahead"
          value={String(credit.length)}
          sublabel="Tenants holding credit on account"
          tone="positive"
        />
      </StatGrid>

      <Panel className="mt-8" title="Aging by tenant">
        {report.rows.length === 0 ? (
          <EmptyState
            title="Nothing outstanding"
            description="Every charge raised has been settled. Worth a moment of appreciation."
          />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Tenant</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Unit</th>
                  {buckets.map((b) => (
                    <th key={b} className="px-3 py-2.5 text-right font-semibold">
                      {bucketLabels[b]}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {report.rows.map((row) => (
                  <tr key={row.partyId} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{row.tenantName}</span>
                      {row.phone && (
                        <a
                          href={`tel:${row.phone}`}
                          className="block text-xs text-muted-foreground underline underline-offset-2"
                        >
                          {formatPhone(row.phone)}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {row.unitNames.join(', ') || row.propertyName}
                    </td>
                    {buckets.map((b) => (
                      <td key={b} className="px-3 py-2.5 text-right">
                        {row.buckets[b] > 0 ? (
                          <Money
                            minor={row.buckets[b]}
                            currency={row.currency}
                            className={b === '90+' ? 'text-red-700' : undefined}
                          />
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right font-medium">
                      <Money minor={row.totalOutstandingMinor} currency={row.currency} />
                      {row.daysOverdue > 0 && (
                        <span className="mt-0.5 block">
                          <Pill tone={row.daysOverdue > 60 ? 'critical' : 'warning'}>
                            {row.daysOverdue} days
                          </Pill>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-black/8 font-medium">
                  <td className="px-4 py-2.5" colSpan={2}>
                    Total
                  </td>
                  {buckets.map((b) => (
                    <td key={b} className="px-3 py-2.5 text-right">
                      <Money minor={report.totalsByBucket[b]} currency={report.currency} />
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <Money minor={report.totalOutstandingMinor} currency={report.currency} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableScroll>
        )}
      </Panel>

      {credit.length > 0 && (
        <Panel
          className="mt-6"
          title="Paid ahead"
          description="Credit held on account. For a yearly tenancy this is the unearned advance rent, and it is a liability, not income."
        >
          <TableScroll>
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Tenant</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Credit held</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {credit.map((row) => (
                  <tr key={row.partyId}>
                    <td className="px-4 py-2.5">{row.name}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Money minor={row.creditMinor} currency={row.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Panel>
      )}
    </>
  )
}
