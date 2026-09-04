import { requirePermission } from '@/lib/session'
import { propertyWhere } from '@/lib/rbac'
import { db } from '@/lib/db'
import { PageHeader } from '@/components/admin/ui'
import { LeaseForm } from './lease-form'

export default async function NewLeasePage() {
  const actor = await requirePermission('leases:write')

  const units = await db.unit.findMany({
    where: {
      lettingMode: { in: ['LONG_LET', 'BOTH'] },
      status: { notIn: ['OFF_MARKET'] },
      ...propertyWhere(actor),
    },
    select: {
      id: true,
      name: true,
      baseRentMinor: true,
      property: { select: { name: true } },
    },
    orderBy: [{ property: { name: 'asc' } }, { code: 'asc' }],
  })

  return (
    <>
      <PageHeader
        title="New lease"
        description="Advance rent entered here is held as credit and earned month by month — it is never booked as income on day one."
      />
      <LeaseForm
        units={units.map((u) => ({
          id: u.id,
          label: `${u.name} — ${u.property.name}`,
          suggestedRent: u.baseRentMinor ? u.baseRentMinor / 100 : null,
        }))}
      />
    </>
  )
}
