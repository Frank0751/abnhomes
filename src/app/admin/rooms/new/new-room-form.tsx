'use client'

import { useActionState } from 'react'
import { createRoomAction, type RoomResult } from '../room-actions'
import { FormField, MODE_LABELS, NativeSelect, TYPE_LABELS } from '../form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

export function NewRoomForm({
  properties,
}: {
  properties: { id: string; name: string; nextCode: string }[]
}) {
  const [state, formAction, pending] = useActionState<RoomResult | null, FormData>(createRoomAction, null)

  // A refused submit hands the typed values back; keying the form on them
  // makes React re-seed the inputs instead of leaving them blank.
  const kept = state && !state.ok ? state.values : undefined
  const v = (field: string, fallback: string) => kept?.[field] ?? fallback

  return (
    <form action={formAction} key={kept ? JSON.stringify(kept) : 'clean'} className="space-y-5 p-4 sm:p-5">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="propertyId" label="Building" className="sm:col-span-2">
          <NativeSelect id="propertyId" name="propertyId" defaultValue={v('propertyId', properties[0]?.id ?? '')} required>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField
          id="code"
          label="Room code"
          hint="Short and unique in the building, like 8 or B3. It becomes part of the web address and cannot be changed later."
        >
          <Input id="code" name="code" required maxLength={12} defaultValue={v('code', properties[0]?.nextCode ?? '')} autoComplete="off" />
        </FormField>

        <FormField id="name" label="Name" hint="What guests and staff see, e.g. “Room 8 — Garden Suite”.">
          <Input id="name" name="name" required maxLength={80} defaultValue={v('name', '')} />
        </FormField>

        <FormField id="type" label="Type">
          <NativeSelect id="type" name="type" defaultValue={v('type', 'ONE_BED')}>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField id="lettingMode" label="Let as">
          <NativeSelect id="lettingMode" name="lettingMode" defaultValue={v('lettingMode', 'SHORT_STAY')}>
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <FormField id="bedrooms" label="Bedrooms">
            <Input id="bedrooms" name="bedrooms" type="number" min={0} max={20} required defaultValue={v('bedrooms', '1')} />
          </FormField>
          <FormField id="bathrooms" label="Bathrooms">
            <Input id="bathrooms" name="bathrooms" type="number" min={0} max={20} required defaultValue={v('bathrooms', '1')} />
          </FormField>
          <FormField id="maxGuests" label="Sleeps">
            <Input id="maxGuests" name="maxGuests" type="number" min={1} max={40} required defaultValue={v('maxGuests', '2')} />
          </FormField>
        </div>

        <FormField id="currency" label="Priced in" hint="You set the actual rates on the room’s page.">
          <NativeSelect id="currency" name="currency" defaultValue={v('currency', 'USD')}>
            <option value="USD">US dollars</option>
            <option value="GHS">Ghana cedis</option>
          </NativeSelect>
        </FormField>
      </div>

      <p className="text-xs text-muted-foreground">
        The room starts hidden from the website. Next you add photos and a description, set its rates, and
        publish it when it is ready.
      </p>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
        Create room and add photos
      </Button>
    </form>
  )
}
