'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Loader2, EyeOff, Eye, MessageSquare } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

type Action = (formData: FormData) => Promise<ActionResult>

export function RespondForm({ reviewId, action }: { reviewId: string; action: Action }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()

  const submit = (formData: FormData) =>
    start(async () => {
      const result = await action(formData)
      if (result.ok) {
        toast({ title: result.message })
        setOpen(false)
        router.refresh()
      } else {
        toast({ title: 'Not saved', description: result.error, variant: 'destructive' })
      }
    })

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium transition hover:bg-black/5"
      >
        <MessageSquare className="size-3" />
        Reply
      </button>
    )
  }

  return (
    <form action={submit} className="w-64 space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <textarea
        name="body"
        rows={3}
        required
        placeholder="A public reply, shown under the review."
        className="w-full resize-none rounded-lg border border-black/12 px-2.5 py-2 text-xs"
      />
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-md border border-black/10 px-2 py-1.5 text-xs">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[#0a0e1a] px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50">
          {pending && <Loader2 className="size-3 animate-spin" />}
          Reply
        </button>
      </div>
    </form>
  )
}

export function HostReviewForm({ reservationId, action }: { reservationId: string; action: Action }) {
  const [rating, setRating] = useState(5)
  const [pending, start] = useTransition()
  const router = useRouter()

  const submit = (formData: FormData) =>
    start(async () => {
      const result = await action(formData)
      if (result.ok) {
        toast({ title: result.message })
        router.refresh()
      } else {
        toast({ title: 'Not saved', description: result.error, variant: 'destructive' })
      }
    })

  return (
    <form action={submit} className="flex items-center gap-2">
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="rating" value={rating} />
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
            <Star className={`size-4 ${n <= rating ? 'fill-[#0d9488] text-[#0d9488]' : 'text-black/15'}`} />
          </button>
        ))}
      </span>
      <input
        name="body"
        required
        placeholder="How was the guest?"
        className="w-40 rounded-md border border-black/12 px-2 py-1.5 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#0a0e1a] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? '…' : 'Save'}
      </button>
    </form>
  )
}

export function ModerateButtons({
  reviewId,
  status,
  hideAction,
  publishAction,
}: {
  reviewId: string
  status: string
  hideAction: (formData: FormData) => Promise<ActionResult>
  publishAction: (formData: FormData) => Promise<ActionResult>
}) {
  const [pending, start] = useTransition()
  const router = useRouter()
  const [note, setNote] = useState('')

  const run = (action: (formData: FormData) => Promise<ActionResult>, formData: FormData) =>
    start(async () => {
      const result = await action(formData)
      if (result.ok) {
        toast({ title: result.message })
        router.refresh()
      } else {
        toast({ title: 'Not done', description: result.error, variant: 'destructive' })
      }
    })

  if (status === 'HIDDEN') {
    return (
      <button
        disabled={pending}
        onClick={() => {
          const fd = new FormData()
          fd.set('reviewId', reviewId)
          run(publishAction, fd)
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium transition hover:bg-black/5"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Eye className="size-3" />}
        Restore
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="reason"
        className="w-24 rounded-md border border-black/12 px-2 py-1.5 text-xs"
      />
      <button
        disabled={pending}
        onClick={() => {
          const fd = new FormData()
          fd.set('reviewId', reviewId)
          fd.set('note', note)
          run(hideAction, fd)
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <EyeOff className="size-3" />}
        Hide
      </button>
    </div>
  )
}
