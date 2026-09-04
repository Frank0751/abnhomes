import { requirePermission } from '@/lib/session'
import { can } from '@/lib/rbac'
import { ticketQueue, breachedTickets } from '@/lib/operations/tickets'
import { formatDate, formatDateTime } from '@/lib/core/dates'
import {
  EmptyState,
  Money,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  StatusPill,
  TableScroll,
  humanise,
} from '@/components/admin/ui'
import { ResolveTicketDialog } from './resolve-dialog'
import { NewTicketDialog } from './new-ticket-dialog'
import { db } from '@/lib/db'
import { propertyWhere } from '@/lib/rbac'

export default async function MaintenancePage() {
  const actor = await requirePermission('maintenance:read')

  const [queue, breached, properties, resolvedThisMonth] = await Promise.all([
    ticketQueue(actor),
    breachedTickets(actor),
    db.property.findMany({
      where: { active: true, ...propertyWhere(actor) },
      select: { id: true, name: true, units: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    }),
    db.ticket.count({
      where: {
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
        ...propertyWhere(actor),
      },
    }),
  ])

  const canManage = can(actor, 'maintenance:manage')
  const emergencies = queue.filter((t) => t.priority === 'EMERGENCY').length

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="From the report to the invoice. A resolved ticket with a cost posts straight to the property ledger."
        actions={<NewTicketDialog properties={properties} />}
      />

      <StatGrid>
        <StatCard label="Open tickets" value={String(queue.length)} sublabel="Not yet resolved" />
        <StatCard
          label="Emergencies"
          value={String(emergencies)}
          sublabel="Four-hour response target"
          tone={emergencies > 0 ? 'critical' : 'default'}
        />
        <StatCard
          label="Past target"
          value={String(breached.length)}
          sublabel="Response time already missed"
          tone={breached.length > 0 ? 'warning' : 'positive'}
        />
        <StatCard
          label="Resolved in 30 days"
          value={String(resolvedThisMonth)}
          sublabel="Closed out"
          tone="positive"
        />
      </StatGrid>

      <Panel className="mt-8" title="Open queue" description="Most urgent first.">
        {queue.length === 0 ? (
          <EmptyState
            title="Nothing outstanding"
            description="Every reported fault has been dealt with."
          />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Ticket</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Where</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Category</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Priority</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Assigned</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Target</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  {canManage && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {queue.map((ticket) => {
                  const overdue = ticket.slaDueAt && ticket.slaDueAt < new Date()

                  return (
                    <tr key={ticket.id} className="hover:bg-black/[0.02]">
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{ticket.title}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {ticket.code}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {ticket.unit?.name ?? '—'}
                        <span className="block text-xs text-muted-foreground">
                          {ticket.property.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {humanise(ticket.category)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill status={ticket.priority} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {ticket.vendor?.name ?? ticket.assignee?.name ?? 'Unassigned'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {ticket.slaDueAt ? (
                          overdue ? (
                            <Pill tone="critical">Past target</Pill>
                          ) : (
                            <span className="text-muted-foreground">
                              {formatDateTime(ticket.slaDueAt)}
                            </span>
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill status={ticket.status} />
                      </td>
                      {canManage && (
                        <td className="px-4 py-2.5 text-right">
                          <ResolveTicketDialog
                            ticketId={ticket.id}
                            ticketCode={ticket.code}
                            hasUnit={Boolean(ticket.unit)}
                          />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <RecentlyResolved actorPropertyFilter={propertyWhere(actor)} />
    </>
  )
}

async function RecentlyResolved({
  actorPropertyFilter,
}: {
  actorPropertyFilter: { propertyId?: { in: string[] } }
}) {
  const resolved = await db.ticket.findMany({
    where: { status: { in: ['RESOLVED', 'CLOSED'] }, ...actorPropertyFilter },
    include: { property: { select: { name: true } }, unit: { select: { name: true } } },
    orderBy: { resolvedAt: 'desc' },
    take: 20,
  })

  if (resolved.length === 0) return null

  return (
    <Panel className="mt-6" title="Recently resolved" description="Costs already in the ledger.">
      <TableScroll>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-semibold">Ticket</th>
              <th className="px-4 py-2.5 text-left font-semibold">Where</th>
              <th className="px-4 py-2.5 text-left font-semibold">Resolved</th>
              <th className="px-4 py-2.5 text-right font-semibold">Cost</th>
              <th className="px-4 py-2.5 text-left font-semibold">Borne by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/6">
            {resolved.map((ticket) => (
              <tr key={ticket.id}>
                <td className="px-4 py-2.5">
                  {ticket.title}
                  <span className="block font-mono text-xs text-muted-foreground">
                    {ticket.code}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {ticket.unit?.name ?? ticket.property.name}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                  {ticket.resolvedAt ? formatDate(ticket.resolvedAt) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {ticket.costMinor ? (
                    <Money minor={ticket.costMinor} currency={ticket.currency} />
                  ) : (
                    <span className="text-muted-foreground">No charge</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {ticket.costMinor ? (
                    <Pill tone={ticket.rechargeToTenant ? 'warning' : 'neutral'}>
                      {ticket.rechargeToTenant ? 'Recharged to tenant' : 'Property'}
                    </Pill>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Panel>
  )
}
