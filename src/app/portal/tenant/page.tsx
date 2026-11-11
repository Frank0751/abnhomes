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
import { Money, Panel, StatusPill, EmptyState } from '@/components/admin/ui'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Hash,
  Home,
  MapPin,
  MessageCircle,
  Users,
  Wrench,
} from 'lucide-react'
import { ReportFaultDialog } from './report-fault'
import { PayNowButton } from './pay-now'

const DAY = 24 * 60 * 60 * 1000

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

  const balanceSubline = owes
    ? openCharges[0]
      ? `Oldest charge was due ${formatDate(openCharges[0].dueDate)}.`
      : 'Due now.'
    : creditMinor > 0
      ? `You are paid ahead. ${formatMinor(creditMinor, displayCurrency)} is held on your account and will cover future rent as it falls due.`
      : 'Nothing outstanding. Thank you.'

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">
          Hello, {party.name.split(' ')[0]}
        </h1>
        {lease ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Home className="size-3.5 shrink-0" aria-hidden />
            {lease.unit.name} · {lease.unit.property.name}
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">
            Everything about your stay or tenancy, in one place.
          </p>
        )}
      </header>

      {/* The headline. Deliberately the largest thing on the page. */}
      <div
        className="shadow-lifted relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a0e1a] via-[#101c2b] to-[#134e4a] px-6 py-7 text-white sm:px-8 sm:py-9"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-[#14b8a6]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-12 size-56 rounded-full bg-[#14b8a6]/10 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            {owes ? (
              <AlertCircle className="size-4 text-amber-300" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-300" aria-hidden />
            )}
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {owes ? 'You owe' : 'Your account'}
            </p>
          </div>
          <p className="mt-2 font-serif text-5xl tracking-tight tabular-nums sm:text-6xl">
            {formatMinor(Math.abs(balanceMinor), displayCurrency)}
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">{balanceSubline}</p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            {owes && (
              <PayNowButton
                amountMinor={balanceMinor}
                currency={displayCurrency}
                propertyId={lease?.unit.property.id ?? openCharges[0]?.propertyId ?? ''}
                className="w-full bg-white text-[#0a0e1a] hover:bg-[#e7f1ef] sm:w-auto"
              />
            )}
            {lease && (
              <ReportFaultDialog
                propertyId={lease.unit.propertyId}
                unitId={lease.unitId}
                unitName={lease.unit.name}
                triggerClassName="w-full border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto"
              />
            )}
          </div>
        </div>
      </div>

      {stays.length > 0 && (
        <Panel
          className="mb-6"
          title="Your stays"
          description="Your bookings with us, from confirmation through to checkout."
        >
          <ul className="divide-y divide-black/[0.06]">
            {stays.map((stay) => (
              <li key={stay.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[15px] font-medium">
                      <Home className="size-4 shrink-0 text-[#0d9488]" aria-hidden />
                      <span className="truncate">{stay.unit.name}</span>
                    </p>
                    <p className="mt-0.5 pl-6 text-xs text-muted-foreground">
                      {stay.unit.property.name}
                    </p>
                  </div>
                  <StatusPill status={stay.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-[13px] text-foreground/80">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden />
                    {formatDate(stay.checkIn)} to {formatDate(stay.checkOut)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5 text-muted-foreground" aria-hidden />
                    {stay.nights} night{stay.nights === 1 ? '' : 's'} · {stay.adults} guest
                    {stay.adults === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5 pl-6">
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>
                      {stay.unit.property.addressLine} ·{' '}
                      <span className="inline-flex items-center gap-1">
                        <Hash className="size-3" aria-hidden />
                        {stay.code}
                      </span>
                    </span>
                  </p>
                  <p className="text-sm">
                    Total{' '}
                    <Money
                      minor={stay.totalMinor}
                      currency={stay.currency}
                      className="font-medium tabular-nums"
                    />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {openCharges.length > 0 && (
        <Panel className="mb-6" title="What this is for">
          <ul className="divide-y divide-black/[0.06]">
            {openCharges.map((charge) => {
              const paid = charge.allocations.reduce((s, a) => s + a.amountMinor, 0)
              const outstanding = charge.amountMinor - paid
              const dueSoon =
                charge.dueDate != null &&
                new Date(charge.dueDate).getTime() - Date.now() < 7 * DAY

              return (
                <li key={charge.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm">{charge.description}</p>
                    <p
                      className={`mt-0.5 text-xs ${dueSoon ? 'font-medium text-amber-700' : 'text-muted-foreground'}`}
                    >
                      {dueSoon ? 'Due soon — ' : 'Due '}
                      {formatDate(charge.dueDate)}
                      {paid > 0 && ` · ${formatMinor(paid, charge.currency)} already paid`}
                    </p>
                  </div>
                  <Money
                    minor={outstanding}
                    currency={charge.currency}
                    className={`text-sm font-medium ${dueSoon ? 'text-amber-800' : ''}`}
                  />
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      {lease && (
        <Panel className="mb-6" title="Your tenancy">
          <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-3">
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
        <ul className="divide-y divide-black/[0.06] sm:hidden">
          {/* Mobile: stacked lines read better than a squeezed table. */}
          {[...statement].reverse().map((line) => (
            <li key={line.id} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm">{line.description}</p>
                <span
                  className={`shrink-0 text-sm tabular-nums ${
                    line.direction === 'CREDIT' ? 'text-emerald-700' : ''
                  }`}
                >
                  {line.direction === 'CREDIT' ? '−' : ''}
                  {formatMinor(line.amountMinor, line.currency)}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                <span>{formatDate(line.occurredAt)}</span>
                <span>
                  Balance{' '}
                  <Money
                    minor={line.runningBalanceMinor}
                    currency={line.currency}
                    className="tabular-nums"
                  />
                </span>
              </div>
            </li>
          ))}
          {statement.length === 0 && (
            <li className="px-5 py-8 text-center text-muted-foreground">
              Nothing on your account yet.
            </li>
          )}
        </ul>

        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.08] text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-semibold">Date</th>
                <th className="px-5 py-2.5 text-left font-semibold">Description</th>
                <th className="px-5 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-5 py-2.5 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {[...statement].reverse().map((line) => (
                <tr key={line.id} className="transition-colors hover:bg-black/[0.015]">
                  <td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">
                    {formatDate(line.occurredAt)}
                  </td>
                  <td className="px-5 py-2.5">{line.description}</td>
                  <td
                    className={`px-5 py-2.5 text-right tabular-nums ${
                      line.direction === 'CREDIT' ? 'text-emerald-700' : ''
                    }`}
                  >
                    {line.direction === 'CREDIT' ? '−' : ''}
                    {formatMinor(line.amountMinor, line.currency)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <Money minor={line.runningBalanceMinor} currency={line.currency} />
                  </td>
                </tr>
              ))}
              {statement.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                    Nothing on your account yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {tickets.length > 0 && (
        <Panel className="mb-6" title="Your maintenance reports">
          <ul className="divide-y divide-black/[0.06]">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Wrench className="mt-0.5 size-4 shrink-0 text-[#0d9488]" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm">{ticket.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ticket.code} · reported {formatDate(ticket.createdAt)}
                      {ticket.unit && ` · ${ticket.unit.name}`}
                    </p>
                  </div>
                </div>
                <StatusPill status={ticket.status} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!lease && stays.length === 0 && (
        <Panel title="No active tenancy">
          <EmptyState
            title="Nothing on your account yet"
            description="We do not have an active lease or stay against your account. If that seems wrong, our office is one call or message away."
            action={
              <a
                href="https://wa.me/233541704048"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#0a0e1a] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1a1f2e]"
              >
                <MessageCircle className="size-4" aria-hidden />
                Message the office on WhatsApp
              </a>
            }
          />
        </Panel>
      )}
    </>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[#faf8f3] px-3.5 py-3 ring-1 ring-black/[0.04]">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  )
}
