import Link from 'next/link'
import { requirePermission } from '@/lib/session'
import { can, unitScopeWhere } from '@/lib/rbac'
import { db } from '@/lib/db'
import { formatDate, daysOverdue } from '@/lib/core/dates'
import { formatMinor, basisPointsToPercent } from '@/lib/core/money'
import { monthsPaidAhead } from '@/lib/long-let/leases'
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
import { RentRunButton } from './rent-run-button'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function LeasesPage() {
  const actor = await requirePermission('leases:read')

  const leases = await db.lease.findMany({
    where: unitScopeWhere(actor),
    include: {
      tenant: { select: { id: true, name: true, phone: true } },
      unit: { select: { name: true, code: true, property: { select: { name: true } } } },
      recurringCharges: { where: { active: true } },
    },
    orderBy: [{ status: 'asc' }, { endDate: 'asc' }],
  })

  // Advance rent held is derived, never stored, so it cannot drift from the
  // ledger. Computed per lease here because it is a per-tenant question.
  const paidAhead = await Promise.all(
    leases
      .filter((l) => l.status === 'ACTIVE')
      .map(async (l) => ({ id: l.id, months: await monthsPaidAhead(l.id) }))
  )
  const aheadById = new Map(paidAhead.map((p) => [p.id, p.months]))

  const active = leases.filter((l) => l.status === 'ACTIVE')
  const expiringSoon = active.filter((l) => daysOverdue(l.endDate) > -90).length
  const monthlyRoll = active.reduce((s, l) => s + l.rentMinor, 0)

  return (
    <>
      <PageHeader
        title="Leases"
        description="Long-let tenancies. The rent run raises each month's charge on schedule and settles it from any advance held."
        actions={
          <>
            {can(actor, 'rentrun:execute') && <RentRunButton />}
            {can(actor, 'leases:write') && (
              <Button asChild size="sm">
                <Link href="/admin/leases/new">
                  <Plus className="mr-1.5 size-4" />
                  New lease
                </Link>
              </Button>
            )}
          </>
        }
      />

      <StatGrid>
        <StatCard label="Active leases" value={String(active.length)} />
        <StatCard
          label="Monthly rent roll"
          value={formatMinor(monthlyRoll, 'GHS')}
          sublabel="Contracted, before collection"
        />
        <StatCard
          label="Ending within 90 days"
          value={String(expiringSoon)}
          sublabel="Renewal conversations due"
          tone={expiringSoon > 0 ? 'warning' : 'default'}
        />
        <StatCard label="All tenancies" value={String(leases.length)} sublabel="Including ended" />
      </StatGrid>

      <Panel className="mt-8" title="Tenancies">
        {leases.length === 0 ? (
          <EmptyState
            title="No leases yet"
            description="Create one to start billing a tenant monthly."
            action={
              can(actor, 'leases:write') ? (
                <Button asChild size="sm">
                  <Link href="/admin/leases/new">Create a lease</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Tenant</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Unit</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Rent</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Term</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Paid ahead</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Escalation</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {leases.map((lease) => {
                  const ahead = aheadById.get(lease.id) ?? 0
                  const daysLeft = -daysOverdue(lease.endDate)

                  return (
                    <tr key={lease.id} className="hover:bg-black/[0.02]">
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{lease.tenant.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {lease.code}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {lease.unit.name}
                        <span className="block text-xs text-muted-foreground">
                          {lease.unit.property.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Money minor={lease.rentMinor} currency={lease.currency} />
                        <span className="block text-xs text-muted-foreground">
                          {humanise(lease.cycle)}
                        </span>
                        {lease.recurringCharges.length > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            +{' '}
                            {formatMinor(
                              lease.recurringCharges.reduce((s, c) => s + c.amountMinor, 0),
                              lease.currency
                            )}{' '}
                            charges
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                        {formatDate(lease.startDate)} –<br />
                        {formatDate(lease.endDate)}
                        {lease.status === 'ACTIVE' && daysLeft <= 90 && daysLeft > 0 && (
                          <Pill tone="warning" className="mt-1 block w-fit">
                            {daysLeft} days left
                          </Pill>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {lease.status === 'ACTIVE' ? (
                          ahead > 0 ? (
                            <Pill tone="positive">
                              {ahead} month{ahead === 1 ? '' : 's'}
                            </Pill>
                          ) : (
                            <span className="text-muted-foreground">Up to date</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {lease.advanceMonths > 0 && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {lease.advanceMonths} agreed at signing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {lease.escalationBasisPoints > 0
                          ? `${basisPointsToPercent(lease.escalationBasisPoints)} yearly`
                          : 'None'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill status={lease.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <p className="mt-4 max-w-2xl text-xs text-muted-foreground">
        <strong className="font-medium">On advance rent.</strong> Money paid up front is not income
        on the day it arrives — it is held as credit and earned month by month as the rent run
        raises each charge. That is why a tenant two years paid ahead shows as up to date rather
        than as a windfall, and why owner statements only ever recognise the month actually earned.
      </p>
    </>
  )
}
