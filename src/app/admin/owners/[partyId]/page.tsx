/**
 * An owner's dashboard, as the office sees it.
 *
 * The same figures the owner sees when they sign in to their portal, opened
 * from the admin so the office can answer "how is my building doing?" on the
 * phone without asking the owner to log in. A member of staff who only works
 * in some buildings sees only those.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/session'
import { propertyScope } from '@/lib/rbac'
import { db } from '@/lib/db'
import { ownerDashboard } from '@/lib/reporting/owner'
import { OwnerDashboardView } from '@/components/owner/owner-dashboard'
import { EmptyState, PageHeader } from '@/components/admin/ui'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Owner dashboard' }
export const dynamic = 'force-dynamic'

export default async function OwnerDashboardPage({ params }: { params: Promise<{ partyId: string }> }) {
  const actor = await requirePermission('owners:read')
  const { partyId } = await params
  const scope = propertyScope(actor)

  const owner = await db.party.findUnique({
    where: { id: partyId },
    select: {
      name: true,
      ownedProperties: {
        where: { active: true, ...(scope ? { id: { in: scope } } : {}) },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      },
    },
  })
  if (!owner) notFound()
  // Scoped staff must not learn that an owner exists from a building they cannot see.
  if (scope && owner.ownedProperties.length === 0) notFound()

  const data = await ownerDashboard({
    ownerPartyId: partyId,
    propertyIds: scope ? owner.ownedProperties.map((p) => p.id) : null,
  })

  return (
    <>
      <Link
        href="/admin/owners"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Owner statements
      </Link>
      <PageHeader
        title={owner.name}
        description={
          owner.ownedProperties.length === 0
            ? 'No active buildings.'
            : `${owner.ownedProperties.map((p) => p.name).join(', ')} · ${data.roomCount} room${data.roomCount === 1 ? '' : 's'}`
        }
      />
      {owner.ownedProperties.length === 0 ? (
        <EmptyState title="Nothing to show" description="This owner has no active buildings." />
      ) : (
        <OwnerDashboardView data={data} />
      )}
    </>
  )
}
