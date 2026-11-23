import Link from 'next/link'
import { requirePermission } from '@/lib/session'
import { db } from '@/lib/db'
import { PageHeader, Panel } from '@/components/admin/ui'
import { ArrowLeft } from 'lucide-react'
import { StaffForm } from '../staff-form'
import { inviteStaffAction } from '../staff-actions'

export const metadata = { title: 'Invite staff' }

export default async function InviteStaffPage() {
  await requirePermission('users:manage')
  const properties = await db.property.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

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
        title="Invite a member of staff"
        description="They get an email with a link to choose their own password. Nobody else ever knows it."
      />
      <Panel className="max-w-2xl">
        <StaffForm
          mode="invite"
          action={inviteStaffAction}
          properties={properties}
          initial={{ name: '', email: '', phone: '', role: 'FRONT_DESK', propertyIds: properties.length === 1 ? [properties[0].id] : [] }}
        />
      </Panel>
    </>
  )
}
