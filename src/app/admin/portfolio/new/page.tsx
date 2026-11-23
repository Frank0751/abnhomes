import Link from 'next/link'
import { requirePermission } from '@/lib/session'
import { db } from '@/lib/db'
import { PageHeader, Panel } from '@/components/admin/ui'
import { ArrowLeft } from 'lucide-react'
import { NewBuildingForm } from './new-building-form'

export const metadata = { title: 'Add a building' }

export default async function NewBuildingPage() {
  await requirePermission('properties:manage')
  const owners = await db.party.findMany({
    where: { isOwner: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <>
      <Link
        href="/admin/portfolio"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Portfolio
      </Link>
      <PageHeader title="Add a building" description="Where it is and who owns it. Photos, description and rooms come next." />
      <Panel className="max-w-2xl">
        <NewBuildingForm owners={owners} />
      </Panel>
    </>
  )
}
