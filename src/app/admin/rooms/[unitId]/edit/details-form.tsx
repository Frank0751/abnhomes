'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateRoomDetailsAction, type RoomResult } from '../../room-actions'
import { FormField, FormSection, MODE_LABELS, NativeSelect, TYPE_LABELS } from '../../form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export type RoomDetails = {
  id: string
  name: string
  type: string
  lettingMode: string
  floor: number | null
  bedrooms: number
  bathrooms: number
  maxGuests: number
  sizeSqm: number | null
  description: string | null
  features: string[]
  houseRules: string[]
  checkInFrom: string | null
  checkOutUntil: string | null
  selfCheckIn: boolean
  deskSpace: boolean
  wifiName: string | null
  wifiPassword: string | null
  wifiSpeedMbps: number | null
  backupPower: string | null
  waterStorageLitres: number | null
  securityNotes: string | null
  transitNotes: string | null
  licenseNumber: string | null
  published: boolean
  isAmenity: boolean
}

const s = (v: string | number | null | undefined) => (v == null ? '' : String(v))

export function RoomDetailsForm({ room }: { room: RoomDetails }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<RoomResult | null, FormData>(
    updateRoomDetailsAction.bind(null, room.id),
    null
  )

  const kept = state && !state.ok ? state.values : undefined
  const v = (field: string, fallback: string) => kept?.[field] ?? fallback
  // Checkboxes post nothing when unticked, so a refused submit with values
  // must read absence as "off" rather than fall back to the saved value.
  const checked = (field: string, saved: boolean) => (kept ? kept[field] === 'on' : saved)

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

      <FormSection title="The basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Name" className="sm:col-span-2">
            <Input id="name" name="name" required maxLength={80} defaultValue={v('name', room.name)} />
          </FormField>
          <FormField id="type" label="Type">
            <NativeSelect id="type" name="type" defaultValue={v('type', room.type)}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="lettingMode" label="Let as">
            <NativeSelect id="lettingMode" name="lettingMode" defaultValue={v('lettingMode', room.lettingMode)}>
              {Object.entries(MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <FormField id="bedrooms" label="Bedrooms">
            <Input id="bedrooms" name="bedrooms" type="number" min={0} max={20} required defaultValue={v('bedrooms', s(room.bedrooms))} />
          </FormField>
          <FormField id="bathrooms" label="Bathrooms">
            <Input id="bathrooms" name="bathrooms" type="number" min={0} max={20} required defaultValue={v('bathrooms', s(room.bathrooms))} />
          </FormField>
          <FormField id="maxGuests" label="Sleeps">
            <Input id="maxGuests" name="maxGuests" type="number" min={1} max={40} required defaultValue={v('maxGuests', s(room.maxGuests))} />
          </FormField>
          <FormField id="sizeSqm" label="Size (m²)">
            <Input id="sizeSqm" name="sizeSqm" type="number" min={1} defaultValue={v('sizeSqm', s(room.sizeSqm))} />
          </FormField>
          <FormField id="floor" label="Floor">
            <Input id="floor" name="floor" type="number" min={-5} max={200} defaultValue={v('floor', s(room.floor))} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="What guests read" description="Shown on the room’s page on the website.">
        <FormField id="description" label="Description" hint="A few honest sentences: what the room is like and who it suits.">
          <Textarea id="description" name="description" rows={5} maxLength={4000} defaultValue={v('description', s(room.description))} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="features" label="Features" hint="One per line, e.g. “Master bedroom with en-suite washroom”.">
            <Textarea id="features" name="features" rows={8} defaultValue={v('features', room.features.join('\n'))} />
          </FormField>
          <FormField id="houseRules" label="House rules" hint="One per line, e.g. “No smoking indoors”.">
            <Textarea id="houseRules" name="houseRules" rows={8} defaultValue={v('houseRules', room.houseRules.join('\n'))} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="The stay">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FormField id="checkInFrom" label="Check-in from">
            <Input id="checkInFrom" name="checkInFrom" type="time" defaultValue={v('checkInFrom', s(room.checkInFrom))} />
          </FormField>
          <FormField id="checkOutUntil" label="Check-out by">
            <Input id="checkOutUntil" name="checkOutUntil" type="time" defaultValue={v('checkOutUntil', s(room.checkOutUntil))} />
          </FormField>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="selfCheckIn" defaultChecked={checked('selfCheckIn', room.selfCheckIn)} className="size-4 accent-primary" />
            Self check-in
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="deskSpace" defaultChecked={checked('deskSpace', room.deskSpace)} className="size-4 accent-primary" />
            Desk suitable for remote work
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField id="wifiName" label="Wi-Fi name">
            <Input id="wifiName" name="wifiName" maxLength={60} defaultValue={v('wifiName', s(room.wifiName))} autoComplete="off" />
          </FormField>
          <FormField id="wifiPassword" label="Wi-Fi password" hint="Only shown to guests with a confirmed booking.">
            <Input id="wifiPassword" name="wifiPassword" maxLength={60} defaultValue={v('wifiPassword', s(room.wifiPassword))} autoComplete="off" />
          </FormField>
          <FormField id="wifiSpeedMbps" label="Wi-Fi speed (Mbps)">
            <Input id="wifiSpeedMbps" name="wifiSpeedMbps" type="number" min={1} defaultValue={v('wifiSpeedMbps', s(room.wifiSpeedMbps))} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Power, water and security" description="Guests in Ghana ask about these first. Leave blank anything you are not sure of.">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="backupPower" label="Backup power">
            <NativeSelect id="backupPower" name="backupPower" defaultValue={v('backupPower', s(room.backupPower))}>
              <option value="">Not stated</option>
              <option value="generator">Generator</option>
              <option value="inverter">Inverter</option>
              <option value="solar hybrid">Solar hybrid</option>
              <option value="none">None</option>
            </NativeSelect>
          </FormField>
          <FormField id="waterStorageLitres" label="Water storage (litres)">
            <Input id="waterStorageLitres" name="waterStorageLitres" type="number" min={0} defaultValue={v('waterStorageLitres', s(room.waterStorageLitres))} />
          </FormField>
          <FormField id="securityNotes" label="Security" className="sm:col-span-2">
            <Input id="securityNotes" name="securityNotes" maxLength={500} defaultValue={v('securityNotes', s(room.securityNotes))} />
          </FormField>
          <FormField id="transitNotes" label="Getting here" className="sm:col-span-2">
            <Input id="transitNotes" name="transitNotes" maxLength={500} defaultValue={v('transitNotes', s(room.transitNotes))} />
          </FormField>
          <FormField id="licenseNumber" label="Ghana Tourism Authority licence no.">
            <Input id="licenseNumber" name="licenseNumber" maxLength={60} defaultValue={v('licenseNumber', s(room.licenseNumber))} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="On the website">
        {room.isAmenity ? (
          <p className="text-sm text-muted-foreground">Shared space is never listed on its own.</p>
        ) : (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="published" defaultChecked={checked('published', room.published)} className="mt-0.5 size-4 accent-primary" />
            <span>
              <span className="font-medium">Show this room on the website and take bookings</span>
              <span className="block text-xs text-muted-foreground">
                Needs at least one photo, a description and a rate.
              </span>
            </span>
          </label>
        )}
      </FormSection>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
          Save details
        </Button>
      </div>
    </form>
  )
}
