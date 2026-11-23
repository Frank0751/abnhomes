'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { BuildingResult } from '../../building-actions'
import { FormField, FormSection, NativeSelect } from '../../../rooms/form-bits'
import { OwnerFields } from '../../owner-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export type BuildingDetails = {
  name: string
  slug: string
  addressLine: string
  neighbourhood: string | null
  city: string
  region: string
  latitude: number | null
  longitude: number | null
  description: string | null
  aboutArea: string | null
  amenities: string[]
  managerId: string | null
  published: boolean
  ownerPartyId: string
  feePercent: string
}

const s = (v: string | number | null | undefined) => (v == null ? '' : String(v))

export function BuildingForm({
  action,
  building,
  managers,
  owners,
  canManageOwnership,
  ownerName,
}: {
  action: (prev: BuildingResult | null, formData: FormData) => Promise<BuildingResult>
  building: BuildingDetails
  managers: { id: string; name: string }[]
  /** Only passed to administrators. */
  owners: { id: string; name: string }[]
  canManageOwnership: boolean
  ownerName: string
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<BuildingResult | null, FormData>(action, null)
  const kept = state && !state.ok ? state.values : undefined
  const v = (k: string, fallback: string) => kept?.[k] ?? fallback
  const checked = (k: string, saved: boolean) => (kept ? kept[k] === 'on' : saved)

  useEffect(() => {
    if (state?.ok) {
      toast({ title: state.message })
      router.refresh()
    }
  }, [state, router])

  return (
    <form action={formAction} key={kept ? JSON.stringify(kept) : 'clean'}>
      {state && !state.ok && (
        <div className="px-4 pt-4 sm:px-5">
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        </div>
      )}

      <FormSection title="Where it is">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Building name" className="sm:col-span-2">
            <Input id="name" name="name" required maxLength={80} defaultValue={v('name', building.name)} />
          </FormField>
          <FormField id="addressLine" label="Street address" className="sm:col-span-2">
            <Input id="addressLine" name="addressLine" required maxLength={160} defaultValue={v('addressLine', building.addressLine)} />
          </FormField>
          <FormField id="neighbourhood" label="Neighbourhood">
            <Input id="neighbourhood" name="neighbourhood" maxLength={60} defaultValue={v('neighbourhood', s(building.neighbourhood))} />
          </FormField>
          <FormField id="city" label="City">
            <Input id="city" name="city" required maxLength={60} defaultValue={v('city', building.city)} />
          </FormField>
          <FormField id="region" label="Region">
            <Input id="region" name="region" required maxLength={60} defaultValue={v('region', building.region)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="latitude" label="Latitude">
              <Input id="latitude" name="latitude" type="number" step="any" defaultValue={v('latitude', s(building.latitude))} placeholder="5.6037" />
            </FormField>
            <FormField id="longitude" label="Longitude">
              <Input id="longitude" name="longitude" type="number" step="any" defaultValue={v('longitude', s(building.longitude))} placeholder="-0.1870" />
            </FormField>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          For the map pin: in Google Maps, press and hold on the building and copy the two numbers that appear.
          Web address: /stays/{building.slug}-… (fixed).
        </p>
      </FormSection>

      <FormSection title="What guests read" description="Shown on every room page in this building.">
        <FormField id="description" label="About the building">
          <Textarea id="description" name="description" rows={4} maxLength={4000} defaultValue={v('description', s(building.description))} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="amenities" label="Shared amenities" hint="One per line, e.g. “Rooftop terrace”, “24-hour security”.">
            <Textarea id="amenities" name="amenities" rows={7} defaultValue={v('amenities', building.amenities.join('\n'))} />
          </FormField>
          <FormField id="aboutArea" label="About the area" hint="What is nearby: shops, the airport, places to eat.">
            <Textarea id="aboutArea" name="aboutArea" rows={7} maxLength={2000} defaultValue={v('aboutArea', s(building.aboutArea))} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Who runs it">
        <FormField id="managerId" label="Building manager" hint="Gets this building’s alerts. They are given access to it if they did not have it.">
          <NativeSelect id="managerId" name="managerId" defaultValue={v('managerId', s(building.managerId))}>
            <option value="">No one assigned</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </FormSection>

      <FormSection
        title="Ownership"
        description={canManageOwnership ? 'Changing either starts a new management agreement from today. Earlier statements are not affected.' : undefined}
      >
        {canManageOwnership ? (
          <OwnerFields owners={owners} ownerPartyId={v('ownerPartyId', building.ownerPartyId)} feePercent={v('fee', building.feePercent)} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Owned by {ownerName}, {building.feePercent === '0' ? 'with no management fee' : `with a ${building.feePercent}% management fee`}.
            Only an administrator can change this.
          </p>
        )}
      </FormSection>

      <FormSection title="On the website">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={checked('published', building.published)} className="mt-0.5 size-4 accent-primary" />
          <span>
            <span className="font-medium">Show this building on the website</span>
            <span className="block text-xs text-muted-foreground">
              Its rooms are only listed while this is on, and each room must also be switched on.
            </span>
          </span>
        </label>
      </FormSection>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
          Save building
        </Button>
      </div>
    </form>
  )
}
