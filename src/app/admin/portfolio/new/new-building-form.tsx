'use client'

import { useActionState, useState } from 'react'
import { createBuildingAction, type BuildingResult } from '../building-actions'
import { FormField } from '../../rooms/form-bits'
import { OwnerFields } from '../owner-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function NewBuildingForm({ owners }: { owners: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<BuildingResult | null, FormData>(createBuildingAction, null)
  const kept = state && !state.ok ? state.values : undefined
  const v = (k: string, fallback = '') => kept?.[k] ?? fallback

  const [name, setName] = useState(v('name'))
  const [slug, setSlug] = useState(v('slug'))
  const [slugTouched, setSlugTouched] = useState(Boolean(v('slug')))

  return (
    <form action={formAction} key={kept ? JSON.stringify(kept) : 'clean'} className="space-y-5 p-4 sm:p-5">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="name" label="Building name" className="sm:col-span-2" hint="As guests should see it, e.g. “ABN Apartments, East Legon”.">
          <Input
            id="name"
            name="name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!slugTouched) setSlug(slugify(e.target.value))
            }}
          />
        </FormField>
        <FormField
          id="slug"
          label="Web address"
          className="sm:col-span-2"
          hint={`abnhomesltd.com/stays/${slug || 'building'}-1 — rooms get addresses from this. It cannot be changed later.`}
        >
          <Input
            id="slug"
            name="slug"
            required
            maxLength={48}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(slugify(e.target.value))
            }}
          />
        </FormField>
        <FormField id="addressLine" label="Street address" className="sm:col-span-2">
          <Input id="addressLine" name="addressLine" required maxLength={160} defaultValue={v('addressLine')} placeholder="8 Asiko Street" />
        </FormField>
        <FormField id="neighbourhood" label="Neighbourhood" hint="Guests filter by this, e.g. Tantra Hill, Osu, East Legon.">
          <Input id="neighbourhood" name="neighbourhood" maxLength={60} defaultValue={v('neighbourhood')} />
        </FormField>
        <FormField id="city" label="City">
          <Input id="city" name="city" required maxLength={60} defaultValue={v('city', 'Accra')} />
        </FormField>
        <FormField id="region" label="Region">
          <Input id="region" name="region" required maxLength={60} defaultValue={v('region', 'Greater Accra')} />
        </FormField>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="mb-3 text-sm font-semibold">Ownership</h3>
        <OwnerFields owners={owners} ownerPartyId={v('ownerPartyId')} feePercent={v('fee', '0')} />
      </div>

      <p className="text-xs text-muted-foreground">
        The building starts hidden from the website. Next you add photos and a description, then its rooms.
      </p>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
        Add building
      </Button>
    </form>
  )
}
