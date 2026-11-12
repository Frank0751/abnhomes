import Link from 'next/link'
import { AlertTriangle, FileText, KeyRound, TrendingUp, UserPlus } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { PageHeader, Panel, StatGrid, StatCard, Delta, TableScroll, Pill } from '@/components/admin/ui'
import { PrintButton } from '@/components/admin/print-button'
import { formatMinor } from '@/lib/core/money'
import { addDays, dateOnly, today, toISODate } from '@/lib/core/dates'
import { dashboardData } from '@/lib/reporting/dashboard'
import {
  ArrearsAgingChart,
  BookingPaceChart,
  FunnelChart,
  OccupancyChart,
  OccupancyTrendChart,
  RevenueChart,
  SourceMixChart,
} from '@/components/admin/analytics-charts'

export const dynamic = 'force-dynamic'

const RANGES = [
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: '365', label: '12 months' },
] as const

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; propertyId?: string }>
}) {
  await requirePermission('reports:read')
  const sp = await searchParams
  const rangeDays = RANGES.some((r) => r.key === sp.range) ? Number(sp.range) : 90
  const propertyId = sp.propertyId || undefined

  const from = addDays(dateOnly(today()), -rangeDays)
  const to = dateOnly(today())

  const [data, properties, newReviews, unreadMessages] = await Promise.all([
    dashboardData({ from, to, propertyId }),
    db.property.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.review.count({ where: { status: 'PENDING' } }),
    db.messageLog.count({ where: { status: 'QUEUED' } }),
  ])

  const activeProperty = properties.find((p) => p.id === propertyId)
  const link = (r: number, pid?: string) =>
    `/admin/analytics?range=${r}${pid ? `&propertyId=${pid}` : ''}`
  const reportHref = `/admin/reports?from=${toISODate(from)}&to=${toISODate(to)}${propertyId ? `&propertyId=${propertyId}` : ''}`

  const filterPills = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={link(Number(r.key), propertyId)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              rangeDays === Number(r.key)
                ? 'bg-primary text-primary-foreground'
                : 'border border-black/10 bg-white hover:bg-black/5'
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>
      <span className="mx-1 hidden h-5 w-px bg-black/10 sm:block" />
      <div className="flex flex-wrap gap-1">
        <Link
          href={link(rangeDays)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            !propertyId
              ? 'bg-[#0a0e1a] text-white'
              : 'border border-black/10 bg-white hover:bg-black/5'
          }`}
        >
          All buildings
        </Link>
        {properties.map((p) => (
          <Link
            key={p.id}
            href={link(rangeDays, p.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              propertyId === p.id
                ? 'bg-[#0a0e1a] text-white'
                : 'border border-black/10 bg-white hover:bg-black/5'
            }`}
          >
            {p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name}
          </Link>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader
        title={`Analytics${activeProperty ? ` · ${activeProperty.name}` : ''}`}
        description="Money, occupancy, demand and the public funnels, compared with the previous period of the same length. Every figure comes from the ledger and the tables it guards — what you see here is what the statements will say."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={reportHref}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0a0e1a] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[#1a2233]"
            >
              <FileText className="size-4" />
              Management report
            </Link>
            <PrintButton label="Print view" />
          </div>
        }
      />

      {filterPills}

      {/* KPI band — every headline number carries its movement */}
      <StatGrid className="mt-5">
        <StatCard
          label={`Collected · last ${rangeDays}d`}
          value={formatMinor(data.kpis.windowRevenueMinor, 'GHS')}
          delta={<Delta current={data.kpis.windowRevenueMinor} previous={data.kpis.prevWindowRevenueMinor} good="up" />}
          sublabel="payments posted to the ledger"
          tone="positive"
        />
        <StatCard
          label="Portfolio occupancy"
          value={`${(data.kpis.occupancy * 100).toFixed(0)}%`}
          delta={<Delta current={data.kpis.occupancy} previous={data.kpis.prevOccupancy} good="up" suffix="pts" />}
          sublabel="nights stayed vs nights for sale"
        />
        <StatCard
          label="Bookings created"
          value={String(data.kpis.bookings)}
          delta={<Delta current={data.kpis.bookings} previous={data.kpis.prevBookings} good="up" />}
          sublabel="new demand in the window"
        />
        <StatCard
          label="Active leases"
          value={String(data.kpis.activeLeases)}
          sublabel="long-let tenants in the rent run"
        />
        <StatCard
          label="Open applications"
          value={String(data.kpis.openApplications)}
          sublabel={`${data.kpis.purchasesInFlight} purchase${data.kpis.purchasesInFlight === 1 ? '' : 's'} in flight`}
        />
        <StatCard
          label="Outstanding (GHS)"
          value={formatMinor(data.kpis.arrearsMinor, 'GHS')}
          sublabel="open charges minus allocations"
          tone={data.kpis.arrearsMinor > 0 ? 'warning' : 'positive'}
        />
      </StatGrid>

      {/* Money */}
      <div className="mt-6">
        <Panel
          title="Money in"
          description={
            activeProperty
              ? `Portfolio-wide collections (the ledger is not per-building). Occupancy, demand and the tables below are filtered to ${activeProperty.name}.`
              : 'Confirmed payments posted to the ledger, month by month. Reversals subtract automatically.'
          }
        >
          <div className="px-4 pb-4 pt-2">
            <RevenueChart data={data.revenue} />
          </div>
        </Panel>
      </div>

      {/* Rooms */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Occupancy trend" description={`Share of letting inventory occupied, month by month${activeProperty ? ` — ${activeProperty.name}` : ''}.`}>
          <div className="px-4 pb-4 pt-2">
            <OccupancyTrendChart data={data.occupancyTrend} />
          </div>
        </Panel>
        <Panel title="Occupancy by property" description={`Reservations touching the last ${rangeDays} days.`}>
          <div className="px-4 pb-4 pt-2">
            <OccupancyChart data={data.occupancy} />
          </div>
        </Panel>
      </div>

      {/* Demand */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Booking pace" description="Bookings created per month — the pace of new demand, with cancellations alongside.">
          <div className="px-4 pb-4 pt-2">
            <BookingPaceChart data={data.bookingPace} />
          </div>
        </Panel>
        <Panel title="Where bookings come from" description="Channel mix for bookings created in the window.">
          <div className="px-4 pb-4 pt-2">
            <SourceMixChart data={data.sourceMix} />
          </div>
        </Panel>
      </div>

      {/* Leaders + ageing */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Carrying the portfolio" description={`Top homes by revenue inside the last ${rangeDays} days.`}>
          {data.topUnits.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No stays in this window yet.
            </p>
          ) : (
            <TableScroll>
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="border-b border-black/8 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Home</th>
                    <th className="px-3 py-2.5 text-right font-medium">Nights</th>
                    <th className="px-3 py-2.5 text-right font-medium">Occupancy</th>
                    <th className="px-5 py-2.5 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topUnits.map((u) => (
                    <tr key={u.unitId} className="border-b border-black/5 last:border-0">
                      <td className="px-5 py-2.5">
                        <Link href={`/admin/portfolio/${u.unitId}`} className="font-medium hover:underline">
                          {u.unitName}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{u.propertyName}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{u.nightsSold}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Pill tone={u.occupancy > 0.6 ? 'positive' : u.occupancy > 0.3 ? 'warning' : 'neutral'}>
                          {(u.occupancy * 100).toFixed(0)}%
                        </Pill>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-medium">
                        {formatMinor(u.revenueMinor, 'USD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Panel>
        <Panel title="Arrears ageing" description="Open charges by how late they are — colour deepens with age.">
          <div className="px-4 pb-4 pt-2">
            <ArrearsAgingChart data={data.arrearsAging} />
          </div>
        </Panel>
      </div>

      {/* Funnels */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Renting funnel"
          description="From public application to a signed lease, with stage-to-stage conversion. Rejects and withdrawals are excluded."
        >
          <div className="px-4 pb-4 pt-2">
            <FunnelChart data={data.tenancyFunnel} color="#0d9488" noun="rental applications" />
          </div>
          <p className="flex items-center gap-1.5 px-5 pb-4 text-xs text-muted-foreground">
            <UserPlus className="size-3.5 text-[#0d9488]" />
            Review the people behind these numbers in{' '}
            <Link href="/admin/applications" className="font-medium text-[#0f766e] hover:underline">
              Applications
            </Link>
            .
          </p>
        </Panel>
        <Panel
          title="Ownership funnel"
          description="From first offer to keys, with conversion. The purchase journey runs through the same ledger as rent."
        >
          <div className="px-4 pb-4 pt-2">
            <FunnelChart data={data.salesFunnel} color="#0a0e1a" noun="purchase offers" />
          </div>
          <p className="flex items-center gap-1.5 px-5 pb-4 text-xs text-muted-foreground">
            <KeyRound className="size-3.5 text-[#0d9488]" />
            Manage the money side in{' '}
            <Link href="/admin/sales" className="font-medium text-[#0f766e] hover:underline">
              Property sales
            </Link>
            .
          </p>
        </Panel>
      </div>

      {/* Watchlist */}
      <div className="mt-6">
        <Panel title="Watchlist" description="Small things that get expensive when ignored.">
          <ul className="space-y-2 px-5 py-4 text-sm">
            {[
              data.kpis.arrearsMinor > 0 && (
                <li key="arrears" className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  <span>
                    <strong>{formatMinor(data.kpis.arrearsMinor, 'GHS')}</strong> sits in open charges — see{' '}
                    <Link href="/admin/arrears" className="font-medium text-[#0f766e] hover:underline">Arrears</Link> for who and how late.
                  </span>
                </li>
              ),
              data.occupancy.some((o) => o.occupancy < 0.4) && (
                <li key="occupancy" className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-amber-500" />
                  <span>
                    {data.occupancy.filter((o) => o.occupancy < 0.4).map((o) => o.property).join(', ')} running under
                    40% occupancy — worth a pricing look.
                  </span>
                </li>
              ),
              newReviews > 0 && (
                <li key="reviews" className="flex items-center gap-2">
                  <FileText className="size-4 text-amber-500" />
                  <span>
                    {newReviews} review{newReviews === 1 ? '' : 's'} waiting for moderation —{' '}
                    <Link href="/admin/reviews" className="font-medium text-[#0f766e] hover:underline">moderate now</Link>.
                  </span>
                </li>
              ),
              unreadMessages > 0 && (
                <li key="messages" className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  <span>
                    {unreadMessages} message{unreadMessages === 1 ? '' : 's'} queued in the outbox — the sweeper will
                    drain them; see{' '}
                    <Link href="/admin/messages" className="font-medium text-[#0f766e] hover:underline">Messages</Link>.
                  </span>
                </li>
              ),
            ].filter(Boolean) as React.ReactNode[]}
            {data.kpis.arrearsMinor === 0 &&
              !data.occupancy.some((o) => o.occupancy < 0.4) &&
              newReviews === 0 &&
              unreadMessages === 0 && (
                <li className="flex items-center gap-2 text-[#0f766e]">
                  <AlertTriangle className="size-4" />
                  Nothing needs attention. The numbers are clean.
                </li>
              )}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
