/**
 * Reviews — the trust engine.
 *
 * Rules, straight from the spec:
 * - Only completed stays can be reviewed, by the guest who stayed or by the
 *   host's team.
 * - Double-blind: nothing shows until both sides have spoken, or the 14-day
 *   window closes — whichever comes first.
 * - The host may reply to the guest's review exactly once.
 * - Moderation can hide a review, but never edit it.
 */

import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export const REVIEW_WINDOW_DAYS = 14

export type SubRatings = {
  cleanliness?: number
  accuracy?: number
  checkIn?: number
  communication?: number
  location?: number
  value?: number
}

function clampSubRatings(input: Record<string, unknown>): SubRatings {
  const out: SubRatings = {}
  for (const key of ['cleanliness', 'accuracy', 'checkIn', 'communication', 'location', 'value'] as const) {
    const v = Number(input[key])
    if (Number.isFinite(v) && v >= 1 && v <= 5) out[key] = Math.round(v)
  }
  return out
}

async function windowEndsFor(reservationId: string): Promise<Date> {
  const reservation = await db.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: { checkOut: true },
  })
  const end = new Date(reservation.checkOut)
  end.setDate(end.getDate() + REVIEW_WINDOW_DAYS)
  return end
}

/** Publish a reservation's reviews when both sides are in. */
async function revealIfComplete(reservationId: string): Promise<void> {
  const reviews = await db.review.findMany({
    where: { reservationId, status: 'PENDING' },
    select: { id: true, authorRole: true },
  })
  if (reviews.length < 2) return
  await db.review.updateMany({
    where: { id: { in: reviews.map((r) => r.id) } },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  })
}

/** The guest reviews the stay. */
export async function submitGuestReview(args: {
  reservationId: string
  guestPartyId: string
  rating: number
  subRatings?: Record<string, unknown>
  body: string
  privateNote?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const reservation = await db.reservation.findUnique({
    where: { id: args.reservationId },
    include: { reviews: { select: { authorRole: true } } },
  })
  if (!reservation) return { ok: false, error: 'Stay not found.' }
  if (reservation.guestPartyId !== args.guestPartyId) {
    return { ok: false, error: 'You can only review your own stays.' }
  }
  if (reservation.status !== 'CHECKED_OUT') {
    return { ok: false, error: 'Reviews open after your stay ends.' }
  }
  if (reservation.reviews.some((r) => r.authorRole === 'GUEST')) {
    return { ok: false, error: 'You have already reviewed this stay.' }
  }

  const rating = Math.round(Number(args.rating))
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: 'Pick a star rating first.' }
  const body = args.body.trim()
  if (body.length < 10) return { ok: false, error: 'Tell us a little more — at least a sentence.' }

  await db.review.create({
    data: {
      reservationId: reservation.id,
      unitId: reservation.unitId,
      authorRole: 'GUEST',
      authorPartyId: args.guestPartyId,
      rating,
      subRatings: clampSubRatings(args.subRatings ?? {}) as never,
      body: body.slice(0, 2000),
      privateNote: args.privateNote?.trim().slice(0, 1000) || null,
      status: 'PENDING',
      windowEndsAt: await windowEndsFor(reservation.id),
    },
  })

  await revealIfComplete(reservation.id)
  return { ok: true }
}

/** The host's team reviews the guest (private to hosts) and may recommend. */
export async function submitHostReview(args: {
  reservationId: string
  authorUserId: string
  rating: number
  body: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const reservation = await db.reservation.findUnique({
    where: { id: args.reservationId },
    include: { reviews: { select: { authorRole: true } } },
  })
  if (!reservation) return { ok: false, error: 'Booking not found.' }
  if (!['CHECKED_OUT', 'CHECKED_IN'].includes(reservation.status)) {
    return { ok: false, error: 'Host reviews open during or after the stay.' }
  }
  if (reservation.reviews.some((r) => r.authorRole === 'HOST')) {
    return { ok: false, error: 'This guest has already been reviewed for this stay.' }
  }

  const rating = Math.round(Number(args.rating))
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: 'Pick a star rating.' }
  const body = args.body.trim()
  if (body.length < 4) return { ok: false, error: 'Add a short note for other hosts.' }

  await db.review.create({
    data: {
      reservationId: reservation.id,
      unitId: reservation.unitId,
      authorRole: 'HOST',
      authorUserId: args.authorUserId,
      rating,
      body: body.slice(0, 1000),
      status: 'PENDING',
      windowEndsAt: await windowEndsFor(reservation.id),
    },
  })

  await revealIfComplete(reservation.id)
  return { ok: true }
}

/** The single public host reply to a published review. */
export async function respondToReview(args: {
  reviewId: string
  authorUserId: string
  body: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const review = await db.review.findUnique({ where: { id: args.reviewId } })
  if (!review) return { ok: false, error: 'Review not found.' }
  if (review.hostResponse) return { ok: false, error: 'This review already has a response.' }
  const body = args.body.trim()
  if (body.length < 4) return { ok: false, error: 'Write a response first.' }

  await db.review.update({
    where: { id: args.reviewId },
    data: {
      hostResponse: body.slice(0, 1000),
      hostResponseAt: new Date(),
      hostResponseById: args.authorUserId,
    },
  })
  return { ok: true }
}

/** Cron: publish every double-blind window that has closed. */
export async function revealExpiredWindows(): Promise<number> {
  const due = await db.review.findMany({
    where: { status: 'PENDING', windowEndsAt: { lte: new Date() } },
    select: { reservationId: true },
    distinct: ['reservationId'],
    take: 100,
  })
  for (const { reservationId } of due) {
    await db.review.updateMany({
      where: { reservationId, status: 'PENDING' },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })
  }
  return due.length
}

export type ModerationReview = Prisma.ReviewGetPayload<{
  include: {
    authorParty: { select: { name: true } }
    authorUser: { select: { name: true } }
    reservation: { select: { code: true, checkOut: true } }
    unit: { select: { name: true, property: { select: { name: true } } } }
  }
}>
