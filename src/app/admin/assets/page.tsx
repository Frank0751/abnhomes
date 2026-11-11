import { Package, CalendarClock, HardHat } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { PageHeader, Panel, Pill, EmptyState, StatGrid, StatCard } from '@/components/admin/ui'
import { formatDate } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import { humanise } from '@/components/admin/ui'
import { createAssetAction, createScheduleAction, toggleScheduleAction } from './actions'
import { AssetForm, ScheduleForm, ScheduleToggle } from './forms'

export const dynamic = 'force-dynamic'

export default async function AssetsPage() {
  await requirePermission('maintenance:manage')

  const [properties, schedules, assets, vendors] = await Promise.all([
    db.property.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.preventiveMaintenance.findMany({
      include: {
        property: { select: { name: true } },
        unit: { select: { name: true } },
        vendor: { select: { name: true } },
      },
      orderBy: [{ active: 'desc' }, { nextDueAt: 'asc' }],
    }),
    db.asset.findMany({
      include: { property: { select: { name: true } }, unit: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    db.party.findMany({
      where: { isVendor: true },
      include: { ticketsAssigned: { where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } }, select: { id: true } } },
      orderBy: { name: 'asc' },
    }),
  ])

  const dueSoon = schedules.filter(
    (s) => s.active && s.nextDueAt && s.nextDueAt.getTime() - Date.now() < 14 * 24 * 3600_000
  )
  const assetValueMinor = assets.reduce((s, a) => s + (a.valueMinor ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="Assets &amp; servicing"
        description="The asset register, the recurring servicing calendar and the vendor bench — the difference between a well-run building and a reactive one."
      />

      <StatGrid>
        <StatCard label="Servicing due in 14 days" value={String(dueSoon.length)} tone={dueSoon.length > 0 ? 'warning' : 'positive'} sublabel="work orders raise automatically" />
        <StatCard label="Active schedules" value={String(schedules.filter((s) => s.active).length)} sublabel="recurring maintenance" />
        <StatCard label="Registered assets" value={String(assets.length)} sublabel="across the portfolio" />
        <StatCard label="Asset value (register)" value={assetValueMinor ? formatMinor(assetValueMinor, 'GHS') : '—'} sublabel="declared purchase values" />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Panel
            title="Servicing calendar"
            description="Work orders are raised automatically by the sweeper, lead days before each due date."
          >
            {schedules.length === 0 ? (
              <EmptyState title="No schedules yet" description="Add a recurring service — generator, AC, water tanks, pest control." />
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {schedules.map((s) => {
                  const overdue = s.active && s.nextDueAt && s.nextDueAt < new Date()
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <CalendarClock className="size-3.5 text-[#0d9488]" />
                          {s.name}
                          {!s.active && <Pill tone="neutral">Paused</Pill>}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {s.property.name}
                          {s.unit ? ` · ${s.unit.name}` : ''} · every {s.intervalDays} days ·{' '}
                          {humanise(s.category)}
                          {s.vendor ? ` · ${s.vendor.name}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.nextDueAt && (
                          <Pill tone={overdue ? 'critical' : s.nextDueAt.getTime() - Date.now() < 14 * 24 * 3600_000 ? 'warning' : 'neutral'}>
                            due {formatDate(s.nextDueAt)}
                          </Pill>
                        )}
                        <ScheduleToggle id={s.id} active={s.active} action={toggleScheduleAction} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Asset register" description="Appliances, plant and equipment with serials and service history.">
            {assets.length === 0 ? (
              <EmptyState title="No assets registered" description="Add the generator, the pumps, the ACs — future-you will thank you." />
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {assets.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Package className="size-3.5 text-[#5b6472]" />
                        {a.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.property.name}
                        {a.unit ? ` · ${a.unit.name}` : ''}
                        {a.brand ? ` · ${a.brand}` : ''}
                        {a.serial ? ` · SN ${a.serial}` : ''}
                        {a.nextServiceAt ? ` · next service ${formatDate(a.nextServiceAt)}` : ''}
                      </p>
                    </div>
                    {a.valueMinor && (
                      <span className="text-sm tabular-nums text-muted-foreground">{formatMinor(a.valueMinor, a.currency)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Vendor bench" description="Approved vendors and their open work.">
            {vendors.length === 0 ? (
              <EmptyState title="No vendors yet" description="Add vendors as parties with the vendor flag — they get their own portal view." />
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {vendors.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <HardHat className="size-3.5 text-[#5b6472]" />
                        {v.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.vendorTrade ?? 'General maintenance'}
                        {v.vendorRating ? ` · rated ${v.vendorRating}/10` : ''}
                      </p>
                    </div>
                    <Pill tone={v.ticketsAssigned.length > 0 ? 'info' : 'neutral'}>
                      {v.ticketsAssigned.length} open job{v.ticketsAssigned.length === 1 ? '' : 's'}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Add an asset">
            <AssetForm properties={properties} action={createAssetAction} />
          </Panel>
          <Panel title="Add a servicing schedule" description="Recurring work the sweeper raises automatically.">
            <ScheduleForm properties={properties} action={createScheduleAction} />
          </Panel>
        </div>
      </div>
    </div>
  )
}
