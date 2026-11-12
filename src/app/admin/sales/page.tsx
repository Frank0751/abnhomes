import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { PageHeader, Panel, TableScroll, Pill, EmptyState, humanise } from '@/components/admin/ui'
import { formatMinor } from '@/lib/core/money'
import { formatDate } from '@/lib/core/dates'
import { propertyWhere } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

const TONE: Record<string, 'positive' | 'warning' | 'neutral' | 'critical'> = {
  APPLICATION: 'warning',
  APPROVED: 'warning',
  CONTRACTED: 'positive',
  COMPLETED: 'positive',
  DECLINED: 'critical',
  CANCELLED: 'neutral',
}

export default async function SalesPage() {
  const actor = await requirePermission('sales:read')

  const purchases = await db.purchase.findMany({
    where: propertyWhere(actor),
    include: {
      unit: { select: { name: true, property: { select: { name: true } } } },
      charges: {
        where: { status: { notIn: ['REVERSED', 'WAIVED'] } },
        select: { amountMinor: true, allocations: { select: { amountMinor: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div>
      <PageHeader
        title="Property sales"
        description="Every purchase journey, from first offer to key handover. Money flows through the same double-entry ledger as rent — nothing here is a side door."
      />

      <Panel title={`${purchases.length} purchase${purchases.length === 1 ? '' : 's'}`} description="Newest first. Open one to record payments or hand over the keys.">
        {purchases.length === 0 ? (
          <EmptyState
            title="No sales yet"
            description="Offers from /own land here. Mark homes for sale in Portfolio to start receiving them."
          />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Code</th>
                  <th className="px-3 py-2.5 font-medium">Buyer</th>
                  <th className="px-3 py-2.5 font-medium">Home</th>
                  <th className="px-3 py-2.5 text-right font-medium">Agreed price</th>
                  <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                  <th className="px-3 py-2.5 font-medium">Progress</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Applied</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const owed = p.charges.reduce((s, c) => s + c.amountMinor, 0)
                  const paid = p.charges.reduce((s, c) => s + c.allocations.reduce((a, al) => a + al.amountMinor, 0), 0)
                  const pct = owed > 0 ? Math.min(100, Math.round((paid / owed) * 100)) : 0
                  return (
                    <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                      <td className="px-5 py-3">
                        <Link href={`/admin/sales/${p.id}`} className="font-mono text-[13px] font-medium text-[#0f766e] hover:underline">
                          {p.code}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{p.buyerName}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {p.unit.name}
                        <span className="block text-[11px] opacity-70">{p.unit.property.name}</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatMinor(p.offerMinor, p.currency)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatMinor(paid, p.currency)}</td>
                      <td className="px-3 py-3">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/8">
                          <div className="h-full rounded-full bg-[#0d9488]" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Pill tone={TONE[p.status] ?? 'neutral'}>{humanise(p.status)}</Pill>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{formatDate(p.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        Fresh applications live in <Link href="/admin/applications?tab=sales" className="font-medium text-[#0f766e] hover:underline">Applications</Link>
        <ArrowRight className="size-3" /> approve them there, then manage the money here.
      </p>
    </div>
  )
}
