import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { currentActor, loadAccount } from '@/lib/session'
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

  // A session can outlive the account it belongs to: a staff member is
  // deactivated or removed while their cookie is still valid. Throwing here
  // would 500 every admin page for them instead of simply asking them to sign
  // in again, so a missing or disabled account is treated as signed out.
  // Shared with the page's own permission check: one lookup for both.
  const user = await loadAccount(actor.id)
  if (!user || !user.active || user.suspendedAt) redirect('/signin?callbackUrl=/admin')

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
