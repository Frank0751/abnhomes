import { Download } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { portfolioReport, type PeriodReport } from '@/lib/reporting/analytics'
import { formatMinor } from '@/lib/core/money'
import { dateOnly, formatDate, toISODate, addDays, today } from '@/lib/core/dates'
import { PageHeader, Panel, StatGrid, StatCard, TableScroll, Pill } from '@/components/admin/ui'
import { PrintButton } from '@/components/admin/print-button'
import type { Currency } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; propertyId?: string }>
}) {
  await requirePermission('reports:read')
  const sp = await searchParams

  const from = sp.from ? new Date(sp.from) : addDays(today(), -30)
  const to = sp.to ? new Date(sp.to) : today()
  const propertyId = sp.propertyId || undefined

  const [report, properties] = await Promise.all([
    portfolioReport({ from, to, propertyId }),
    db.property.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  const currency: Currency = 'USD'

  // The same length of time immediately before — the baseline the narrative
  // compares against. One definition, one code path (same engine, shifted).
  const windowDays = Math.max(1, Math.round((dateOnly(to).getTime() - dateOnly(from).getTime()) / 86_400_000))
  const prevFrom = addDays(dateOnly(from), -windowDays)
  const prevReport = await portfolioReport({ from: prevFrom, to: dateOnly(from), propertyId })
  const narrative = buildNarrative(report, prevReport, currency)

  const propertyName = propertyId ? properties.find((p) => p.id === propertyId)?.name : undefined

  const exportUrl = `/api/reports/export?from=${toISODate(from)}&to=${toISODate(to)}${propertyId ? `&propertyId=${propertyId}` : ''}`
  const maxSource = Math.max(1, ...report.sourceMix.map((s) => s.count))

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Occupancy, rate and demand for the whole portfolio or a single building — with the period written up in plain words. The same engine feeds the owner statements."
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <PrintButton label="Print report" />
            <Link
              href={exportUrl}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-sm font-medium transition hover:bg-black/5"
            >
              <Download className="size-4" />
              Export CSV
            </Link>
          </div>
        }
      />

      {/* Print-only masthead — the screen keeps its normal chrome. */}
      <div className="hidden print:block">
        <p className="font-serif text-xl tracking-tight">ABN Homes — Portfolio report</p>
        <p className="mt-1 text-sm text-black/60">
          {propertyName ?? 'Whole portfolio'} · {formatDate(report.from)} → {formatDate(report.to)} ·
          prepared {formatDate(today())}
        </p>
      </div>

      <form method="GET" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-soft">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">From</span>
          <input type="date" name="from" defaultValue={toISODate(from)} className="rounded-lg border border-black/12 px-2.5 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">To</span>
          <input type="date" name="to" defaultValue={toISODate(to)} className="rounded-lg border border-black/12 px-2.5 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Property</span>
          <select name="propertyId" defaultValue={propertyId ?? ''} className="rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm">
            <option value="">Whole portfolio</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-[#0a0e1a] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a2233]">
          Run report
        </button>
      </form>

      <StatGrid>
        <StatCard label="Occupancy" value={`${(report.occupancy * 100).toFixed(1)}%`} sublabel={`${report.nightsSold} of ${report.nightsAvailable} nights`} />
        <StatCard label="ADR" value={formatMinor(report.adr, currency)} sublabel="average daily rate" />
        <StatCard label="RevPAR" value={formatMinor(report.revPAR, currency)} sublabel="revenue per available night" />
        <StatCard label="Revenue" value={formatMinor(report.revenueMinor, currency)} sublabel={`incl. ${formatMinor(report.extrasMinor, currency)} extras`} tone="positive" />
        <StatCard label="Bookings" value={String(report.bookings)} sublabel={`${report.cancellations} cancellations (${(report.cancellationRate * 100).toFixed(0)}%)`} />
        <StatCard
          label="Booking lead time"
          value={report.averageLeadDays !== null ? `${report.averageLeadDays} d` : '—'}
          sublabel="created → arrival"
        />
      </StatGrid>

      {/* The period, written up — generated from the same figures above. */}
      <Panel
        title="The period in plain words"
        description="Written from the same figures as the tables below. Print it and it reads like a report."
        className="mt-6"
      >
        <div className="space-y-3 px-5 py-4">
          {narrative.map((p) => (
            <div key={p.heading}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {p.heading}
              </p>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-balance">{p.body}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Where bookings come from" description="Bookings created in the period, by channel.">
          {report.sourceMix.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No bookings in this period.</p>
          ) : (
            <ul className="space-y-3 px-5 py-4">
              {report.sourceMix.map((s) => (
                <li key={s.source} className="text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{s.source.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.count} · {formatMinor(s.valueMinor, currency)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-[#0d9488]" style={{ width: `${(s.count / maxSource) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Revenue by month">
          {report.monthly.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No stays in this period.</p>
          ) : (
            <ul className="space-y-3 px-5 py-4">
              {report.monthly.map((m) => {
                const max = Math.max(1, ...report.monthly.map((x) => x.revenueMinor))
                return (
                  <li key={m.month} className="text-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium">{m.month}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {m.nights} nights · {formatMinor(m.revenueMinor, currency)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                      <div className="h-full rounded-full bg-[#0a0e1a]" style={{ width: `${(m.revenueMinor / max) * 100}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="By unit" description="Performance per home over the period." className="mt-6">
        <TableScroll>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-black/8 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Home</th>
                <th className="px-3 py-2.5 font-medium">Building</th>
                <th className="px-3 py-2.5 text-right font-medium">Nights sold</th>
                <th className="px-3 py-2.5 text-right font-medium">Occupancy</th>
                <th className="px-3 py-2.5 text-right font-medium">ADR</th>
                <th className="px-5 py-2.5 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {report.byUnit.map((u) => (
                <tr key={u.unitId} className="border-b border-black/5 last:border-0">
                  <td className="px-5 py-2.5 font-medium">{u.unitName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u.propertyName}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.nightsSold}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Pill tone={u.occupancy > 0.6 ? 'positive' : u.occupancy > 0.3 ? 'warning' : 'neutral'}>
                      {(u.occupancy * 100).toFixed(0)}%
                    </Pill>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatMinor(u.adr, currency)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{formatMinor(u.revenueMinor, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Panel>

      <p className="mt-4 text-xs text-muted-foreground">
        Period {formatDate(report.from)} → {formatDate(report.to)} · nights counted are clipped to the
        period, so partial stays contribute only the nights that fall inside it.
      </p>
    </div>
  )
}

const pct = (share: number) => `${(share * 100).toFixed(0)}%`

const movement = (cur: number, prev: number) => {
  if (prev === 0 && cur === 0) return 'unchanged'
  if (prev === 0) return 'up from nothing'
  const change = Math.round(((cur - prev) / prev) * 100)
  if (change === 0) return 'unchanged'
  return `${change > 0 ? 'up' : 'down'} ${Math.abs(change)}%`
}

/**
 * The management write-up. Every sentence is grounded in a number that is
 * already on the page — if a claim can't be traced to a figure, it doesn't
 * belong here.
 */
function buildNarrative(
  cur: PeriodReport,
  prev: PeriodReport,
  currency: Currency
): { heading: string; body: string }[] {
  const paragraphs: { heading: string; body: string }[] = []

  const revenueMove = movement(cur.revenueMinor, prev.revenueMinor)
  paragraphs.push({
    heading: 'The headline',
    body:
      `The portfolio ran at ${pct(cur.occupancy)} occupancy between ${formatDate(cur.from)} and ${formatDate(cur.to)} — ` +
      `${cur.nightsSold} nights sold of ${cur.nightsAvailable} available. Revenue came to ` +
      `${formatMinor(cur.revenueMinor, currency)} at an average daily rate of ${formatMinor(cur.adr, currency)} ` +
      `and ${formatMinor(cur.revPAR, currency)} per available night` +
      (prev.nightsSold > 0 || prev.revenueMinor > 0
        ? `, ${revenueMove} on the previous ${Math.round((cur.to.getTime() - cur.from.getTime()) / 86_400_000)} days.`
        : '. There is no comparable prior period — treat this window as the baseline going forward.'),
  })

  const leader = cur.sourceMix[0]
  const demandBits: string[] = []
  demandBits.push(
    `${cur.bookings} booking${cur.bookings === 1 ? '' : 's'} were created in the window` +
      (cur.cancellations > 0
        ? `, with ${cur.cancellations} cancellation${cur.cancellations === 1 ? '' : 's'} (${pct(cur.cancellationRate)} of everything created).`
        : ' and none of them cancelled.')
  )
  if (leader) {
    demandBits.push(
      `Most demand came through ${leader.source.replace(/_/g, ' ').toLowerCase()} ` +
        `(${leader.count} of ${cur.bookings}).`
    )
  }
  if (cur.averageLeadDays !== null) {
    demandBits.push(
      prev.averageLeadDays !== null && prev.averageLeadDays > 0
        ? `Guests booked on average ${cur.averageLeadDays} days ahead, against ${prev.averageLeadDays} in the previous window.`
        : `Guests booked on average ${cur.averageLeadDays} days ahead of arrival.`
    )
  }
  paragraphs.push({ heading: 'Demand', body: demandBits.join(' ') })

  const earners = cur.byUnit.filter((u) => u.revenueMinor > 0).sort((a, b) => b.revenueMinor - a.revenueMinor)
  if (earners.length > 0) {
    const best = earners[0]
    const thin = earners.filter((u) => u.occupancy < 0.3)
    paragraphs.push({
      heading: 'The homes',
      body:
        `${best.unitName} (${best.propertyName}) carried the period — ${pct(best.occupancy)} occupancy ` +
        `and ${formatMinor(best.revenueMinor, currency)} in revenue.` +
        (thin.length > 0
          ? ` ${thin.map((u) => u.unitName).join(', ')} ${thin.length === 1 ? 'ran' : 'ran'} under 30% occupancy and ${thin.length === 1 ? 'is' : 'are'} where a pricing look would pay first.`
          : ' Every home that turned a night ran above 30% occupancy.'),
    })
  }

  const extrasShare = cur.revenueMinor > 0 ? cur.extrasMinor / cur.revenueMinor : 0
  paragraphs.push({
    heading: 'The shape of the money',
    body:
      `Accommodation made up ${pct(1 - extrasShare)} of revenue; extras (cleaning and add-ons) added ` +
      `${formatMinor(cur.extrasMinor, currency)} (${pct(extrasShare)}). ` +
      `ADR ${movement(cur.adr, prev.adr)} and RevPAR ${movement(cur.revPAR, prev.revPAR)} against the previous window ` +
      `— RevPAR is the honest one, because it folds occupancy and rate into a single number.`,
  })

  return paragraphs
}
