import Link from 'next/link'
import { requirePermission } from '@/lib/session'
import { unitScopeWhere } from '@/lib/rbac'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/core/dates'
import {
  EmptyState,
  Money,
  PageHeader,
  Panel,
  StatusPill,
  TableScroll,
} from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShareBookingLinkButton } from './share-link-button'
import type { ReservationStatus } from '@prisma/client'

const FILTERS: Array<{ key: string; label: string; statuses?: ReservationStatus[] }> = [
  { key: 'upcoming', label: 'Upcoming', statuses: ['PENDING', 'CONFIRMED'] },
  { key: 'inhouse', label: 'In house', statuses: ['CHECKED_IN'] },
  { key: 'past', label: 'Past', statuses: ['CHECKED_OUT'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED', 'NO_SHOW'] },
  { key: 'all', label: 'All' },
]

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const actor = await requirePermission('bookings:read')
  const { filter = 'upcoming' } = await searchParams
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]

  const reservations = await db.reservation.findMany({
    where: {
      ...(active.statuses ? { status: { in: active.statuses } } : {}),
      ...unitScopeWhere(actor),
    },
    include: {
      guest: { select: { name: true, phone: true } },
      unit: { select: { name: true, property: { select: { name: true } } } },
    },
    orderBy: active.key === 'past' ? { checkOut: 'desc' } : { checkIn: 'asc' },
    take: 200,
  })

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every stay, direct or imported, across the short-stay portfolio."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ShareBookingLinkButton />
            <Button asChild size="sm">
              <Link href="/admin/bookings/new">
                <Plus className="mr-1.5 size-4" />
                New booking
              </Link>
            </Button>
          </div>
        }
      />

      <nav className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/bookings?filter=${f.key}`}
            aria-current={f.key === active.key ? 'page' : undefined}
            className={cn(
              'rounded-sm px-2.5 py-1 text-[13px] transition-colors',
              f.key === active.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-white text-foreground/70 ring-1 ring-black/8 hover:bg-black/[0.03]'
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <Panel>
        {reservations.length === 0 ? (
          <EmptyState
            title="No bookings here"
            description={`Nothing matches "${active.label.toLowerCase()}" right now.`}
            action={
              <Button asChild size="sm">
                <Link href="/admin/bookings/new">Create a booking</Link>
              </Button>
            }
          />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Guest</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Unit</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Arrives</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Leaves</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Nights</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-black/[0.02]">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/bookings/${r.id}`}
                        className="font-medium hover:underline"
                      >
                        {r.guest.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{r.code}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.unit.name}
                      <span className="block text-xs text-muted-foreground">
                        {r.unit.property.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.checkIn)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.checkOut)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.nights}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Money minor={r.totalMinor} currency={r.currency} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </>
  )
}
