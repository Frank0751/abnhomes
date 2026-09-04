/**
 * The contractor's view.
 *
 * A vendor sees the jobs assigned to them and nothing else — not the tenant's
 * balance, not the other buildings, not what anyone pays. Scope here is
 * enforced by the query, which only ever matches their own party id.
 */

import { requireParty } from '@/lib/session'
import { db } from '@/lib/db'
import { formatDate, formatDateTime } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import {
  EmptyState,
  Money,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  StatusPill,
  humanise,
} from '@/components/admin/ui'

export default async function VendorPortal() {
  const { partyId } = await requireParty()

  const [vendor, open, completed] = await Promise.all([
    db.party.findUniqueOrThrow({ where: { id: partyId } }),
    db.ticket.findMany({
      where: {
        vendorPartyId: partyId,
        status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] },
      },
      include: {
        property: { select: { name: true, addressLine: true, city: true } },
        unit: { select: { name: true } },
      },
      orderBy: [{ priority: 'desc' }, { slaDueAt: 'asc' }],
    }),
    db.ticket.findMany({
      where: { vendorPartyId: partyId, status: { in: ['RESOLVED', 'CLOSED'] } },
      include: { property: { select: { name: true } }, unit: { select: { name: true } } },
      orderBy: { resolvedAt: 'desc' },
      take: 20,
    }),
  ])

  const totalEarned = completed.reduce((s, t) => s + (t.costMinor ?? 0), 0)

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-3xl tracking-tight">{vendor.name}</h1>
        {vendor.vendorTrade && (
          <p className="mt-1.5 text-sm text-muted-foreground">{vendor.vendorTrade}</p>
        )}
      </header>

      <StatGrid>
        <StatCard
          label="Jobs in hand"
          value={String(open.length)}
          tone={open.length > 0 ? 'warning' : 'positive'}
        />
        <StatCard
          label="Urgent"
          value={String(open.filter((t) => ['EMERGENCY', 'HIGH'].includes(t.priority)).length)}
          tone={open.some((t) => t.priority === 'EMERGENCY') ? 'critical' : 'default'}
        />
        <StatCard label="Completed" value={String(completed.length)} sublabel="Last 20 shown" />
        <StatCard
          label="Invoiced"
          value={formatMinor(totalEarned, 'GHS')}
          sublabel="Across completed jobs"
        />
      </StatGrid>

      <Panel className="mt-8" title="Jobs assigned to you">
        {open.length === 0 ? (
          <EmptyState
            title="Nothing outstanding"
            description="New jobs will appear here as soon as ABN assigns them to you."
          />
        ) : (
          <ul className="divide-y divide-black/6">
            {open.map((ticket) => {
              const overdue = ticket.slaDueAt && ticket.slaDueAt < new Date()

              return (
                <li key={ticket.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ticket.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ticket.unit?.name ? `${ticket.unit.name} · ` : ''}
                        {ticket.property.name} — {ticket.property.addressLine},{' '}
                        {ticket.property.city}
                      </p>
                      <p className="mt-2 text-sm text-foreground/80">{ticket.description}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">{ticket.code}</span>
                        <span>· {humanise(ticket.category)}</span>
                        <span>· reported {formatDate(ticket.createdAt)}</span>
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusPill status={ticket.priority} />
                      <StatusPill status={ticket.status} />
                      {ticket.slaDueAt &&
                        (overdue ? (
                          <Pill tone="critical">Past target</Pill>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            By {formatDateTime(ticket.slaDueAt)}
                          </span>
                        ))}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {completed.length > 0 && (
        <Panel className="mt-6" title="Completed">
          <ul className="divide-y divide-black/6">
            {completed.map((ticket) => (
              <li key={ticket.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">{ticket.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.unit?.name ?? ticket.property.name} ·{' '}
                    {ticket.resolvedAt ? formatDate(ticket.resolvedAt) : '—'}
                  </p>
                </div>
                {ticket.costMinor ? (
                  <Money minor={ticket.costMinor} currency={ticket.currency} className="text-sm" />
                ) : (
                  <span className="text-xs text-muted-foreground">No charge</span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Questions about a job? Call ABN Homes on{' '}
        <a href="tel:+233541704048" className="underline underline-offset-2">
          054 170 4048
        </a>
        .
      </p>
    </>
  )
}
