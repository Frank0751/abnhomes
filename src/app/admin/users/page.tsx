import { ShieldAlert, ShieldCheck, UserCog } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { PageHeader, Panel, Pill, StatGrid, StatCard } from '@/components/admin/ui'
import { ROLE_LABELS } from '@/lib/rbac'
import { formatDate } from '@/lib/core/dates'
import { suspendUserAction, restoreUserAction, toggleUserActiveAction } from './actions'
import { UserActionButtons } from './user-buttons'
import type { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  await requirePermission('users:manage')

  const users = await db.user.findMany({
    include: { propertyAccess: { include: { property: { select: { name: true } } } } },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  })

  const staff = users.filter((u) => !['TENANT', 'OWNER', 'VENDOR'].includes(u.role))
  const external = users.filter((u) => ['TENANT', 'OWNER', 'VENDOR'].includes(u.role))
  const suspended = users.filter((u) => u.suspendedAt)

  return (
    <div>
      <PageHeader
        title="Users"
        description="Every account on the platform — staff and guests. Suspension blocks sign-in immediately on every login path."
      />

      <StatGrid>
        <StatCard label="Staff accounts" value={String(staff.length)} sublabel="internal roles" />
        <StatCard label="Guest & portal accounts" value={String(external.length)} sublabel="tenants, owners, vendors" />
        <StatCard label="Suspended" value={String(suspended.length)} tone={suspended.length > 0 ? 'critical' : 'default'} sublabel="trust & safety holds" />
      </StatGrid>

      {(['staff', 'portal'] as const).map((group) => {
        const list = group === 'staff' ? staff : external
        return (
          <Panel
            key={group}
            className="mt-6"
            title={group === 'staff' ? 'Staff' : 'Tenants, owners & vendors'}
            description={group === 'staff' ? 'Internal roles with least-privilege permissions.' : 'Portal accounts created through bookings, leases and vendor work.'}
          >
            <ul className="divide-y divide-black/[0.06]">
              {list.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {u.role === 'VENDOR' ? <UserCog className="size-4 text-[#5b6472]" /> : null}
                      {u.name}
                      <Pill tone={u.suspendedAt ? 'critical' : u.active ? 'positive' : 'neutral'}>
                        {u.suspendedAt ? 'Suspended' : u.active ? 'Active' : 'Deactivated'}
                      </Pill>
                      <span className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[u.role as Role]}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {u.email ?? u.phone ?? 'no contact'} · last sign-in {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'never'}
                      {u.propertyAccess.length > 0 && ` · ${u.propertyAccess.map((a) => a.property.name).join(', ')}`}
                    </p>
                    {u.suspendedAt && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-red-700">
                        <ShieldAlert className="size-3" />
                        {formatDate(u.suspendedAt)} — {u.suspensionReason ?? 'no reason recorded'}
                      </p>
                    )}
                  </div>
                  <UserActionButtons
                    userId={u.id}
                    suspended={Boolean(u.suspendedAt)}
                    active={u.active}
                    actions={{ suspendUserAction, restoreUserAction, toggleUserActiveAction }}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        )
      })}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3" />
        Every suspension, restoration and deactivation lands in the audit log with the acting
        admin&apos;s name.
      </p>
    </div>
  )
}
