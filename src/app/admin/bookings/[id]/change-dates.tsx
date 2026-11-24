'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changeBookingDatesAction, previewBookingDatesAction, type StaffDatePreview } from './date-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { CalendarDays, Loader2 } from 'lucide-react'

/**
 * Move a confirmed booking. "Check" first, so whoever is on the phone to the
 * guest can say what it costs before anything changes.
 */
export function ChangeBookingDates({
  reservationId,
  checkIn,
  checkOut,
}: {
  reservationId: string
  /** Current dates, YYYY-MM-DD. */
  checkIn: string
  checkOut: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(checkIn)
  const [to, setTo] = useState(checkOut)
  const [preview, setPreview] = useState<StaffDatePreview | null>(null)
  const [pending, start] = useTransition()

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarDays className="mr-1.5 size-4" />
        Change dates
      </Button>
    )
  }

  const edit = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value)
    setPreview(null)
  }
  const ready = preview?.ok && preview.allowed

  return (
    <div className="w-full space-y-3 rounded-lg border border-black/10 bg-secondary/40 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-check-in" className="text-xs">
            New arrival
          </Label>
          <Input id="new-check-in" type="date" value={from} onChange={edit(setFrom)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-check-out" className="text-xs">
            New departure
          </Label>
          <Input id="new-check-out" type="date" value={to} min={from} onChange={edit(setTo)} />
        </div>
      </div>

      {preview && (
        <p
          role="status"
          className={`rounded-md px-3 py-2 text-sm ${
            !preview.ok ? 'bg-red-50 text-red-800' : preview.allowed ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {preview.ok ? preview.message : preview.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {ready ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await changeBookingDatesAction(reservationId, from, to)
                if (!r.ok) {
                  setPreview({ ok: false, error: r.error })
                  return
                }
                toast({ title: 'Dates changed', description: r.message })
                setOpen(false)
                setPreview(null)
                router.refresh()
              })
            }
          >
            {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Move the booking
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={pending || !from || !to}
            onClick={() => start(async () => setPreview(await previewBookingDatesAction(reservationId, from, to)))}
          >
            {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Check these dates
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false)
            setPreview(null)
            setFrom(checkIn)
            setTo(checkOut)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
