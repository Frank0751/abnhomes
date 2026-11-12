import Link from 'next/link'
import { AlertTriangle, FileText, KeyRound, TrendingUp, UserPlus } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { PageHeader, Panel, StatGrid, StatCard } from '@/components/admin/ui'
import { formatMinor } from '@/lib/core/money'
import { addDays, today } from '@/lib/core/dates'
import { dashboardData } from '@/lib/reporting/dashboard'
import {
  FunnelChart,
  OccupancyChart,
  RevenueTrendChart,
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
  searchParams: Promise<{ range?: string }>
}) {
  await requirePermission('reports:read')
  const { range: rawRange } = await searchParams
  const rangeDays = RANGES.some((r) => r.key === rawRange) ? Number(rawRange) : 90

  const from = addDays(today(), -rangeDays)
  const to = today()

  const data = await dashboardData({ from, to })

  // Two headline counts the cards link to, computed once.
  const [newReviews, unreadMessages] = await Promise.all([
    db.review.count({ where: { status: 'PENDING' } }),
    db.messageLog.count({ where: { status: 'QUEUED' } }),
  ])

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="The whole business on one screen — money, occupancy, demand and the public funnels. Every figure comes from the ledger and the tables it guards, so what you see here is what the statements will say."
        actions={
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/admin/analytics?range=${r.key}`}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  rangeDays === Number(r.key)
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-black/10 bg-white hover:bg-black/5'
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* KPI band */}
      <StatGrid>
        <StatCard
          label="Collected this month"
          value={formatMinor(data.kpis.monthRevenueMinor, 'GHS')}
          sublabel={`${data.kpis.monthPayments} payment${data.kpis.monthPayments === 1 ? '' : 's'} posted`}
          tone="positive"
        />
        <StatCard
          label="Portfolio occupancy"
          value={`${(data.kpis.occupancy * 100).toFixed(0)}%`}
          sublabel={`${formatRange(from, to)} window`}
        />
        <StatCard label="Active leases" value={String(data.kpis.activeLeases)} sublabel="long-let tenants in the rent run" />
        <StatCard
          label="Open applications"
          value={String(data.kpis.openApplications)}
          sublabel={`${data.kpis.purchasesInFlight} purchase${data.kpis.purchasesInFlight === 1 ? '' : 's'} in flight`}
        />
        <StatCard
          label="Outstanding (GHS charges)"
          value={formatMinor(data.kpis.arrearsMinor, 'GHS')}
          sublabel="open charges minus allocations"
          tone={data.kpis.arrearsMinor > 0 ? 'warning' : 'positive'}
        />
        <StatCard
          label="Needs a human"
          value={String(newReviews + unreadMessages)}
          sublabel={`${newReviews} reviews to moderate · ${unreadMessages} queued messages`}
          tone={newReviews + unreadMessages > 0 ? 'warning' : 'positive'}
        />
      </StatGrid>

      {/* Money */}
      <div className="mt-6">
        <Panel
          title="Money in"
          description="Confirmed payments posted to the ledger, by month. Reversals subtract automatically."
        >
          <div className="px-4 pb-4 pt-2">
            <RevenueTrendChart data={data.revenue} />
          </div>
        </Panel>
      </div>

      {/* Rooms + demand */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Occupancy by property" description={`Reservations touching the ${formatRange(from, to)} window.`}>
          <div className="px-4 pb-4 pt-2">
            <OccupancyChart data={data.occupancy} />
          </div>
        </Panel>
        <Panel title="Where bookings come from" description={`Channel mix for bookings created in the period.`}>
          <div className="px-4 pb-4 pt-2">
            <SourceMixChart data={data.sourceMix} />
          </div>
        </Panel>
      </div>

      {/* Funnels */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Renting funnel"
          description="From public application to a signed lease. Rejects and withdrawals are excluded from the stages."
        >
          <div className="px-4 pb-4 pt-2">
            <FunnelChart data={data.tenancyFunnel} color={TEAL_NAVY[0]} />
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
          description="From first offer to keys. The purchase journey runs through the same ledger as rent."
        >
          <div className="px-4 pb-4 pt-2">
            <FunnelChart data={data.salesFunnel} color={TEAL_NAVY[1]} />
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
                    <Link href="/admin/arrears" className="font-medium text-[#0f766e] hover:underline">Arrears</Link> for who.
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

const TEAL_NAVY = ['#0d9488', '#0a0e1a']

function formatRange(from: Date, to: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${from.toLocaleDateString('en-GB', opts)} – ${to.toLocaleDateString('en-GB', opts)}`
}
