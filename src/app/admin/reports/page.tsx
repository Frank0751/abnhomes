import { Download } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { portfolioReport } from '@/lib/reporting/analytics'
import { formatMinor } from '@/lib/core/money'
import { formatDate, toISODate, addDays, today } from '@/lib/core/dates'
import { PageHeader, Panel, StatGrid, StatCard, TableScroll, Pill } from '@/components/admin/ui'
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
  const exportUrl = `/api/reports/export?from=${toISODate(from)}&to=${toISODate(to)}${propertyId ? `&propertyId=${propertyId}` : ''}`
  const maxSource = Math.max(1, ...report.sourceMix.map((s) => s.count))

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Occupancy, rate and demand for the whole portfolio or a single building. The same engine feeds the owner statements."
        actions={
          <Link
            href={exportUrl}
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-sm font-medium transition hover:bg-black/5"
          >
            <Download className="size-4" />
            Export CSV
          </Link>
        }
      />

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
