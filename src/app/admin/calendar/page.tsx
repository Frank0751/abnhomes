/**
 * The availability grid.
 *
 * Units down, nights across. This is the screen the front desk lives in, so it
 * answers one question instantly: can I sell this unit on this night. Anything
 * that is not that question is a click away, not on the grid.
 */

import Link from 'next/link'
import { requirePermission } from '@/lib/session'
import { propertyWhere } from '@/lib/rbac'
import { db } from '@/lib/db'
import { BLOCKING_STATUSES } from '@/lib/short-stay/availability'
import { addDays, dateOnly, eachNight, formatMonthYear, toISODate, today } from '@/lib/core/dates'
import { PageHeader, Panel, Pill } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const WINDOW_NIGHTS = 30

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const actor = await requirePermission('bookings:read')
  const params = await searchParams

  const start = params.from ? dateOnly(params.from) : today()
  const end = addDays(start, WINDOW_NIGHTS)
  const nights = eachNight(start, end)

  const units = await db.unit.findMany({
    where: {
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      ...propertyWhere(actor),
    },
    include: {
      property: { select: { name: true } },
      reservations: {
        where: {
          status: { in: BLOCKING_STATUSES },
          checkIn: { lt: end },
          checkOut: { gt: start },
        },
        include: { guest: { select: { name: true } } },
      },
      blocks: {
        where: { startDate: { lt: end }, endDate: { gt: start } },
      },
    },
    orderBy: [{ property: { name: 'asc' } }, { code: 'asc' }],
  })

  const prev = toISODate(addDays(start, -WINDOW_NIGHTS))
  const next = toISODate(addDays(start, WINDOW_NIGHTS))

  return (
    <>
      <PageHeader
        title="Calendar"
        description={`${WINDOW_NIGHTS} nights from ${formatMonthYear(start)}. A stay ends on the morning of its last day, so changeover nights stay sellable.`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/calendar?from=${prev}`} aria-label="Previous 30 nights">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/calendar">Today</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/calendar?from=${next}`} aria-label="Next 30 nights">
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/bookings/new">
                <Plus className="mr-1.5 size-4" />
                New booking
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <LegendSwatch className="bg-white ring-1 ring-black/10" label="Available" />
        <LegendSwatch className="bg-emerald-500/85" label="In house" />
        <LegendSwatch className="bg-blue-500/80" label="Confirmed" />
        <LegendSwatch className="bg-amber-400/85" label="Held" />
        <LegendSwatch className="bg-neutral-400/70" label="Blocked or imported" />
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[190px] border-b border-r border-black/8 bg-white px-3 py-2 text-left font-semibold">
                  Unit
                </th>
                {nights.map((night) => {
                  const weekend = [0, 6].includes(night.getUTCDay())
                  return (
                    <th
                      key={toISODate(night)}
                      scope="col"
                      className={cn(
                        'w-9 border-b border-black/8 px-0 py-1.5 text-center font-medium',
                        weekend && 'bg-black/[0.03]'
                      )}
                    >
                      <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">
                        {night.toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' })}
                      </span>
                      <span className="block tabular-nums">{night.getUTCDate()}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-r border-black/8 bg-white px-3 py-2 text-left font-normal"
                  >
                    <Link
                      href={`/admin/portfolio/${unit.id}`}
                      className="block truncate text-[13px] font-medium hover:underline"
                    >
                      {unit.name}
                    </Link>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {unit.property.name}
                    </span>
                  </th>

                  {nights.map((night) => {
                    const reservation = unit.reservations.find(
                      (r) => dateOnly(r.checkIn) <= night && night < dateOnly(r.checkOut)
                    )
                    const block = unit.blocks.find(
                      (b) => dateOnly(b.startDate) <= night && night < dateOnly(b.endDate)
                    )

                    const isFirstNight =
                      reservation && dateOnly(reservation.checkIn).getTime() === night.getTime()

                    let tone = 'bg-white hover:bg-black/[0.04]'
                    let title = `${unit.name} — available on ${toISODate(night)}`

                    if (reservation) {
                      tone =
                        reservation.status === 'CHECKED_IN'
                          ? 'bg-emerald-500/85'
                          : reservation.status === 'PENDING'
                            ? 'bg-amber-400/85'
                            : reservation.status === 'CHECKED_OUT'
                              ? 'bg-neutral-300'
                              : 'bg-blue-500/80'
                      title = `${reservation.guest.name} — ${reservation.code} (${reservation.status.toLowerCase().replace('_', ' ')})`
                    } else if (block) {
                      tone = 'bg-neutral-400/70'
                      title = block.reason ?? 'Blocked'
                    }

                    const cell = (
                      <div
                        className={cn('h-9 w-9 border-b border-r border-black/6', tone)}
                        title={title}
                      >
                        {isFirstNight && (
                          <span className="sr-only">
                            {reservation.guest.name} arrives {toISODate(night)}
                          </span>
                        )}
                      </div>
                    )

                    return (
                      <td key={toISODate(night)} className="p-0">
                        {reservation ? (
                          <Link href={`/admin/bookings/${reservation.id}`}>{cell}</Link>
                        ) : block ? (
                          cell
                        ) : (
                          <Link
                            href={`/admin/bookings/new?unitId=${unit.id}&checkIn=${toISODate(night)}`}
                          >
                            {cell}
                          </Link>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {units.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No short-stay units are assigned to you.
          </p>
        )}
      </Panel>

      <p className="mt-4 text-xs text-muted-foreground">
        Grey blocks imported from Airbnb or Booking.com are read-only here — clear them at the
        source, then sync. Blocked dates you own can be managed from the unit page.
      </p>
    </>
  )
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block size-3 rounded-[2px]', className)} />
      {label}
    </span>
  )
}
