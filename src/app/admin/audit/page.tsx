import { ScrollText, ShieldCheck, Users, Activity } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { PageHeader, Panel, TableScroll, EmptyState, StatGrid, StatCard } from '@/components/admin/ui'
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
  searchParams: Promise<{ q?: string; entity?: string; actor?: string; days?: string }>
}) {
  await requirePermission('audit:read')
  const { q, entity, actor, days } = await searchParams

  const daysN = days ? Math.min(90, Math.max(1, Number(days) || 30)) : 30
  const since = new Date(Date.now() - daysN * 86400_000)

  const where = {
    ...(q ? { action: { contains: q, mode: 'insensitive' as never } } : {}),
    ...(entity ? { entityType: entity } : {}),
    ...(actor ? { actorUserId: actor } : {}),
    at: { gte: since },
  }

  const events = await db.auditEvent.findMany({
    where,
    include: { actor: { select: { name: true, role: true } } },
    orderBy: { at: 'desc' },
    take: 150,
  })

  // Oversight band: who is acting, how much, and how recently.
  const [todayCount, actors24h, perActor] = await Promise.all([
    db.auditEvent.count({ where: { at: { gte: new Date(Date.now() - 86400_000) } } }),
    db.auditEvent.groupBy({
      by: ['actorUserId'],
      where: { at: { gte: new Date(Date.now() - 86400_000) }, actorUserId: { not: null } },
      _count: { id: true },
    }),
    db.auditEvent.groupBy({
      by: ['actorUserId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    }),
  ])

  const actorIds = [...new Set(events.map((e) => e.actorUserId).filter((v): v is string => !!v))]
  const actorRows = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: [...actorIds, ...perActor.map((p) => p.actorUserId).filter((v): v is string => !!v)] } },
        select: { id: true, name: true, role: true },
      })
    : []

  const actorById = new Map(actorRows.map((a) => [a.id, a]))
  const topRow = perActor[0]
  const topActor = topRow
    ? {
        name: actorById.get(topRow.actorUserId ?? '')?.name ?? 'system',
        count: topRow._count.id,
      }
    : null

  const entityTypes = [...new Set(events.map((e) => e.entityType))].sort()
  const filterActors = [...new Map(events.filter((e) => e.actor).map((e) => [e.actorUserId, e.actor])).entries()]

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every staff action worth answering for later — immutable, with the actor, the before and the after. Super-admin oversight starts here: who did what, when, and how often."
      />

      <StatGrid>
        <StatCard label="Events, last 24h" value={String(todayCount)} sublabel="across the whole platform" />
        <StatCard label="Staff active, last 24h" value={String(actors24h.length)} sublabel="distinct actors writing" />
        <StatCard
          label="Most active (in filter)"
          value={topActor ? topActor.name : '—'}
          sublabel={topActor ? `${topActor.count} events in the selected window` : 'no events match the filter'}
        />
        <StatCard label="Shown" value={String(events.length)} sublabel={`latest events within ${daysN} days`} />
      </StatGrid>

      <form method="GET" className="mb-5 mt-6 flex flex-wrap items-end gap-3">
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
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Actor
          </span>
          <select name="actor" defaultValue={actor ?? ''} className="rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm">
            <option value="">Everyone</option>
            {filterActors.map(([id, u]) => (
              <option key={id} value={id ?? ''}>
                {u?.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Window
          </span>
          <select name="days" defaultValue={String(daysN)} className="rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm">
            {[1, 7, 30, 90].map((d) => (
              <option key={d} value={d}>
                Last {d} day{d === 1 ? '' : 's'}
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
          <EmptyState title="No matching events" description="Try a wider window or drop a filter." />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Actor</th>
                  <th className="px-3 py-2.5 font-medium">Action</th>
                  <th className="px-3 py-2.5 font-medium">Entity</th>
                  <th className="px-5 py-2.5 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-black/5 last:border-0 align-top">
                    <td className="whitespace-nowrap px-5 py-2.5 text-xs text-muted-foreground">
                      {formatDate(e.at)}{' '}
                      {new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2.5 text-[13px]">
                      {e.actor ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="size-3 text-[#5b6472]" />
                          {e.actor.name}
                          <span className="text-[10px] uppercase tracking-wide opacity-60">{e.actor.role}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Activity className="size-3" />
                          {e.actorLabel ?? 'system'}
                        </span>
                      )}
                    </td>
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

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-[#0d9488]" />
        Events are written by the platform itself on every mutation — they cannot be edited or removed from any
        interface, including this one.
      </p>
    </div>
  )
}
