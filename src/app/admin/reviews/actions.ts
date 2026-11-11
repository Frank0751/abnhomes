'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { respondToReview, submitHostReview } from '@/lib/marketplace/reviews'

export type ReviewActionResult = { ok: true; message: string } | { ok: false; error: string }

const respondSchema = z.object({
  reviewId: z.string().min(1),
  body: z.string().min(4, 'Write a response first.').max(1000),
})

export async function respondToReviewAction(formData: FormData): Promise<ReviewActionResult> {
  const actor = await requirePermission('reviews:moderate')
  const parsed = respondSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }

  const result = await respondToReview({
    reviewId: parsed.data.reviewId,
    authorUserId: actor.id,
    body: parsed.data.body,
  })
  if (!result.ok) return { ok: false, error: result.error }

  await logAudit({
    actor,
    action: 'review.responded',
    entityType: 'Review',
    entityId: parsed.data.reviewId,
  })
  revalidatePath('/admin/reviews')
  return { ok: true, message: 'Response published.' }
}

const hostSchema = z.object({
  reservationId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().min(4, 'Add a short note for other hosts.').max(1000),
})

/** The host side of the double-blind exchange: review the guest. */
export async function submitHostReviewAction(formData: FormData): Promise<ReviewActionResult> {
  const actor = await requirePermission('reviews:moderate')
  const parsed = hostSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }

  const result = await submitHostReview({
    reservationId: parsed.data.reservationId,
    authorUserId: actor.id,
    rating: parsed.data.rating,
    body: parsed.data.body,
  })
  if (!result.ok) return { ok: false, error: result.error }

  await logAudit({
    actor,
    action: 'review.host_submitted',
    entityType: 'Reservation',
    entityId: parsed.data.reservationId,
    after: { rating: parsed.data.rating },
  })
  revalidatePath('/admin/reviews')
  return { ok: true, message: 'Host review saved.' }
}

/** Hide a review from the public listing. The text is never edited. */
export async function hideReviewAction(formData: FormData): Promise<ReviewActionResult> {
  const actor = await requirePermission('reviews:moderate')
  const reviewId = String(formData.get('reviewId') ?? '')
  const note = String(formData.get('note') ?? '')

  await db.review.update({
    where: { id: reviewId },
    data: { status: 'HIDDEN', moderatedById: actor.id, moderationNote: note || null },
  })
  await logAudit({
    actor,
    action: 'review.hidden',
    entityType: 'Review',
    entityId: reviewId,
    after: { note },
  })
  revalidatePath('/admin/reviews')
  return { ok: true, message: 'Review hidden from the listing.' }
}

/** Restore a hidden review. */
export async function publishReviewAction(formData: FormData): Promise<ReviewActionResult> {
  const actor = await requirePermission('reviews:moderate')
  const reviewId = String(formData.get('reviewId') ?? '')

  await db.review.update({
    where: { id: reviewId },
    data: { status: 'PUBLISHED', publishedAt: new Date(), moderatedById: actor.id },
  })
  await logAudit({
    actor,
    action: 'review.published',
    entityType: 'Review',
    entityId: reviewId,
  })
  revalidatePath('/admin/reviews')
  return { ok: true, message: 'Review published.' }
}
