import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/session'
import { db } from '@/lib/db'
import { STAFF_ROLES } from '@/lib/rbac'
import { formatDate } from '@/lib/core/dates'
import { formatPhone } from '@/lib/core/phone'
import { PageHeader, Panel, Pill } from '@/components/admin/ui'
import { ArrowLeft } from 'lucide-react'
import { StaffForm } from '../staff-form'
import { resendInviteAction, updateStaffAction } from '../staff-actions'
import { ResendInvite } from './resend-invite'

export const metadata = { title: 'Edit staff' }
export const dynamic = 'force-dynamic'

export default async function EditStaffPage({ params }: { params: Promise<{ userId: string }> }) {
  const actor = await requirePermission('users:manage')
  const { userId } = await params

  const [user, properties, recent] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, include: { propertyAccess: true } }),
    db.property.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.auditEvent.findMany({
      where: { entityType: 'User', entityId: userId },
      orderBy: { at: 'desc' },
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
  ])
  if (!user || !STAFF_ROLES.includes(user.role)) notFound()

  const invited = !user.passwordHash

  return (
    <>
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Users
      </Link>
      <PageHeader
        title={user.name}
        description={`${user.email ?? 'no email'} · last sign-in ${user.lastLoginAt ? formatDate(user.lastLoginAt) : 'never'}`}
        actions={
          <Pill tone={user.suspendedAt ? 'critical' : !user.active ? 'neutral' : invited ? 'warning' : 'positive'}>
            {user.suspendedAt ? 'Suspended' : !user.active ? 'Deactivated' : invited ? 'Invited, no password yet' : 'Active'}
          </Pill>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Role and buildings">
          <StaffForm
            mode="edit"
            action={updateStaffAction.bind(null, user.id)}
            properties={properties}
            lockRole={user.id === actor.id}
            initial={{
              name: user.name,
              email: user.email ?? '',
              phone: user.phone ? formatPhone(user.phone) : '',
              role: user.role,
              propertyIds: user.propertyAccess.map((a) => a.propertyId),
            }}
          />
        </Panel>

        <div className="space-y-6 self-start">
          {invited && user.active && !user.suspendedAt && (
            <Panel title="Invitation" description="They have not chosen a password yet, so they cannot sign in.">
              <ResendInvite action={resendInviteAction.bind(null, user.id)} />
            </Panel>
          )}
          <Panel title="Recent changes">
            {recent.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">Nothing recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {recent.map((e) => (
                  <li key={e.id} className="px-4 py-2.5 sm:px-5">
                    <span className="font-medium">{e.action.replace('user.', '').replace(/_/g, ' ')}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(e.at)} · {e.actor?.name ?? e.actorLabel ?? 'system'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
