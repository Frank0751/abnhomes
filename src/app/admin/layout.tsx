import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { currentActor } from '@/lib/session'
import { ROLE_PERMISSIONS, isUnscoped } from '@/lib/rbac'
import { AdminShell } from '@/components/admin/admin-shell'
import { SessionProvider } from '@/components/admin/providers'

export const metadata: Metadata = {
  title: { default: 'Operations', template: '%s | ABN Operations' },
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor()
  if (!actor) redirect('/signin?callbackUrl=/admin')

  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { name: true, role: true },
  })

  // Say plainly which buildings this person can see. A manager who thinks they
  // are looking at the whole portfolio when they are not will misread every
  // number on the screen.
  const scopeLabel = isUnscoped(actor.role)
    ? 'All properties'
    : actor.propertyIds.length === 0
      ? 'No properties assigned'
      : `${actor.propertyIds.length} propert${actor.propertyIds.length === 1 ? 'y' : 'ies'}`

  return (
    <SessionProvider>
      <AdminShell
        user={{ name: user.name, role: user.role, scopeLabel }}
        permissions={ROLE_PERMISSIONS[actor.role]}
      >
        {children}
      </AdminShell>
    </SessionProvider>
  )
}
