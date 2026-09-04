/**
 * Owner statements.
 *
 * ABN owns some of these buildings and manages others. Both go through the
 * same statement, with ABN's own carrying a zero management fee, so the
 * arithmetic is identical and always reconciles.
 */

import { requirePermission } from '@/lib/session'
import { can, propertyWhere } from '@/lib/rbac'
import { db } from '@/lib/db'
import { formatDate, monthPeriod } from '@/lib/core/dates'
import { formatMinor, basisPointsToPercent } from '@/lib/core/money'
import {
  EmptyState,
  Money,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  StatusPill,
  TableScroll,
} from '@/components/admin/ui'
import { GenerateStatementButton, MarkPaidButton } from './statement-actions'

export default async function OwnersPage() {
  const actor = await requirePermission('owners:read')
  const canManage = can(actor, 'owners:manage')

  const now = new Date()
  const lastMonth = monthPeriod(now.getUTCFullYear(), now.getUTCMonth() - 1)

  const [properties, statements] = await Promise.all([
    db.property.findMany({
      where: { active: true, ...propertyWhere(actor) },
      include: {
        owner: { select: { id: true, name: true } },
        agreements: { where: { active: true }, take: 1 },
        statements: {
          where: { periodStart: lastMonth.start, periodEnd: lastMonth.end },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    }),
    db.ownerStatement.findMany({
      where: propertyWhere(actor),
      include: {
        property: { select: { name: true } },
        owner: { select: { name: true } },
      },
      orderBy: { periodStart: 'desc' },
      take: 60,
    }),
  ])

  const unpaid = statements.filter((s) => s.status === 'ISSUED')
  const owedMinor = unpaid.reduce((s, x) => s + x.netPayableMinor, 0)
  const missing = properties.filter((p) => p.statements.length === 0)

  return (
    <>
      <PageHeader
        title="Owner statements"
        description={`Revenue is recognised when earned, not when the money arrived. A tenant who paid a year ahead contributes one month at a time.`}
      />

      <StatGrid>
        <StatCard label="Properties" value={String(properties.length)} />
        <StatCard
          label="Statements issued, unpaid"
          value={String(unpaid.length)}
          sublabel={formatMinor(owedMinor, 'GHS')}
          tone={unpaid.length > 0 ? 'warning' : 'positive'}
        />
        <StatCard
          label="Missing for last month"
          value={String(missing.length)}
          sublabel={`${formatDate(lastMonth.start)} – ${formatDate(lastMonth.end)}`}
          tone={missing.length > 0 ? 'warning' : 'positive'}
        />
        <StatCard
          label="Managed for others"
          value={String(
            properties.filter((p) => (p.agreements[0]?.feeBasisPoints ?? 0) > 0).length
          )}
          sublabel="Third-party owners"
        />
      </StatGrid>

      {canManage && missing.length > 0 && (
        <Panel
          className="mt-8 border-amber-300"
          title={`Statements not yet produced for ${formatDate(lastMonth.start)}`}
          description="Generate each one when the month is closed. Issuing posts the management fee and the balance due to the owner."
        >
          <ul className="divide-y divide-black/6">
            {missing.map((property) => (
              <li
                key={property.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{property.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {property.owner.name}
                    {property.agreements[0] && (
                      <>
                        {' · '}
                        {property.agreements[0].feeBasisPoints > 0
                          ? `${basisPointsToPercent(property.agreements[0].feeBasisPoints)} fee`
                          : 'no fee, ABN owned'}
                      </>
                    )}
                  </p>
                </div>
                <GenerateStatementButton
                  propertyId={property.id}
                  periodStart={lastMonth.start.toISOString()}
                  periodEnd={lastMonth.end.toISOString()}
                />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel className="mt-8" title="Statements">
        {statements.length === 0 ? (
          <EmptyState
            title="No statements yet"
            description="Generate one for a closed month to see what an owner is due."
          />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Statement</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Property</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Period</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Revenue</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Fee</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Costs</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Net due</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  {canManage && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {statements.map((statement) => (
                  <tr key={statement.id} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-2.5 font-mono text-xs">{statement.code}</td>
                    <td className="px-4 py-2.5">
                      {statement.property.name}
                      <span className="block text-xs text-muted-foreground">
                        {statement.owner.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDate(statement.periodStart)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Money minor={statement.grossRevenueMinor} currency={statement.currency} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {statement.managementFeeMinor > 0 ? (
                        <Money
                          minor={statement.managementFeeMinor}
                          currency={statement.currency}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {statement.expensesMinor > 0 ? (
                        <Money minor={statement.expensesMinor} currency={statement.currency} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      <Money minor={statement.netPayableMinor} currency={statement.currency} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={statement.status} />
                    </td>
                    {canManage && (
                      <td className="px-4 py-2.5 text-right">
                        {statement.status === 'ISSUED' && (
                          <MarkPaidButton statementId={statement.id} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <div className="mt-6 max-w-2xl space-y-2 text-xs text-muted-foreground">
        <p>
          <strong className="font-medium">How the figures are built.</strong> Revenue is every
          charge raised for the property in the period, excluding deposits, which are held money
          rather than income. Costs are maintenance and other expenses booked against the building.
          The fee is the agreed percentage of revenue.
        </p>
        <p>
          A building can earn dollars from guests and cedis from tenants in the same month, so
          statements are produced in the reporting currency using the exchange rate captured when
          each entry was posted — never today&rsquo;s rate applied to last year&rsquo;s dollars.
        </p>
      </div>
    </>
  )
}
