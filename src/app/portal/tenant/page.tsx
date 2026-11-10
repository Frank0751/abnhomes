/**
 * The tenant's view of their own tenancy.
 *
 * One question above all others: what do I owe, and by when. Everything else
 * is secondary and sits below it.
 */

import { requireParty } from '@/lib/session'
import { db } from '@/lib/db'
import { partyStatement, partyBalanceIn, unappliedCredit } from '@/lib/core/ledger'
import { formatDate } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import { Money, Panel, Pill, StatusPill, TableScroll } from '@/components/admin/ui'
import { ReportFaultDialog } from './report-fault'
import { PayNowButton } from './pay-now'

export default async function TenantPortal() {
  const { partyId } = await requireParty()

  const [party, leases, balanceGhsMinor, balanceUsdMinor, tickets, stays] = await Promise.all([
    db.party.findUniqueOrThrow({ where: { id: partyId } }),
    db.lease.findMany({
      where: { tenantPartyId: partyId, status: { in: ['ACTIVE', 'DRAFT'] } },
      include: {
        unit: { include: { property: { select: { id: true, name: true, addressLine: true } } } },
        recurringCharges: { where: { active: true } },
      },
    }),
    partyBalanceIn(partyId, 'GHS'),
    partyBalanceIn(partyId, 'USD'),
    db.ticket.findMany({
      where: { reporterPartyId: partyId },
      include: { unit: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.reservation.findMany({
      where: {
        guestPartyId: partyId,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      },
      include: {
        unit: { include: { property: { select: { id: true, name: true, addressLine: true } } } },
      },
      orderBy: { checkIn: 'desc' },
    }),
  ])

  const lease = leases[0]

  // Long-let tenants are billed in GHS; short-stay guests in the currency of
  // their stay. Show whichever account actually has activity on it.
  const displayCurrency =
    balanceGhsMinor === 0 && balanceUsdMinor !== 0 ? ('USD' as const) : ('GHS' as const)
  const balanceMinor = displayCurrency === 'USD' ? balanceUsdMinor : balanceGhsMinor
  const creditMinor = await unappliedCredit(partyId, displayCurrency)
  const owes = balanceMinor > 0

  const statement = await partyStatement(partyId, { currency: displayCurrency })

  const openCharges = await db.charge.findMany({
    where: { partyId, status: { in: ['OPEN', 'PART_PAID'] }, currency: displayCurrency },
    include: { allocations: true },
    orderBy: { dueDate: 'asc' },
  })

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-3xl tracking-tight">
          Hello, {party.name.split(' ')[0]}
        </h1>
        {lease && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            {lease.unit.name} · {lease.unit.property.name}
          </p>
        )}
      </header>

      {/* The headline. Deliberately the largest thing on the page. */}
      <div
        className={`mb-8 rounded border px-6 py-7 ${
          owes ? 'border-amber-300 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/60'
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {owes ? 'You owe' : 'Your account'}
        </p>
        <p className="mt-1 font-serif text-4xl tracking-tight tabular-nums">
          {formatMinor(Math.abs(balanceMinor), displayCurrency)}
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {owes
            ? openCharges[0]
              ? `Oldest charge was due ${formatDate(openCharges[0].dueDate)}.`
              : 'Due now.'
            : creditMinor > 0
              ? `You are paid ahead. ${formatMinor(creditMinor, displayCurrency)} is held on your account and will cover future rent as it falls due.`
              : 'Nothing outstanding. Thank you.'}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {owes && (
            <PayNowButton
              amountMinor={balanceMinor}
              currency={displayCurrency}
              propertyId={lease?.unit.property.id ?? openCharges[0]?.propertyId ?? ''}
            />
          )}
          {lease && (
            <ReportFaultDialog
              propertyId={lease.unit.propertyId}
              unitId={lease.unitId}
              unitName={lease.unit.name}
            />
          )}
        </div>
      </div>

      {stays.length > 0 && (
        <Panel
          className="mb-6"
          title="Your stays"
          description="Your bookings with us, from confirmation through to checkout."
        >
          <ul className="divide-y divide-black/6">
            {stays.map((stay) => (
              <li key={stay.id} className="px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {stay.unit.name} · {stay.unit.property.name}
                  </p>
                  <StatusPill status={stay.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(stay.checkIn)} to {formatDate(stay.checkOut)} · {stay.nights}{' '}
                  night{stay.nights === 1 ? '' : 's'} · {stay.adults} guest
                  {stay.adults === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stay.unit.property.addressLine} · booking reference {stay.code}
                </p>
                <p className="mt-1.5 text-sm">
                  Total{' '}
                  <Money minor={stay.totalMinor} currency={stay.currency} className="tabular-nums" />
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {openCharges.length > 0 && (
        <Panel className="mb-6" title="What this is for">
          <ul className="divide-y divide-black/6">
            {openCharges.map((charge) => {
              const paid = charge.allocations.reduce((s, a) => s + a.amountMinor, 0)
              const outstanding = charge.amountMinor - paid

              return (
                <li key={charge.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm">{charge.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(charge.dueDate)}
                      {paid > 0 && ` · ${formatMinor(paid, charge.currency)} already paid`}
                    </p>
                  </div>
                  <Money minor={outstanding} currency={charge.currency} className="text-sm" />
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      {lease && (
        <Panel className="mb-6" title="Your tenancy">
          <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-3">
            <Field label="Unit" value={lease.unit.name} />
            <Field label="Address" value={lease.unit.property.addressLine} />
            <Field label="Rent" value={formatMinor(lease.rentMinor, lease.currency)} />
            <Field label="Due each month on" value={`Day ${lease.dueDay}`} />
            <Field label="Started" value={formatDate(lease.startDate)} />
            <Field label="Ends" value={formatDate(lease.endDate)} />
            {lease.depositMinor > 0 && (
              <Field
                label="Deposit held"
                value={formatMinor(lease.depositMinor, lease.currency)}
              />
            )}
            {lease.recurringCharges.map((charge) => (
              <Field
                key={charge.id}
                label={charge.label}
                value={`${formatMinor(charge.amountMinor, charge.currency)} monthly`}
              />
            ))}
          </dl>
        </Panel>
      )}

      <Panel
        className="mb-6"
        title="Your statement"
        description="Every charge and payment on your account."
      >
        <TableScroll>
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                <th className="px-4 py-2.5 text-left font-semibold">Description</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6">
              {[...statement].reverse().map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatDate(line.occurredAt)}
                  </td>
                  <td className="px-4 py-2.5">{line.description}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {line.direction === 'CREDIT' ? '−' : ''}
                    {formatMinor(line.amountMinor, line.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Money minor={line.runningBalanceMinor} currency={line.currency} />
                  </td>
                </tr>
              ))}
              {statement.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Nothing on your account yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Panel>

      {tickets.length > 0 && (
        <Panel title="Your maintenance reports">
          <ul className="divide-y divide-black/6">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">{ticket.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.code} · reported {formatDate(ticket.createdAt)}
                    {ticket.unit && ` · ${ticket.unit.name}`}
                  </p>
                </div>
                <StatusPill status={ticket.status} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!lease && stays.length === 0 && (
        <Panel title="No active tenancy">
          <p className="px-4 py-6 text-sm text-muted-foreground">
            We do not have an active lease against your account. If that seems wrong, call the
            office on{' '}
            <a href="tel:+233541704048" className="underline underline-offset-2">
              054 170 4048
            </a>
            .
          </p>
        </Panel>
      )}
    </>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  )
}
