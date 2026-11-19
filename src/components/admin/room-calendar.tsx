/**
 * One room's calendar, as a month grid.
 *
 * Each room is run independently, so this shows exactly one room and answers
 * the four states the desk actually asks about: booked and in house, confirmed
 * and coming, held but not yet confirmed, and free.
 *
 * A stay occupies [check-in, check-out) — the departure morning is sellable
 * again — so a changeover day is drawn as a split cell rather than being
 * claimed by either stay. Getting that wrong loses a sellable night on every
 * single booking.
 */

import Link from 'next/link'
import { dateOnly, toISODate } from '@/lib/core/dates'
import type { CalendarDay } from '@/lib/short-stay/availability'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type DayState = 'free' | 'held' | 'confirmed' | 'occupied' | 'blocked' | 'past'

function stateFor(day: CalendarDay, todayIso: string): DayState {
  if (day.blockReason) return 'blocked'
  if (day.status === 'CHECKED_IN') return 'occupied'
  if (day.status === 'PENDING') return 'held'
  if (day.status === 'CONFIRMED') return 'confirmed'
  if (day.status === 'CHECKED_OUT') return 'past'
  return day.available ? 'free' : 'blocked'
}

const CELL_CLASS: Record<DayState, string> = {
  free: 'bg-card hover:bg-[var(--state-free-bg)] text-foreground',
  held: 'state-held font-semibold',
  confirmed: 'state-confirmed font-semibold',
  occupied: 'state-occupied font-semibold',
  blocked: 'state-blocked',
  past: 'bg-secondary text-muted-foreground',
}

const STATE_LABEL: Record<DayState, string> = {
  free: 'Not booked',
  held: 'Yet to confirm',
  confirmed: 'Confirmed',
  occupied: 'In house',
  blocked: 'Blocked',
  past: 'Past stay',
}

export function RoomCalendar({
  days,
  monthLabel,
  unitId,
  prevHref,
  nextHref,
  todayHref,
}: {
  days: CalendarDay[]
  monthLabel: string
  unitId: string
  prevHref: string
  nextHref: string
  todayHref: string
}) {
  const todayIso = toISODate(dateOnly(new Date()))

  // Pad the grid so the 1st lands under the right weekday. Monday-first,
  // which is how a Ghanaian working week is read.
  const first = days[0] ? new Date(`${days[0].date}T00:00:00Z`) : new Date()
  const leading = (first.getUTCDay() + 6) % 7

  const counts = days.reduce<Record<DayState, number>>(
    (acc, d) => {
      const s = stateFor(d, todayIso)
      acc[s] = (acc[s] ?? 0) + 1
      return acc
    },
    { free: 0, held: 0, confirmed: 0, occupied: 0, blocked: 0, past: 0 }
  )

  const sellable = days.length
  const taken = sellable - counts.free
  const pct = sellable === 0 ? 0 : Math.round((taken / sellable) * 100)

  return (
    <section className="rounded-xl border border-border bg-card shadow-soft">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">{monthLabel}</h2>
          <p className="text-xs text-muted-foreground">
            {taken} of {sellable} nights taken · {pct}% booked
          </p>
        </div>

        <nav className="flex items-center gap-1" aria-label="Change month">
          <CalNavLink href={prevHref} label="Previous month">
            ‹
          </CalNavLink>
          <Link
            href={todayHref}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-secondary"
          >
            Today
          </Link>
          <CalNavLink href={nextHref} label="Next month">
            ›
          </CalNavLink>
        </nav>
      </header>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}

          {Array.from({ length: leading }, (_, i) => (
            <div key={`pad-${i}`} aria-hidden="true" />
          ))}

          {days.map((day) => {
            const state = stateFor(day, todayIso)
            const dayNumber = Number(day.date.slice(-2))
            const isToday = day.date === todayIso

            const label = `${day.date} — ${STATE_LABEL[state]}${
              day.guestName ? `, ${day.guestName}` : ''
            }`

            const cell = (
              <div
                title={label}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded-lg border border-border/60 text-[13px] transition-colors',
                  CELL_CLASS[state],
                  isToday && 'ring-2 ring-[var(--accent)] ring-offset-1'
                )}
              >
                <span className="font-mono tabular-nums">{dayNumber}</span>

                {/* A changeover shows as a corner wedge: someone leaves in the
                    morning, someone else arrives the same afternoon. */}
                {day.isCheckIn && (
                  <span
                    className="absolute bottom-1 size-1.5 rounded-full bg-current opacity-70"
                    aria-hidden="true"
                  />
                )}

                <span className="sr-only">{STATE_LABEL[state]}</span>
              </div>
            )

            return day.reservationId ? (
              <Link
                key={day.date}
                href={`/admin/bookings/${day.reservationId}`}
                aria-label={label}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {cell}
              </Link>
            ) : state === 'free' ? (
              <Link
                key={day.date}
                href={`/admin/bookings/new?unitId=${unitId}&checkIn=${day.date}`}
                aria-label={`${label} — create a booking`}
                className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {cell}
              </Link>
            ) : (
              <div key={day.date}>{cell}</div>
            )
          })}
        </div>

        <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <Legend className="bg-card ring-1 ring-border" label="Not booked" count={counts.free} />
          <Legend className="state-held-solid" label="Yet to confirm" count={counts.held} />
          <Legend className="state-confirmed-solid" label="Confirmed" count={counts.confirmed} />
          <Legend className="state-occupied-solid" label="In house" count={counts.occupied} />
          <Legend className="state-blocked-solid" label="Blocked" count={counts.blocked} />
        </ul>
      </div>
    </section>
  )
}

function CalNavLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-md text-lg leading-none ring-1 ring-border transition-colors hover:bg-secondary"
    >
      {children}
    </Link>
  )
}

function Legend({
  className,
  label,
  count,
}: {
  className: string
  label: string
  count: number
}) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={cn('size-3 rounded-[3px]', className)} aria-hidden="true" />
      {label}
      {count > 0 && <span className="font-mono tabular-nums opacity-70">{count}</span>}
    </li>
  )
}
