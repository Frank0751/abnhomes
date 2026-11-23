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
import { BaseRateEditor, RatePlans } from './rate-editor'
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
import { ArrowLeft, CalendarPlus, Pencil, Users, Wrench } from 'lucide-react'

/** Parse `?m=` into a whole number of months within ±120 of this one. */
function clampOffset(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.max(-120, Math.min(120, Math.trunc(n)))
}

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
      ratePlans: { orderBy: [{ active: 'desc' }, { priority: 'desc' }, { name: 'asc' }] },
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
  //
  // It still has to be clamped. `Number.isFinite` accepts '1e308', which makes
  // `monthPeriod` build an Invalid Date, which Prisma rejects — so ?m=1e308
  // turned the page into a 500. Round to a whole month and hold it inside ten
  // years either way, which is further than any calendar here needs to go.
  const offset = clampOffset(m)
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
        // Stays are half-open, [checkIn, checkOut): a booking checking out
        // today ended this morning and the room is sellable tonight, so 'gte'
        // left a finished stay sitting at the top of "Coming up".
        checkOut: { gt: today() },
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

  // Housekeeping and maintenance hold 'units:read' so they can find a room,
  // but deliberately not 'money:read'. Every figure below that is money, as
  // opposed to occupancy, is gated on it separately.
  const showMoney = can(actor, 'money:read')

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
            {can(actor, 'units:write') && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/rooms/${unit.id}/edit`}>
                  <Pencil className="mr-1.5 size-4" />
                  Edit details & photos
                </Link>
              </Button>
            )}
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
          {showMoney && (
            <StatCard
              label="Earned this month"
              value={formatMinor(performance.revenueMinor, performance.currency)}
              sublabel={
                performance.expensesMinor > 0
                  ? `${formatMinor(performance.netMinor, performance.currency)} after costs`
                  : 'No costs this month'
              }
            />
          )}
          <StatCard
            label="Occupancy"
            value={`${Math.round(performance.occupancy * 100)}%`}
            sublabel={`${performance.nightsSold} of ${performance.nightsAvailable} nights`}
            tone={performance.occupancy >= 0.6 ? 'positive' : 'warning'}
          />
          {showMoney ? (
            <>
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
            </>
          ) : (
            <StatCard
              label="Bookings this month"
              value={String(performance.bookings)}
              sublabel="Arrivals counted against this room"
            />
          )}
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

          {!unit.isAmenity && showMoney && (
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
                        {showMoney && (
                          <span className="font-mono text-sm tabular-nums">
                            {formatMinor(r.totalMinor, r.currency)}
                          </span>
                        )}
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

          {/* Rates. Reading them is money, so it is gated on money:read the
              same as every other figure on this page; changing them is
              units:write, the same capability that assigns the manager. */}
          {!unit.isAmenity && showMoney && (
            <Panel
              title="Rates"
              description="What this room costs, and when."
            >
              <dl className="space-y-2.5 border-b border-border p-4 text-sm">
                <Field
                  label="Base nightly"
                  value={
                    unit.baseNightlyMinor == null
                      ? 'Not set'
                      : formatMinor(unit.baseNightlyMinor, unit.currency)
                  }
                />
                <Field
                  label="Base monthly rent"
                  value={
                    unit.baseRentMinor == null
                      ? 'Not set'
                      : formatMinor(unit.baseRentMinor, unit.currency)
                  }
                />
                <Field
                  label="Paid bookings"
                  value={unit.instantBook ? 'Confirm automatically' : 'Wait for approval'}
                />
              </dl>

              {can(actor, 'units:write') && (
                <div className="p-4">
                  <BaseRateEditor
                    unitId={unit.id}
                    currency={unit.currency}
                    baseNightlyMinor={unit.baseNightlyMinor}
                    baseRentMinor={unit.baseRentMinor}
                    instantBook={unit.instantBook}
                  />
                </div>
              )}

              {can(actor, 'units:write') ? (
                <RatePlans unitId={unit.id} currency={unit.currency} plans={unit.ratePlans} />
              ) : (
                <dl className="space-y-2.5 p-4 text-sm">
                  {unit.ratePlans
                    .filter((plan) => plan.active)
                    .map((plan) => (
                      <Field
                        key={plan.id}
                        label={plan.name}
                        value={formatMinor(plan.nightlyMinor, plan.currency)}
                      />
                    ))}
                </dl>
              )}
            </Panel>
          )}

          {lease && (
            <Panel title="Sitting tenant">
              <dl className="space-y-2.5 p-4 text-sm">
                <Field label="Tenant" value={lease.tenant.name} />
                {showMoney && (
                  <Field
                    label="Rent"
                    value={`${formatMinor(lease.rentMinor, lease.currency)} ${lease.cycle.toLowerCase()}`}
                  />
                )}
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
                  {unit.sizeSqm != null && (
                    <Field label="Size" value={`${unit.sizeSqm} sqm`} />
                  )}
                  {showMoney && unit.baseNightlyMinor != null && (
                    <Field
                      label="Nightly"
                      value={formatMinor(unit.baseNightlyMinor, unit.currency)}
                    />
                  )}
                  {showMoney && unit.baseRentMinor != null && (
                    <Field
                      label="Monthly rent"
                      value={formatMinor(unit.baseRentMinor, unit.currency)}
                    />
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
