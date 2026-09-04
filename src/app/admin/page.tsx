/**
 * The morning screen.
 *
 * ABN runs two businesses out of one portfolio, so the overview refuses to
 * pick a side: nightly operations on the left, tenancies and collections on
 * the right, and anything actually demanding attention pushed to the top.
 */

import Link from 'next/link'
import { requireActor } from '@/lib/session'
import { propertyWhere } from '@/lib/rbac'
import { db } from '@/lib/db'
import { currentMonthPeriod, formatDate, today } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import { dayBook } from '@/lib/short-stay/reservations'
import { occupancyRate } from '@/lib/short-stay/availability'
import { averageDailyRate, revPar } from '@/lib/short-stay/pricing'
import { arrearsReport, collectionRate } from '@/lib/reporting/arrears'
import { breachedTickets } from '@/lib/operations/tickets'
import {
  EmptyState,
  Money,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  StatusPill,
} from '@/components/admin/ui'
import { ArrowRight, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function AdminOverview() {
  const actor = await requireActor()
  const period = currentMonthPeriod()
  const now = today()

  const [
    book,
    occupancy,
    adr,
    arrears,
    collection,
    breached,
    housekeepingDue,
    openTickets,
    pendingPayments,
    staleFeeds,
    monthPayments,
  ] = await Promise.all([
    dayBook(now),
    occupancyRate({ from: period.start, to: period.end }),
    averageDailyRate({ from: period.start, to: period.end, currency: 'USD' }),
    arrearsReport({ actor, currency: 'GHS' }),
    collectionRate({ actor, from: period.start, to: period.end, currency: 'GHS' }),
    breachedTickets(actor),
    db.housekeepingTask.count({ where: { status: 'PENDING', dueAt: { lte: new Date() } } }),
    db.ticket.count({
      where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] }, ...propertyWhere(actor) },
    }),
    // Cash captured on a device that has not yet been confirmed at the office.
    db.payment.count({ where: { syncState: 'PENDING', ...propertyWhere(actor) } }),
    db.icalFeed.count({ where: { active: true, lastError: { not: null } } }),
    db.payment.groupBy({
      by: ['currency'],
      where: {
        status: 'CONFIRMED',
        receivedAt: { gte: period.start, lt: period.end },
        ...propertyWhere(actor),
      },
      _sum: { amountMinor: true },
    }),
  ])

  const alerts = [
    breached.length > 0 && {
      href: '/admin/maintenance',
      text: `${breached.length} maintenance ticket${breached.length === 1 ? '' : 's'} past the response target`,
    },
    pendingPayments > 0 && {
      href: '/admin/money',
      text: `${pendingPayments} payment${pendingPayments === 1 ? '' : 's'} recorded offline and awaiting confirmation`,
    },
    staleFeeds > 0 && {
      href: '/admin/settings',
      text: `${staleFeeds} booking-site calendar feed${staleFeeds === 1 ? '' : 's'} failed to sync — double-booking risk`,
    },
    arrears.tenantsInArrears > 0 && {
      href: '/admin/arrears',
      text: `${arrears.tenantsInArrears} tenant${arrears.tenantsInArrears === 1 ? '' : 's'} in arrears, ${formatMinor(arrears.totalOutstandingMinor, 'GHS')} outstanding`,
    },
  ].filter(Boolean) as Array<{ href: string; text: string }>

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${formatDate(now)} — arrivals, collections and anything that needs a decision today.`}
      />

      {alerts.length > 0 && (
        <div className="mb-8 rounded border border-amber-200 bg-amber-50/70">
          <ul className="divide-y divide-amber-200/70">
            {alerts.map((alert) => (
              <li key={alert.href + alert.text}>
                <Link
                  href={alert.href}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-900 hover:bg-amber-100/60"
                >
                  <TriangleAlert className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">{alert.text}</span>
                  <ArrowRight className="size-3.5 shrink-0 opacity-60" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Short stay, this month
        </h2>
        <StatGrid>
          <StatCard
            label="Occupancy"
            value={`${Math.round(occupancy.rate * 100)}%`}
            sublabel={`${occupancy.nightsSold} of ${occupancy.nightsAvailable} nights sold`}
          />
          <StatCard
            label="Average nightly rate"
            value={formatMinor(adr.adrMinor, 'USD')}
            sublabel="Accommodation only, excluding fees"
          />
          <StatCard
            label="Revenue per available night"
            value={formatMinor(revPar(adr.adrMinor, occupancy.rate), 'USD')}
            sublabel="Occupancy and rate combined"
          />
          <StatCard
            label="In house tonight"
            value={String(book.inHouse.length + book.arrivals.length)}
            sublabel={`${book.arrivals.length} arriving, ${book.departures.length} leaving`}
          />
        </StatGrid>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Tenancies and collections
        </h2>
        <StatGrid>
          <StatCard
            label="Collection rate"
            value={`${Math.round(collection.rate * 100)}%`}
            sublabel={`${formatMinor(collection.collectedMinor, 'GHS')} of ${formatMinor(collection.chargedMinor, 'GHS')} due`}
            tone={collection.rate < 0.85 ? 'warning' : 'positive'}
          />
          <StatCard
            label="Outstanding"
            value={formatMinor(arrears.totalOutstandingMinor, 'GHS')}
            sublabel={`${arrears.tenantsInArrears} tenant${arrears.tenantsInArrears === 1 ? '' : 's'} behind`}
            tone={arrears.totalOutstandingMinor > 0 ? 'warning' : 'positive'}
          />
          <StatCard
            label="Over 90 days"
            value={formatMinor(arrears.totalsByBucket['90+'], 'GHS')}
            sublabel="The debt that rarely comes back"
            tone={arrears.totalsByBucket['90+'] > 0 ? 'critical' : 'default'}
          />
          {monthPayments.map((row) => (
            <StatCard
              key={row.currency}
              label={`Received this month (${row.currency})`}
              value={formatMinor(row._sum.amountMinor ?? 0, row.currency)}
              sublabel="All channels, confirmed only"
            />
          ))}
        </StatGrid>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Arriving today"
          description="Check the unit is ready before they land."
          actions={
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href="/admin/calendar">Calendar</Link>
            </Button>
          }
        >
          {book.arrivals.length === 0 ? (
            <EmptyState title="No arrivals today" />
          ) : (
            <ul className="divide-y divide-black/6">
              {book.arrivals.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/bookings/${r.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {r.guest.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.unit.name} · {r.nights} night{r.nights === 1 ? '' : 's'} · {r.code}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Money minor={r.totalMinor} currency={r.currency} className="text-sm" />
                    <StatusPill status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Leaving today"
          description="Each departure creates a changeover clean."
          actions={
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href="/admin/housekeeping">Housekeeping</Link>
            </Button>
          }
        >
          {book.departures.length === 0 ? (
            <EmptyState title="No departures today" />
          ) : (
            <ul className="divide-y divide-black/6">
              {book.departures.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/bookings/${r.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {r.guest.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{r.unit.name}</p>
                  </div>
                  <StatusPill status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Work in hand">
          <dl className="divide-y divide-black/6">
            <Row label="Open maintenance tickets" value={String(openTickets)} href="/admin/maintenance" />
            <Row label="Housekeeping tasks due" value={String(housekeepingDue)} href="/admin/housekeeping" />
            <Row
              label="Payments awaiting confirmation"
              value={String(pendingPayments)}
              href="/admin/money"
              tone={pendingPayments > 0 ? 'warning' : undefined}
            />
          </dl>
        </Panel>

        <Panel title="Staying over" description="Guests already in house tonight.">
          {book.inHouse.length === 0 ? (
            <EmptyState title="Nobody in house" />
          ) : (
            <ul className="divide-y divide-black/6">
              {book.inHouse.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.guest.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.unit.name} · leaves {formatDate(r.checkOut)}
                    </p>
                  </div>
                  <Pill tone="positive">In house</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

function Row({
  label,
  value,
  href,
  tone,
}: {
  label: string
  value: string
  href: string
  tone?: 'warning'
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-sm">
        <Link href={href} className="hover:underline">
          {label}
        </Link>
      </dt>
      <dd
        className={`text-sm font-medium tabular-nums ${tone === 'warning' ? 'text-amber-700' : ''}`}
      >
        {value}
      </dd>
    </div>
  )
}
