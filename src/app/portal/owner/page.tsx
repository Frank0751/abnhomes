/**
 * The owner's view.
 *
 * Owners want three things: what did my building earn, what did it cost, and
 * when am I paid. Everything here answers one of those, and the statement
 * lines are the frozen ones we actually sent — never a live recalculation
 * that might disagree with the paper they hold.
 */

import { requireParty } from '@/lib/session'
import { db } from '@/lib/db'
import { formatDate, currentMonthPeriod } from '@/lib/core/dates'
import { formatMinor, basisPointsToPercent } from '@/lib/core/money'
import { occupancyRate } from '@/lib/short-stay/availability'
import {
  EmptyState,
  Money,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  StatusPill,
  TableScroll,
} from '@/components/admin/ui'

type StatementLine = {
  date: string
  description: string
  category: 'revenue' | 'expense' | 'fee'
  grossMinor: number
  currency: 'GHS' | 'USD'
  baseMinor: number
}

export default async function OwnerPortal() {
  const { partyId } = await requireParty()
  const period = currentMonthPeriod()

  const [owner, properties, statements] = await Promise.all([
    db.party.findUniqueOrThrow({ where: { id: partyId } }),
    db.property.findMany({
      where: { ownerPartyId: partyId, active: true },
      include: {
        units: { select: { id: true, name: true, status: true, lettingMode: true } },
        agreements: { where: { active: true }, take: 1 },
      },
      orderBy: { name: 'asc' },
    }),
    db.ownerStatement.findMany({
      where: { ownerPartyId: partyId, status: { in: ['ISSUED', 'PAID'] } },
      include: { property: { select: { name: true } } },
      orderBy: { periodStart: 'desc' },
      take: 24,
    }),
  ])

  const unpaid = statements.filter((s) => s.status === 'ISSUED')
  const owedMinor = unpaid.reduce((s, x) => s + x.netPayableMinor, 0)
  const totalUnits = properties.reduce((s, p) => s + p.units.length, 0)
  const occupiedUnits = properties.reduce(
    (s, p) => s + p.units.filter((u) => u.status === 'OCCUPIED').length,
    0
  )

  const occupancy = await occupancyRate({
    from: period.start,
    to: period.end,
    propertyId: properties[0]?.id,
  })

  const latest = statements[0]
  const latestLines = (latest?.lines as StatementLine[] | null) ?? []

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-3xl tracking-tight">{owner.name}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {properties.length} propert{properties.length === 1 ? 'y' : 'ies'} managed by ABN Homes
        </p>
      </header>

      <StatGrid>
        <StatCard
          label="Due to you"
          value={formatMinor(owedMinor, 'GHS')}
          sublabel={`${unpaid.length} statement${unpaid.length === 1 ? '' : 's'} awaiting payout`}
          tone={owedMinor > 0 ? 'positive' : 'default'}
        />
        <StatCard label="Units" value={String(totalUnits)} sublabel={`${occupiedUnits} occupied`} />
        <StatCard
          label="Occupancy this month"
          value={`${Math.round(occupancy.rate * 100)}%`}
          sublabel={`${occupancy.nightsSold} nights sold`}
        />
        <StatCard
          label="Statements"
          value={String(statements.length)}
          sublabel="Issued to date"
        />
      </StatGrid>

      <Panel className="mt-8" title="Your properties">
        {properties.length === 0 ? (
          <EmptyState title="No properties on your account" />
        ) : (
          <ul className="divide-y divide-black/6">
            {properties.map((property) => {
              const agreement = property.agreements[0]
              return (
                <li key={property.id} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{property.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {property.addressLine}, {property.city} · {property.units.length} unit
                        {property.units.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    {agreement && (
                      <Pill tone="neutral">
                        {agreement.feeBasisPoints > 0
                          ? `${basisPointsToPercent(agreement.feeBasisPoints)} management fee`
                          : 'No management fee'}
                      </Pill>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel className="mt-6" title="Statements">
        {statements.length === 0 ? (
          <EmptyState
            title="No statements yet"
            description="Your first statement will appear here once the month is closed."
          />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Period</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Property</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Revenue</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Fee</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Costs</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Net to you</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {statements.map((statement) => (
                  <tr key={statement.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {formatDate(statement.periodStart)}
                      <span className="block font-mono text-xs text-muted-foreground">
                        {statement.code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{statement.property.name}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Money minor={statement.grossRevenueMinor} currency={statement.currency} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {statement.managementFeeMinor > 0
                        ? formatMinor(statement.managementFeeMinor, statement.currency)
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {statement.expensesMinor > 0
                        ? formatMinor(statement.expensesMinor, statement.currency)
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      <Money minor={statement.netPayableMinor} currency={statement.currency} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={statement.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      {latestLines.length > 0 && (
        <Panel
          className="mt-6"
          title={`What made up ${latest.code}`}
          description={`${formatDate(latest.periodStart)} to ${formatDate(latest.periodEnd)}. These are the figures as issued and they do not change.`}
        >
          <TableScroll>
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Item</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {latestLines.map((line, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                      {line.date}
                    </td>
                    <td className="px-4 py-2.5">
                      {line.description}
                      {line.currency !== latest.currency && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({formatMinor(line.grossMinor, line.currency)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {line.category === 'revenue' ? '' : '− '}
                      {formatMinor(line.baseMinor, latest.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Panel>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Revenue is recognised in the month it is earned, not the month the money arrived. A tenant
        who paid a year ahead contributes one month at a time, so these figures reflect what your
        property actually produced in the period.
      </p>
    </>
  )
}
