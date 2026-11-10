import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/session'
import { hasPropertyAccess } from '@/lib/rbac'
import { db } from '@/lib/db'
import { partyStatement } from '@/lib/core/ledger'
import { formatDate, formatDateTime } from '@/lib/core/dates'
import { formatPhone } from '@/lib/core/phone'
import {
  Money,
  PageHeader,
  Panel,
  Pill,
  StatusPill,
  TableScroll,
} from '@/components/admin/ui'
import { BookingActions } from './booking-actions'
import { PortalAccessCard } from './portal-access-card'
import { ArrowLeft } from 'lucide-react'

export default async function BookingDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await requirePermission('bookings:read')
  const { id } = await params

  const reservation = await db.reservation.findUnique({
    where: { id },
    include: {
      guest: true,
      unit: { include: { property: true } },
      chargeRows: { include: { allocations: true }, orderBy: { dueDate: 'asc' } },
      tasks: true,
    },
  })

  if (!reservation) notFound()
  if (!hasPropertyAccess(actor, reservation.unit.propertyId)) notFound()

  const statement = await partyStatement(reservation.guestPartyId, {
    currency: reservation.currency,
  })
  const balanceMinor = statement.at(-1)?.runningBalanceMinor ?? 0

  const totalCharged = reservation.chargeRows
    .filter((c) => c.status !== 'REVERSED' && c.status !== 'WAIVED')
    .reduce((s, c) => s + c.amountMinor, 0)
  const totalPaid = reservation.chargeRows.reduce(
    (s, c) => s + c.allocations.reduce((a, x) => a + x.amountMinor, 0),
    0
  )
  const outstanding = totalCharged - totalPaid

  return (
    <>
      <Link
        href="/admin/bookings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All bookings
      </Link>

      <PageHeader
        title={reservation.guest.name}
        description={`${reservation.code} · ${reservation.unit.name} · ${reservation.unit.property.name}`}
        actions={<StatusPill status={reservation.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel title="Stay">
            <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-3">
              <Field label="Arrives" value={formatDate(reservation.checkIn)} />
              <Field label="Leaves" value={formatDate(reservation.checkOut)} />
              <Field
                label="Nights"
                value={String(reservation.nights)}
              />
              <Field
                label="Guests"
                value={`${reservation.adults} adult${reservation.adults === 1 ? '' : 's'}${
                  reservation.children > 0 ? `, ${reservation.children} children` : ''
                }`}
              />
              <Field label="Source" value={reservation.source.replace(/_/g, ' ').toLowerCase()} />
              <Field
                label="Booked"
                value={formatDate(reservation.createdAt)}
              />
              {reservation.checkedInAt && (
                <Field label="Checked in" value={formatDateTime(reservation.checkedInAt)} />
              )}
              {reservation.checkedOutAt && (
                <Field label="Checked out" value={formatDateTime(reservation.checkedOutAt)} />
              )}
              {reservation.cancelledAt && (
                <Field
                  label="Cancelled"
                  value={`${formatDate(reservation.cancelledAt)} — ${reservation.cancelReason ?? ''}`}
                />
              )}
            </dl>

            {reservation.internalNotes && (
              <div className="border-t border-black/8 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Internal notes
                </p>
                <p className="mt-1 text-sm">{reservation.internalNotes}</p>
              </div>
            )}
          </Panel>

          <Panel title="Charges" description="Everything raised against this stay.">
            <TableScroll>
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Charge</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Due</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Paid</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {reservation.chargeRows.map((charge) => {
                    const paid = charge.allocations.reduce((s, a) => s + a.amountMinor, 0)
                    return (
                      <tr key={charge.id}>
                        <td className="px-4 py-2.5">{charge.description}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {formatDate(charge.dueDate)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Money minor={charge.amountMinor} currency={charge.currency} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Money minor={paid} currency={charge.currency} />
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill status={charge.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-black/8 font-medium">
                    <td className="px-4 py-2.5" colSpan={2}>
                      Outstanding on this stay
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Money minor={totalCharged} currency={reservation.currency} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Money minor={totalPaid} currency={reservation.currency} />
                    </td>
                    <td className="px-4 py-2.5">
                      {outstanding > 0 ? (
                        <Pill tone="warning">
                          <Money minor={outstanding} currency={reservation.currency} /> due
                        </Pill>
                      ) : (
                        <Pill tone="positive">Settled</Pill>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </TableScroll>
          </Panel>

          <Panel
            title="Guest account"
            description="Across every stay, not just this one. A negative balance is credit held."
          >
            <TableScroll>
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Entry</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {statement.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {formatDate(line.occurredAt)}
                      </td>
                      <td className="px-4 py-2.5">{line.description}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="tabular-nums">
                          {line.direction === 'CREDIT' ? '−' : ''}
                          <Money minor={line.amountMinor} currency={line.currency} />
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Money minor={line.runningBalanceMinor} currency={line.currency} />
                      </td>
                    </tr>
                  ))}
                  {statement.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No account activity yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableScroll>
          </Panel>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Guest">
            <dl className="space-y-3 p-4 text-sm">
              <Field label="Name" value={reservation.guest.name} />
              {reservation.guest.phone && (
                <Field
                  label="Phone"
                  value={
                    <a
                      href={`tel:${reservation.guest.phone}`}
                      className="underline underline-offset-2"
                    >
                      {formatPhone(reservation.guest.phone)}
                    </a>
                  }
                />
              )}
              {reservation.guest.email && (
                <Field label="Email" value={reservation.guest.email} />
              )}
              {reservation.guest.nationality && (
                <Field label="Nationality" value={reservation.guest.nationality} />
              )}
              <Field
                label="Account balance"
                value={<Money minor={balanceMinor} currency={reservation.currency} />}
              />
            </dl>
          </Panel>

          <PortalAccessCard
            reservationId={reservation.id}
            status={reservation.status}
            portalCode={reservation.portalCode}
          />

          <BookingActions
            reservationId={reservation.id}
            status={reservation.status}
            currency={reservation.currency}
            outstandingMinor={outstanding}
          />
        </aside>
      </div>
    </>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm capitalize-first">{value}</dd>
    </div>
  )
}
