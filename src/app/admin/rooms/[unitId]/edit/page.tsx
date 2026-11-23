/**
 * Editing a room: its photos and everything the website says about it.
 *
 * Rates and the manager stay on the room's own page, beside the calendar and
 * revenue they affect. This page is the listing.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/session'
import { hasPropertyAccess } from '@/lib/rbac'
import { db } from '@/lib/db'
import { unitSlug } from '@/lib/marketplace/units'
import { PageHeader, Panel, Pill } from '@/components/admin/ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { PhotoManager } from './photo-manager'
import { RoomDetailsForm } from './details-form'

export const metadata = { title: 'Edit room' }

export default async function EditRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const actor = await requirePermission('units:write')
  const { unitId } = await params
  const { created } = await searchParams

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: { property: { select: { name: true, slug: true } } },
  })
  if (!unit || !hasPropertyAccess(actor, unit.propertyId)) notFound()

  const publicPath = `/stays/${unitSlug(unit, unit.property)}`

  return (
    <>
      <Link
        href={`/admin/rooms/${unit.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to {unit.name}
      </Link>

      <PageHeader
        title={`Edit ${unit.name}`}
        description={`${unit.property.name} · room code ${unit.code}`}
        actions={
          <>
            <Pill>{unit.published ? 'Live on the website' : 'Hidden from the website'}</Pill>
            {unit.published && (
              <Button asChild size="sm" variant="outline">
                <a href={publicPath} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 size-4" />
                  View on the website
                </a>
              </Button>
            )}
          </>
        }
      />

      {created && (
        <Alert className="mb-6">
          <AlertDescription>
            {unit.name} has been created and is hidden from the website. Add photos and a description below, set
            its rates on the{' '}
            <Link href={`/admin/rooms/${unit.id}`} className="underline">
              room’s page
            </Link>
            , then tick “Show this room on the website”.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Photos" description="What guests see first. Use landscape photos for the cover." className="self-start">
          <PhotoManager unitId={unit.id} roomName={unit.name} initial={unit.images} published={unit.published} />
        </Panel>

        <Panel title="Details">
          <RoomDetailsForm
            room={{
              id: unit.id,
              name: unit.name,
              type: unit.type,
              lettingMode: unit.lettingMode,
              floor: unit.floor,
              bedrooms: unit.bedrooms,
              bathrooms: unit.bathrooms,
              maxGuests: unit.maxGuests,
              sizeSqm: unit.sizeSqm,
              description: unit.description,
              features: unit.features,
              houseRules: unit.houseRules,
              checkInFrom: unit.checkInFrom,
              checkOutUntil: unit.checkOutUntil,
              selfCheckIn: unit.selfCheckIn,
              deskSpace: unit.deskSpace,
              wifiName: unit.wifiName,
              wifiPassword: unit.wifiPassword,
              wifiSpeedMbps: unit.wifiSpeedMbps,
              backupPower: unit.backupPower,
              waterStorageLitres: unit.waterStorageLitres,
              securityNotes: unit.securityNotes,
              transitNotes: unit.transitNotes,
              licenseNumber: unit.licenseNumber,
              published: unit.published,
              isAmenity: unit.isAmenity,
            }}
          />
        </Panel>
      </div>
    </>
  )
}
