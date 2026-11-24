'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cancelMyStayAction } from './actions'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

/**
 * Cancel a confirmed stay. The guest is told what they get back BEFORE they
 * confirm, in a second step, so nobody cancels by a stray tap. The figure
 * shown is advisory: the server works it out again when the button is pressed.
 */
export function CancelStayButton({
  reservationId,
  homeName,
  refundPercent,
}: {
  reservationId: string
  homeName: string
  refundPercent: number
}) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  if (result?.ok) {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
        {result.text}
      </p>
    )
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-xs font-medium text-muted-foreground underline underline-offset-2 transition hover:text-red-700"
      >
        Cancel booking
      </button>
    )
  }

  const refundText =
    refundPercent === 100
      ? 'You will get a full refund of what you paid.'
      : refundPercent > 0
        ? `You will get ${refundPercent}% of what you paid back.`
        : 'This booking is now non-refundable: nothing will be paid back.'

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-sm">
      <p className="font-medium text-foreground">Cancel your stay at {homeName}?</p>
      <p className="mt-1 text-foreground/80">
        {refundText}{' '}
        <Link href="/cancellation-policy" target="_blank" className="underline underline-offset-2">
          Cancellation policy
        </Link>
      </p>
      {result && !result.ok && (
        <p role="alert" className="mt-2 text-red-800">
          {result.text}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await cancelMyStayAction(reservationId)
              setResult({ ok: r.ok, text: r.ok ? (r.message ?? 'Booking cancelled.') : r.error })
              // The list reloads and this booking leaves it, so the confirmation
              // has to live somewhere that survives: a toast.
              if (r.ok) {
                toast({ title: 'Booking cancelled', description: r.message, duration: 15000 })
                router.refresh()
              }
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-800 disabled:opacity-60"
        >
          {pending && <Loader2 className="size-3 animate-spin" />}
          Yes, cancel my booking
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setAsking(false)}
          className="rounded-lg border border-black/12 bg-white px-3 py-1.5 text-xs font-medium transition hover:bg-black/[0.03]"
        >
          Keep my booking
        </button>
      </div>
    </div>
  )
}
