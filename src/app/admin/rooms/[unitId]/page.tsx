/**
 * One room, run as its own business.
 *
 * Its calendar, its revenue, its manager, its upcoming arrivals and its open
 * work — all in one place, because that is how ABN actually runs the building.
 */

import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/session'
import { can, hasPropertyAccess } from '@/lib/rbac'
import { db } from '@/lib/db'
import { unitCalendar } from '@/lib/short-stay/availability'
import { roomPerformance, roomRevenueTrend } from '@/lib/reporting/rooms'
import {
  addDays,
  dateOnly,
  formatDate,
  formatMonthYear,
  monthPeriod,
  today,
  toISODate,
} from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import { RoomCalendar } from '@/components/admin/room-calendar'
import { RoomRevenueChart } from '@/components/admin/room-revenue-chart'
import { AssignManager } from './assign-manager'
import {
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  StatusPill,
} from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CalendarPlus, Users, Wrench } from 'lucide-react'

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>
  searchParams: Promise<{ m?: string }>
}) {
  const actor = await requirePermission('units:read')
  const { unitId } = await params
  const { m } = await searchParams

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: {
      property: { select: { id: true, name: true, addressLine: true, city: true } },
      manager: { select: { id: true, name: true } },
      ratePlans: { where: { active: true }, orderBy: { priority: 'desc' } },
      leases: {
        where: { status: 'ACTIVE' },
        include: { tenant: { select: { name: true, phone: true } } },
        take: 1,
      },
    },
  })

  if (!unit) notFound()
  if (!hasPropertyAccess(actor, unit.propertyId)) notFound()

  // Which month the calendar is showing. `m` is an offset from this month so
  // the links stay readable and cannot be fed a nonsense date.
  const offset = Number.isFinite(Number(m)) ? Number(m) : 0
  const now = new Date()
  const period = monthPeriod(now.getUTCFullYear(), now.getUTCMonth() + offset)
  const thisMonth = monthPeriod(now.getUTCFullYear(), now.getUTCMonth())

  const [days, performance, trend, upcoming, openWork] = await Promise.all([
    unitCalendar({ unitId, from: period.start, to: period.end }),
    roomPerformance(unitId, { from: thisMonth.start, to: thisMonth.end }),
    roomRevenueTrend(unitId, 6),
    db.reservation.findMany({
      where: {
        unitId,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        checkOut: { gte: today() },
      },
      include: { guest: { select: { name: true, phone: true } } },
      orderBy: { checkIn: 'asc' },
      take: 8,
    }),
    db.ticket.findMany({
      where: { unitId, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] } },
      orderBy: { priority: 'desc' },
      take: 5,
    }),
  ])

  const staff = can(actor, 'units:write')
    ? await db.user.findMany({
        where: {
          active: true,
          role: { in: ['PROPERTY_MANAGER', 'FRONT_DESK', 'SUPER_ADMIN', 'HOUSEKEEPING'] },
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      })
    : []

  const lease = unit.leases[0]
  const base = `/admin/rooms/${unitId}`

  return (
    <>
      <Link
        href="/admin/rooms"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All rooms
      </Link>

      <PageHeader
        title={unit.name}
        description={`${unit.property.name} · ${unit.property.addressLine}, ${unit.property.city}`}
        actions={
          <>
            <StatusPill status={unit.status} />
            {!unit.isAmenity && can(actor, 'bookings:write') && (
              <Button asChild size="sm">
                <Link href={`/admin/bookings/new?unitId=${unit.id}`}>
                  <CalendarPlus className="mr-1.5 size-4" />
                  New booking
                </Link>
              </Button>
            )}
          </>
        }
      />

      {unit.isAmenity ? (
        <Panel title="Shared space">
          <p className="max-w-prose px-4 py-4 text-sm text-muted-foreground">
            {unit.name} belongs to the whole building rather than being let on its own,
            so it has no rate, no calendar and no revenue of its own. It appears on the
            room board so housekeeping and maintenance can still see it, and it is left
            out of every occupancy and revenue figure — counting it as an empty room
            would understate the building for ever.
          </p>
        </Panel>
      ) : (
        <StatGrid>
          <StatCard
            label="Earned this month"
            value={formatMinor(performance.revenueMinor, performance.currency)}
            sublabel={
              performance.expensesMinor > 0
                ? `${formatMinor(performance.netMinor, performance.currency)} after costs`
                : 'No costs this month'
            }
          />
          <StatCard
            label="Occupancy"
            value={`${Math.round(performance.occupancy * 100)}%`}
            sublabel={`${performance.nightsSold} of ${performance.nightsAvailable} nights`}
            tone={performance.occupancy >= 0.6 ? 'positive' : 'warning'}
          />
          <StatCard
            label="Average nightly rate"
            value={formatMinor(performance.adrMinor, performance.currency)}
            sublabel={`${performance.bookings} booking${performance.bookings === 1 ? '' : 's'}`}
          />
          <StatCard
            label="Revenue per available night"
            value={formatMinor(performance.revParMinor, performance.currency)}
            sublabel="Rate and occupancy combined"
          />
        </StatGrid>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-6">
          {!unit.isAmenity && (
            <RoomCalendar
              days={days}
              monthLabel={formatMonthYear(period.start)}
              unitId={unit.id}
              prevHref={`${base}?m=${offset - 1}`}
              nextHref={`${base}?m=${offset + 1}`}
              todayHref={base}
            />
          )}

          {!unit.isAmenity && (
            <Panel
              title="Revenue, last six months"
              description="What this room earned, month by month."
            >
              <div className="p-4">
                <RoomRevenueChart data={trend} currency={performance.currency} />
              </div>
            </Panel>
          )}

          <Panel
            title="Coming up"
            description={
              unit.isAmenity ? 'Bookings are not taken for shared space.' : undefined
            }
          >
            {upcoming.length === 0 ? (
              <EmptyState
                title="Nothing booked"
                description={
                  unit.isAmenity
                    ? 'Shared space is never booked directly.'
                    : 'This room is free from today onwards.'
                }
                action={
                  !unit.isAmenity && can(actor, 'bookings:write') ? (
                    <Button asChild size="sm">
                      <Link href={`/admin/bookings/new?unitId=${unit.id}`}>Take a booking</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/bookings/${r.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.guest.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(r.checkIn)} → {formatDate(r.checkOut)} ·{' '}
                          {r.nights} night{r.nights === 1 ? '' : 's'} ·{' '}
                          <span className="font-mono">{r.code}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-sm tabular-nums">
                          {formatMinor(r.totalMinor, r.currency)}
                        </span>
                        <StatusPill status={r.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          {unit.images[0] && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border shadow-soft">
              <Image
                src={unit.images[0]}
                alt={unit.name}
                fill
                sizes="330px"
                className="object-cover"
              />
            </div>
          )}

          <Panel title="Manager" description="Rooms are run independently.">
            <div className="p-4">
              {can(actor, 'units:write') ? (
                <AssignManager
                  unitId={unit.id}
                  currentId={unit.manager?.id ?? null}
                  staff={staff}
                />
              ) : (
                <p className="text-sm">
                  {unit.manager?.name ?? (
                    <span className="text-muted-foreground">Nobody assigned</span>
                  )}
                </p>
              )}
            </div>
          </Panel>

          {lease && (
            <Panel title="Sitting tenant">
              <dl className="space-y-2.5 p-4 text-sm">
                <Field label="Tenant" value={lease.tenant.name} />
                <Field
                  label="Rent"
                  value={`${formatMinor(lease.rentMinor, lease.currency)} ${lease.cycle.toLowerCase()}`}
                />
                <Field label="Lease ends" value={formatDate(lease.endDate)} />
              </dl>
            </Panel>
          )}

          <Panel title="The room">
            <dl className="space-y-2.5 p-4 text-sm">
              <Field label="Code" value={unit.code} />
              {!unit.isAmenity && (
                <>
                  <Field label="Sleeps" value={String(unit.maxGuests)} />
                  <Field
                    label="Bedrooms"
                    value={unit.bedrooms === 0 ? '—' : String(unit.bedrooms)}
                  />
                  {unit.sizeSqm && <Field label="Size" value={`${unit.sizeSqm} sqm`} />}
                  {unit.baseNightlyMinor && (
                    <Field
                      label="Nightly"
                      value={formatMinor(unit.baseNightlyMinor, unit.currency)}
                    />
                  )}
                  {unit.baseRentMinor && (
                    <Field label="Monthly rent" value={formatMinor(unit.baseRentMinor, 'GHS')} />
                  )}
                </>
              )}
            </dl>

            {unit.features.length > 0 && (
              <div className="border-t border-border px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {unit.features.map((f) => (
                    <Pill key={f}>{f}</Pill>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {openWork.length > 0 && (
            <Panel title="Open maintenance">
              <ul className="divide-y divide-border">
                {openWork.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{t.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">{t.code}</p>
                    </div>
                    <StatusPill status={t.priority} />
                  </li>
                ))}
              </ul>
              <div className="border-t border-border px-4 py-2.5">
                <Link
                  href="/admin/maintenance"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Wrench className="size-3.5" />
                  All maintenance
                </Link>
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}
