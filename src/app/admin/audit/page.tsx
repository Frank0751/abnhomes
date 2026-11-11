import { ScrollText } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { PageHeader, Panel, TableScroll, EmptyState } from '@/components/admin/ui'
import { formatDate } from '@/lib/core/dates'

export const dynamic = 'force-dynamic'

function compact(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  return s.length > 90 ? s.slice(0, 90) + '…' : s
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entity?: string }>
}) {
  await requirePermission('audit:read')
  const { q, entity } = await searchParams

  const events = await db.auditEvent.findMany({
    where: {
      ...(q ? { action: { contains: q, mode: 'insensitive' as never } } : {}),
      ...(entity ? { entityType: entity } : {}),
    },
    include: { actor: { select: { name: true } } },
    orderBy: { at: 'desc' },
    take: 150,
  })

  const entityTypes = [...new Set(events.map((e) => e.entityType))].sort()

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every staff action worth answering for later — immutable, with the actor, the before and the after."
      />

      <form method="GET" className="mb-5 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Action contains
          </span>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="payment, booking, coupon…"
            className="rounded-lg border border-black/12 px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Entity
          </span>
          <select name="entity" defaultValue={entity ?? ''} className="rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm">
            <option value="">All</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-[#0a0e1a] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a2233]">
          Filter
        </button>
      </form>

      <Panel title={`Latest ${events.length} events`}>
        {events.length === 0 ? (
          <EmptyState title="No matching events" description="Try a different filter." />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Actor</th>
                  <th className="px-3 py-2.5 font-medium">Action</th>
                  <th className="px-3 py-2.5 font-medium">Entity</th>
                  <th className="px-3 py-2.5 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-black/5 last:border-0 align-top">
                    <td className="whitespace-nowrap px-5 py-2.5 text-xs text-muted-foreground">
                      {formatDate(e.at)}{' '}
                      {new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2.5 text-[13px]">{e.actor?.name ?? e.actorLabel ?? 'system'}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                        <ScrollText className="size-3 text-[#5b6472]" />
                        {e.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {e.entityType}
                      <span className="block font-mono text-[10px] opacity-70">{e.entityId.slice(-8)}</span>
                    </td>
                    <td className="max-w-[320px] px-3 py-2.5 text-xs text-muted-foreground">
                      {compact(e.before) && <span className="block">before: {compact(e.before)}</span>}
                      {compact(e.after) && <span className="block">after: {compact(e.after)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </div>
  )
}
