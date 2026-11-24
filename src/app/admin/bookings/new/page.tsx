import { requirePermission } from '@/lib/session'
import { propertyWhere } from '@/lib/rbac'
import { db } from '@/lib/db'
import { PageHeader } from '@/components/admin/ui'
import { BookingForm } from './booking-form'
import { toISODate, today, addDays } from '@/lib/core/dates'

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ unitId?: string; checkIn?: string }>
}) {
  const actor = await requirePermission('bookings:write')
  const params = await searchParams

  const units = await db.unit.findMany({
    where: {
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      // A building that has been switched off is gone from every list and total.
      property: { active: true },
      status: { not: 'OFF_MARKET' },
      // Shared space — the rooftop — is not lettable. Offering it here and
      // then refusing it on submit would be a worse form than not offering it.
      isAmenity: false,
      ...propertyWhere(actor),
    },
    select: {
      id: true,
      name: true,
      maxGuests: true,
      currency: true,
      baseNightlyMinor: true,
      property: { select: { name: true } },
    },
    orderBy: [{ property: { name: 'asc' } }, { code: 'asc' }],
  })

  const defaultCheckIn = params.checkIn ?? toISODate(today())
  const defaultCheckOut = toISODate(addDays(new Date(defaultCheckIn), 2))

  return (
    <>
      <PageHeader
        title="New booking"
        description="The price is calculated night by night from the rate plans, so a stay that crosses a peak season picks up both rates."
      />
      <BookingForm
        units={units.map((u) => ({
          id: u.id,
          label: `${u.name} — ${u.property.name}`,
          maxGuests: u.maxGuests,
        }))}
        defaultUnitId={params.unitId}
        defaultCheckIn={defaultCheckIn}
        defaultCheckOut={defaultCheckOut}
      />
    </>
  )
}
