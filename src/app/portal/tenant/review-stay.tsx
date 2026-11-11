'use client'

import { useActionState, useState } from 'react'
import { Star } from 'lucide-react'
import { submitReviewAction, type ReviewResult } from './review-actions'

const SUB_QUESTIONS: { key: string; label: string }[] = [
  { key: 'cleanliness', label: 'Cleanliness' },
  { key: 'accuracy', label: 'As described' },
  { key: 'checkIn', label: 'Check-in' },
  { key: 'communication', label: 'Communication' },
  { key: 'location', label: 'Location' },
  { key: 'value', label: 'Value' },
]

/**
 * Star-by-star review dialog. The private note goes only to ABN, never to
 * the public listing — candour without exposure.
 */
export function ReviewStayButton({
  reservationId,
  homeName,
}: {
  reservationId: string
  homeName: string
}) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [subs, setSubs] = useState<Record<string, number>>({})
  const [state, formAction, pending] = useActionState<ReviewResult | null, FormData>(
    async (prev, formData) => {
      const result = await submitReviewAction(formData)
      return result
    },
    null
  )

  if (state?.ok) {
    return (
      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
        ✓ Review received — thank you
      </span>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#0d9488]/40 bg-[#0d9488]/[0.07] px-3 py-1.5 text-xs font-medium text-[#0d9488] transition hover:bg-[#0d9488]/[0.14]"
      >
        <Star className="size-3" />
        Review this stay
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-lifted sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl tracking-tight">How was {homeName}?</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Your review publishes once the host has had their say too — or after 14 days — so please
          be candid.
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="reservationId" value={reservationId} />
          <input type="hidden" name="rating" value={rating} />
          {Object.entries(subs).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}

          <div className="flex items-center justify-center gap-1.5 py-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                <Star className={`size-8 transition ${n <= rating ? 'fill-[#0d9488] text-[#0d9488]' : 'text-black/15 hover:text-black/30'}`} />
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {SUB_QUESTIONS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSubs((prev) => ({ ...prev, [key]: n }))}
                      aria-label={`${label} ${n}`}
                    >
                      <Star className={`size-4 ${n <= (subs[key] ?? 0) ? 'fill-[#0d9488] text-[#0d9488]' : 'text-black/15'}`} />
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your review
            </span>
            <textarea
              name="body"
              required
              rows={4}
              placeholder="What stood out — good or bad?"
              className="w-full resize-none rounded-lg border border-black/12 px-3 py-2.5 text-sm focus:border-[#0d9488] focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Private note to ABN <span className="normal-case font-normal">(never published)</span>
            </span>
            <textarea
              name="privateNote"
              rows={2}
              className="w-full resize-none rounded-lg border border-black/12 px-3 py-2.5 text-sm focus:border-[#0d9488] focus:outline-none"
            />
          </label>

          {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-foreground/70"
            >
              Later
            </button>
            <button
              type="submit"
              disabled={pending || rating === 0}
              className="flex-1 rounded-lg bg-[#0d9488] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f8578] disabled:opacity-50"
            >
              {pending ? 'Sending…' : 'Submit review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
