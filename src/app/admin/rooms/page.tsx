/**
 * The room board.
 *
 * One question, answered in one glance: which rooms are earning and which are
 * sitting empty. Everything else — the calendar, the revenue, the manager — is
 * one click away on the room itself.
 *
 * State is carried by colour AND by a written label, never by colour alone, so
 * the board survives a colour-blind reader and a black-and-white print.
 */

import Link from 'next/link'
import Image from 'next/image'
import { requirePermission } from '@/lib/session'
import { propertyWhere } from '@/lib/rbac'
import { db } from '@/lib/db'
import { currentMonthPeriod, formatDate, today } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import {
  roomBoard,
  ROOM_STATE_CLASS,
  ROOM_STATE_LABEL,
  type RoomCard,
  type RoomState,
} from '@/lib/reporting/rooms'
import { PageHeader, StatCard, StatGrid, EmptyState } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Sparkles,
  UserRound,
  Wrench,
} from 'lucide-react'

export const metadata = { title: 'Rooms' }

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; state?: string }>
}) {
  const actor = await requirePermission('units:read')
  const params = await searchParams
  const period = currentMonthPeriod()

  const [rooms, properties] = await Promise.all([
    roomBoard({
      actor,
      propertyId: params.property,
      from: period.start,
      to: period.end,
    }),
    db.property.findMany({
      where: { active: true, ...propertyWhere(actor) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const lettable = rooms.filter((r) => !r.isAmenity)
  const stateFilter = params.state?.toUpperCase()
  const filtered = stateFilter ? rooms.filter((r) => r.state === stateFilter) : rooms

  const counts = {
    occupied: lettable.filter((r) => r.state === 'OCCUPIED').length,
    free: lettable.filter((r) => r.state === 'FREE').length,
    held: lettable.filter((r) => r.state === 'HELD').length,
    confirmed: lettable.filter((r) => r.state === 'CONFIRMED').length,
    blocked: lettable.filter((r) => r.state === 'BLOCKED').length,
  }

  const monthRevenue = lettable.reduce((s, r) => s + r.revenueMinor, 0)
  const avgOccupancy =
    lettable.length === 0
      ? 0
      : lettable.reduce((s, r) => s + r.occupancy, 0) / lettable.length

  return (
    <>
      <PageHeader
        title="Rooms"
        description={`${formatDate(today())} — every room, its state right now, and what it has earned this month. The rooftop is shared space and is left out of the figures.`}
        actions={
          <Button asChild size="sm">
            <Link href="/admin/calendar">
              <CalendarDays className="mr-1.5 size-4" />
              Full calendar
            </Link>
          </Button>
        }
      />

      <StatGrid>
        <StatCard
          label="Occupied now"
          value={`${counts.occupied} of ${lettable.length}`}
          sublabel={`${counts.free} empty, ${counts.blocked} blocked`}
          tone={counts.free > counts.occupied ? 'warning' : 'positive'}
        />
        <StatCard
          label="Earned this month"
          value={formatMinor(monthRevenue, 'GHS')}
          sublabel="Across all rooms, accrued"
        />
        <StatCard
          label="Average occupancy"
          value={`${Math.round(avgOccupancy * 100)}%`}
          sublabel="This month, lettable rooms"
        />
        <StatCard
          label="Awaiting confirmation"
          value={String(counts.held)}
          sublabel={`${counts.confirmed} confirmed and arriving`}
          tone={counts.held > 0 ? 'warning' : 'default'}
        />
      </StatGrid>

      {/* Filters: property, then state. Both are links so the board is
          shareable and survives a refresh. */}
      <div className="mt-7 flex flex-wrap items-center gap-2">
        {properties.length > 1 && (
          <>
            <FilterChip href="/admin/rooms" active={!params.property}>
              All buildings
            </FilterChip>
            {properties.map((p) => (
              <FilterChip
                key={p.id}
                href={`/admin/rooms?property=${p.id}`}
                active={params.property === p.id}
              >
                {p.name}
              </FilterChip>
            ))}
            <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          </>
        )}

        <FilterChip
          href={params.property ? `/admin/rooms?property=${params.property}` : '/admin/rooms'}
          active={!stateFilter}
        >
          Every state
        </FilterChip>
        {(['OCCUPIED', 'FREE', 'CONFIRMED', 'HELD', 'BLOCKED'] as RoomState[]).map((s) => (
          <FilterChip
            key={s}
            href={`/admin/rooms?${params.property ? `property=${params.property}&` : ''}state=${s.toLowerCase()}`}
            active={stateFilter === s}
            dotClass={ROOM_STATE_CLASS[s]}
          >
            {ROOM_STATE_LABEL[s]}
          </FilterChip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No rooms match"
            description="Clear the filter to see the whole building."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/rooms">Show every room</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
          {filtered.map((room) => (
            <RoomTile key={room.id} room={room} />
          ))}
        </div>
      )}
    </>
  )
}

function FilterChip({
  href,
  active,
  children,
  dotClass,
}: {
  href: string
  active: boolean
  children: React.ReactNode
  dotClass?: string
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-card text-foreground/70 ring-1 ring-border hover:bg-secondary hover:text-foreground'
      )}
    >
      {dotClass && (
        <span className={cn('size-2 rounded-full', dotClass)} aria-hidden="true" />
      )}
      {children}
    </Link>
  )
}

function RoomTile({ room }: { room: RoomCard }) {
  const isAmenity = room.state === 'AMENITY'

  return (
    <Link
      href={`/admin/rooms/${room.id}`}
      className="lift group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <div className="relative aspect-[16/10] bg-secondary">
        {room.images[0] ? (
          <Image
            src={room.images[0]}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 300px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <BedDouble className="size-7" />
          </div>
        )}

        {/* State badge. Colour plus words, always. */}
        <span
          className={cn(
            'absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-sm',
            ROOM_STATE_CLASS[room.state]
          )}
        >
          {room.state === 'OCCUPIED' && (
            <span className="size-1.5 rounded-full bg-current animate-live" aria-hidden="true" />
          )}
          {ROOM_STATE_LABEL[room.state]}
        </span>

        {(room.openTickets > 0 || room.housekeepingDue > 0) && (
          <div className="absolute right-3 top-3 flex gap-1.5">
            {room.housekeepingDue > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-[var(--gold)] px-2 py-1 text-[11px] font-semibold text-[var(--gold-foreground)] shadow-sm"
                title={`${room.housekeepingDue} housekeeping task${room.housekeepingDue === 1 ? '' : 's'} due`}
              >
                <Sparkles className="size-3" />
                {room.housekeepingDue}
              </span>
            )}
            {room.openTickets > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-1 text-[11px] font-semibold text-white shadow-sm"
                title={`${room.openTickets} open maintenance ticket${room.openTickets === 1 ? '' : 's'}`}
              >
                <Wrench className="size-3" />
                {room.openTickets}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold tracking-tight">{room.name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {room.typeLabel}
            {!isAmenity && ` · sleeps ${room.maxGuests}`}
          </p>
        </div>

        {isAmenity ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Shared by every guest. Not let separately, so it carries no rate and
            no occupancy.
          </p>
        ) : (
          <>
            <div className="min-h-[2.5rem] text-[13px]">
              {room.occupantName ? (
                <p className="flex items-start gap-1.5">
                  <UserRound className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="font-medium">{room.occupantName}</span>
                    {room.until && (
                      <span className="block text-xs text-muted-foreground">
                        {room.occupantKind === 'tenant' ? 'Lease ends' : 'Leaves'}{' '}
                        {formatDate(room.until)}
                      </span>
                    )}
                  </span>
                </p>
              ) : room.nextArrival ? (
                <p className="text-xs text-muted-foreground">
                  Next in:{' '}
                  <span className="font-medium text-foreground">
                    {room.nextArrival.guestName}
                  </span>
                  <span className="block">{formatDate(room.nextArrival.date)}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Nothing booked ahead.</p>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  This month
                </dt>
                <dd className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                  {formatMinor(room.revenueMinor, 'GHS')}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Occupancy
                </dt>
                <dd className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                  {Math.round(room.occupancy * 100)}%
                </dd>
              </div>
            </dl>

            {/* Occupancy as a bar, so a row of rooms can be compared without
                reading a single number. */}
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
              role="img"
              aria-label={`${Math.round(room.occupancy * 100)} percent occupied this month`}
            >
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${Math.min(100, Math.round(room.occupancy * 100))}%` }}
              />
            </div>
          </>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="truncate text-[11px] text-muted-foreground">
            {room.managerName ? `Managed by ${room.managerName}` : 'No manager assigned'}
          </span>
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  )
}
