import Link from 'next/link'
import { requirePermission } from '@/lib/session'
import { propertyScope } from '@/lib/rbac'
import { db } from '@/lib/db'
import { PageHeader, Panel, EmptyState } from '@/components/admin/ui'
import { ArrowLeft } from 'lucide-react'
import { NewRoomForm } from './new-room-form'

export const metadata = { title: 'Add a room' }

/** Suggest the next free numeric code, since ABN numbers its rooms. */
function nextCode(codes: string[]): string {
  const numbers = codes.map((c) => Number(c)).filter((n) => Number.isInteger(n) && n > 0)
  return numbers.length > 0 ? String(Math.max(...numbers) + 1) : ''
}

export default async function NewRoomPage() {
  const actor = await requirePermission('units:write')
  const scope = propertyScope(actor)

  const properties = await db.property.findMany({
    where: { active: true, ...(scope ? { id: { in: scope } } : {}) },
    select: { id: true, name: true, units: { select: { code: true } } },
    orderBy: { name: 'asc' },
  })

  return (
    <>
      <Link
        href="/admin/rooms"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All rooms
      </Link>

      <PageHeader title="Add a room" description="The basics first. Photos, description and rates come next." />

      <Panel className="max-w-2xl">
        {properties.length === 0 ? (
          <EmptyState title="No buildings" description="You do not have access to any active building to add a room to." />
        ) : (
          <NewRoomForm
            properties={properties.map((p) => ({
              id: p.id,
              name: p.name,
              nextCode: nextCode(p.units.map((u) => u.code)),
            }))}
          />
        )}
      </Panel>
    </>
  )
}
