import { requireActor } from '@/lib/session'
import { db } from '@/lib/db'
import { ROLE_LABELS } from '@/lib/rbac'
import { formatDateTime } from '@/lib/core/dates'
import { PageHeader, Panel } from '@/components/admin/ui'
import { PasswordForm } from './password-form'

export const metadata = { title: 'My account' }
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const actor = await requireActor()
  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { name: true, email: true, role: true, lastLoginAt: true },
  })

  return (
    <>
      <PageHeader
        title="My account"
        description={`${user.name} · ${user.email ?? 'no email'} · ${ROLE_LABELS[user.role]}${
          user.lastLoginAt ? ` · last signed in ${formatDateTime(user.lastLoginAt)}` : ''
        }`}
      />
      <Panel
        className="mx-auto max-w-lg"
        title="Change password"
        description="Only you should know it. Nobody at ABN will ever ask you for it."
      >
        <PasswordForm />
      </Panel>
    </>
  )
}
