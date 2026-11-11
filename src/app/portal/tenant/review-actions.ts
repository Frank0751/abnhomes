'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireParty } from '@/lib/session'
import { submitGuestReview } from '@/lib/marketplace/reviews'

export type ReviewResult = { ok: true; message: string } | { ok: false; error: string }

const schema = z.object({
  reservationId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().min(10, 'Tell us a little more — at least a sentence.').max(2000),
  privateNote: z.string().max(1000).optional(),
  cleanliness: z.coerce.number().min(1).max(5).optional(),
  accuracy: z.coerce.number().min(1).max(5).optional(),
  checkIn: z.coerce.number().min(1).max(5).optional(),
  communication: z.coerce.number().min(1).max(5).optional(),
  location: z.coerce.number().min(1).max(5).optional(),
  value: z.coerce.number().min(1).max(5).optional(),
})

/** A guest reviews their completed stay. Double-blind until both sides speak. */
export async function submitReviewAction(formData: FormData): Promise<ReviewResult> {
  const { partyId } = await requireParty()

  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  }

  const result = await submitGuestReview({
    reservationId: parsed.data.reservationId,
    guestPartyId: partyId,
    rating: parsed.data.rating,
    subRatings: {
      cleanliness: parsed.data.cleanliness,
      accuracy: parsed.data.accuracy,
      checkIn: parsed.data.checkIn,
      communication: parsed.data.communication,
      location: parsed.data.location,
      value: parsed.data.value,
    },
    body: parsed.data.body,
    privateNote: parsed.data.privateNote,
  })
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/portal/tenant')
  return { ok: true, message: 'Thank you — your review is in.' }
}
