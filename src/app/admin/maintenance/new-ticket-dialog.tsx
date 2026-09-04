'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTicketAction, type ActionResult } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Plus } from 'lucide-react'

const CATEGORIES = [
  'PLUMBING',
  'ELECTRICAL',
  'AIR_CONDITIONING',
  'APPLIANCE',
  'STRUCTURAL',
  'PEST',
  'SECURITY',
  'INTERNET',
  'WATER_SUPPLY',
  'POWER_BACKUP',
  'CLEANING',
  'OTHER',
]

function label(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

export function NewTicketDialog({
  properties,
}: {
  properties: Array<{ id: string; name: string; units: Array<{ id: string; name: string }> }>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? '')
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await createTicketAction(prev, formData)
      if (result.ok) {
        setOpen(false)
        router.refresh()
      }
      return result
    },
    null
  )

  const units = properties.find((p) => p.id === propertyId)?.units ?? []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" />
          Log a fault
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Log a maintenance fault</DialogTitle>
            <DialogDescription>
              The response target is set from the priority: four hours for an emergency, a day for
              high, three days for normal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property</Label>
              <Select name="propertyId" value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger id="propertyId">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitId">Unit</Label>
              <Select name="unitId" defaultValue="none">
                <SelectTrigger id="unitId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Common areas</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="Bedroom air conditioner not cooling"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">What is wrong</Label>
              <Textarea id="description" name="description" rows={3} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select name="category" defaultValue="OTHER">
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {label(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" defaultValue="NORMAL">
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMERGENCY">Emergency — 4 hours</SelectItem>
                  <SelectItem value="HIGH">High — 1 day</SelectItem>
                  <SelectItem value="NORMAL">Normal — 3 days</SelectItem>
                  <SelectItem value="LOW">Low — 1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {state && !state.ok && (
            <p role="alert" className="pb-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Log fault
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
