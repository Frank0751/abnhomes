'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changeMyStayDatesAction, previewDateChangeAction, type DateChangePreview } from './date-change-actions'
import { toast } from '@/hooks/use-toast'
import { CalendarDays, Loader2 } from 'lucide-react'

/**
 * Move a confirmed stay to other dates. Two steps on purpose: "Check these
 * dates" shows whether they are free and what changes in the price, and only
 * then is there a button that does it. The server works everything out again
 * when that button is pressed, so what is shown here is never what is trusted.
 */
export function ChangeDatesButton({
  reservationId,
  homeName,
  checkIn,
  checkOut,
}: {
  reservationId: string
  homeName: string
  /** Current dates, YYYY-MM-DD. */
  checkIn: string
  checkOut: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(checkIn)
  const [to, setTo] = useState(checkOut)
  const [preview, setPreview] = useState<DateChangePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80 underline underline-offset-2 transition hover:text-[#00a878]"
      >
        <CalendarDays className="size-3.5" />
        Change dates
      </button>
    )
  }

  // Changing either date makes the last answer stale.
  const edit = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value)
    setPreview(null)
    setError(null)
  }

  return (
    <div className="w-full rounded-lg border border-black/10 bg-white p-3 text-sm">
      <p className="font-medium">New dates for {homeName}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Arrive</span>
          <input
            type="date"
            value={from}
            min={tomorrow}
            onChange={edit(setFrom)}
            className="w-full rounded-lg border border-black/12 px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Leave</span>
          <input
            type="date"
            value={to}
            min={from || tomorrow}
            onChange={edit(setTo)}
            className="w-full rounded-lg border border-black/12 px-2.5 py-2 text-sm"
          />
        </label>
      </div>

      {preview?.ok && (
        <p
          role="status"
          className={`mt-3 rounded-md px-3 py-2 ${preview.kind === 'less' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}
        >
          {preview.message} {preview.nights} night{preview.nights === 1 ? '' : 's'}, new total {preview.newTotal}.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-red-800">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {preview?.ok ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await changeMyStayDatesAction(reservationId, from, to)
                if (!r.ok) {
                  setError(r.error)
                  setPreview(null)
                  return
                }
                toast({ title: r.moved ? 'Dates changed' : 'Request sent', description: r.message, duration: 15000 })
                setOpen(false)
                setPreview(null)
                router.refresh()
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00a878] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#00916a] disabled:opacity-60"
          >
            {pending && <Loader2 className="size-3 animate-spin" />}
            {preview.kind === 'less' ? 'Send request' : 'Confirm new dates'}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || !from || !to}
            onClick={() =>
              start(async () => {
                setError(null)
                const r = await previewDateChangeAction(reservationId, from, to)
                if (r.ok) setPreview(r)
                else setError(r.error)
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0c1a16] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1a2233] disabled:opacity-60"
          >
            {pending && <Loader2 className="size-3 animate-spin" />}
            Check these dates
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false)
            setPreview(null)
            setError(null)
            setFrom(checkIn)
            setTo(checkOut)
          }}
          className="rounded-lg border border-black/12 bg-white px-3 py-1.5 text-xs font-medium transition hover:bg-black/[0.03]"
        >
          Keep my dates
        </button>
      </div>
    </div>
  )
}
