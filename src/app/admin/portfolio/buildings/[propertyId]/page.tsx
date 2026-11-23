import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/session'
import { can, hasPropertyAccess } from '@/lib/rbac'
import { db } from '@/lib/db'
import { PageHeader, Panel, Pill } from '@/components/admin/ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PhotoManager } from '@/components/admin/photo-manager'
import { ArrowLeft, Plus } from 'lucide-react'
import { BuildingForm } from './building-form'
import { saveBuildingPhotosAction, updateBuildingAction, uploadBuildingPhotoAction } from '../../building-actions'

export const metadata = { title: 'Edit building' }
export const dynamic = 'force-dynamic'

export default async function EditBuildingPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const actor = await requirePermission('units:write')
  const { propertyId } = await params
  const { created } = await searchParams

  const property = await db.property.findUnique({
    where: { id: propertyId },
    include: {
      owner: { select: { name: true } },
      agreements: { where: { active: true }, orderBy: { startDate: 'desc' }, take: 1 },
      _count: { select: { units: true } },
    },
  })
  if (!property || !hasPropertyAccess(actor, property.id)) notFound()

  const canManageOwnership = can(actor, 'properties:manage')
  const [managers, owners] = await Promise.all([
    db.user.findMany({
      where: { active: true, suspendedAt: null, role: { in: ['PROPERTY_MANAGER', 'SUPER_ADMIN'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    canManageOwnership
      ? db.party.findMany({ where: { isOwner: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ])

  const feeBasisPoints = property.agreements[0]?.feeBasisPoints ?? 0

  return (
    <>
      <Link
        href="/admin/portfolio"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Portfolio
      </Link>

      <PageHeader
        title={`Edit ${property.name}`}
        description={`${property.addressLine}, ${property.city} · ${property._count.units} room${property._count.units === 1 ? '' : 's'}`}
        actions={
          <>
            <Pill>{property.published ? 'Live on the website' : 'Hidden from the website'}</Pill>
            {can(actor, 'units:write') && (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/rooms/new">
                  <Plus className="mr-1.5 size-4" />
                  Add a room
                </Link>
              </Button>
            )}
          </>
        }
      />

      {created && (
        <Alert className="mb-6">
          <AlertDescription>
            {property.name} has been added and is hidden from the website. Add photos and a description below, then
            add its rooms. Switch on “Show this building on the website” when it is ready.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Photos" description="The outside, entrance, shared spaces and views. Room photos go on each room." className="self-start">
          <PhotoManager
            kind="building"
            name={property.name}
            initial={property.images}
            published={false}
            upload={uploadBuildingPhotoAction.bind(null, property.id)}
            save={saveBuildingPhotosAction.bind(null, property.id)}
          />
        </Panel>

        <Panel title="Details">
          <BuildingForm
            action={updateBuildingAction.bind(null, property.id)}
            managers={managers}
            owners={owners}
            canManageOwnership={canManageOwnership}
            ownerName={property.owner.name}
            building={{
              name: property.name,
              slug: property.slug,
              addressLine: property.addressLine,
              neighbourhood: property.neighbourhood,
              city: property.city,
              region: property.region,
              latitude: property.latitude,
              longitude: property.longitude,
              description: property.description,
              aboutArea: property.aboutArea,
              amenities: property.amenities,
              managerId: property.managerId,
              published: property.published,
              ownerPartyId: property.ownerPartyId,
              feePercent: String(feeBasisPoints / 100),
            }}
          />
        </Panel>
      </div>
    </>
  )
}
