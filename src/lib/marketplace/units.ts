/**
 * The marketplace read layer.
 *
 * Everything the public site shows about a home flows through here, so the
 * rules live in one place: only published units of published properties,
 * only published reviews, slugs that stay stable, prices always quoted from
 * the live rate plans.
 */

import type { Prisma, UnitType } from '@prisma/client'
import { db } from '@/lib/db'
import { dateOnly } from '@/lib/core/dates'
import type { CalendarDay } from '@/lib/short-stay/availability'
import { quoteFromUnit, type Quote } from '@/lib/short-stay/pricing'

export type MarketplaceUnit = Prisma.UnitGetPayload<{
  include: {
    property: { select: { id: true; name: true; slug: true; city: true; neighbourhood: true; addressLine: true; images: true } }
    ratePlans: { where: { active: true } }
    reviews: { select: { rating: true } }
  }
}>

/** URL segment for a unit: property slug + unit code, e.g. tantra-hill-ph. */
export function unitSlug(unit: { code: string; slug?: string | null }, property: { slug: string }): string {
  return unit.slug ?? `${property.slug}-${unit.code.toLowerCase()}`
}

export async function ensureUnitSlug(unitId: string): Promise<string> {
  const unit = await db.unit.findUniqueOrThrow({
    where: { id: unitId },
    include: { property: { select: { slug: true } } },
  })
  const slug = unitSlug(unit, unit.property)
  if (unit.slug !== slug) {
    await db.unit.update({ where: { id: unitId }, data: { slug } }).catch(() => {})
  }
  return slug
}

export type SearchFilters = {
  checkIn: Date
  checkOut: Date
  guests: number
  minPrice?: number // major units, per night
  maxPrice?: number
  bedrooms?: number
  types?: UnitType[]
  hoods?: string[]
  amenities?: string[]
  instantOnly?: boolean
  sort: 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'newest'
}

export type SearchResult = {
  unit: MarketplaceUnit
  quote: Quote
  rating: { average: number; count: number } | null
}

/** The published, letting-today inventory with marketplace filters applied. */
export async function searchMarketplace(filters: SearchFilters): Promise<SearchResult[]> {
  const checkIn = dateOnly(filters.checkIn)
  const checkOut = dateOnly(filters.checkOut)
  if (checkOut <= checkIn) return []

  const units = (await db.unit.findMany({
    where: {
      published: true,
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      status: { notIn: ['OFF_MARKET', 'MAINTENANCE'] },
      maxGuests: { gte: filters.guests },
      ...(filters.bedrooms ? { bedrooms: { gte: filters.bedrooms } } : {}),
      ...(filters.types?.length ? { type: { in: filters.types } } : {}),
      ...(filters.hoods?.length ? { property: { neighbourhood: { in: filters.hoods } } } : {}),
      ...(filters.amenities?.length ? { features: { hasEvery: filters.amenities } } : {}),
      ...(filters.instantOnly ? { instantBook: true } : {}),
      property: { published: true, active: true },
      reservations: {
        none: {
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      },
      blocks: { none: { startDate: { lt: checkOut }, endDate: { gt: checkIn } } },
    },
    include: {
      property: { select: { id: true, name: true, slug: true, city: true, neighbourhood: true, addressLine: true, images: true } },
      ratePlans: { where: { active: true } },
      reviews: { where: { status: 'PUBLISHED' }, select: { rating: true } },
    },
    orderBy: [{ propertyId: 'asc' }, { code: 'asc' }],
  })) as MarketplaceUnit[]

  const results: SearchResult[] = []
  for (const unit of units) {
    const quote = quoteFromUnit(unit, { checkIn, checkOut, guests: filters.guests })
    if (quote.nights <= 0 || quote.totalMinor <= 0) continue
    if (filters.minPrice && quote.averageNightlyMinor < filters.minPrice * 100) continue
    if (filters.maxPrice && quote.averageNightlyMinor > filters.maxPrice * 100) continue

    const ratings = unit.reviews.map((r) => r.rating)
    results.push({
      unit,
      quote,
      rating:
        ratings.length > 0
          ? { average: ratings.reduce((s, r) => s + r, 0) / ratings.length, count: ratings.length }
          : null,
    })
  }

  const bySort: Record<SearchFilters['sort'], (a: SearchResult, b: SearchResult) => number> = {
    recommended: (a, b) => score(b) - score(a),
    price_asc: (a, b) => a.quote.averageNightlyMinor - b.quote.averageNightlyMinor,
    price_desc: (a, b) => b.quote.averageNightlyMinor - a.quote.averageNightlyMinor,
    rating: (a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0),
    newest: (a, b) => b.unit.createdAt.getTime() - a.unit.createdAt.getTime(),
  }
  // Ranking favours honest signals: quality first, then completeness.
  function score(r: SearchResult): number {
    const ratingScore = (r.rating?.average ?? 3.5) * 20
    const completeness =
      Math.min(r.unit.images.length, 10) * 2 +
      Math.min(r.unit.features.length, 12) +
      (r.unit.description ? 6 : 0) +
      (r.unit.safety ? 4 : 0) +
      (r.unit.houseRules.length > 0 ? 2 : 0)
    return ratingScore + completeness
  }

  return results.sort(bySort[filters.sort] ?? bySort.recommended)
}

export type ListingUnit = Prisma.UnitGetPayload<{
  include: {
    property: { include: { owner: { select: { name: true } } } }
    ratePlans: { where: { active: true } }
  }
}>

export async function getListingBySlug(slug: string): Promise<ListingUnit | null> {
  return db.unit.findFirst({
    where: {
      OR: [{ slug }, { code: slug }],
      published: true,
      property: { published: true, active: true },
    },
    include: {
      property: {
        include: { owner: { select: { name: true } } },
      },
      ratePlans: { where: { active: true } },
    },
  })
}

export type PublishedReview = Prisma.ReviewGetPayload<{
  include: { authorParty: { select: { name: true } }; reservation: { select: { checkOut: true, nights: true } } }
}>

export async function publishedReviewsForUnit(unitId: string): Promise<{
  reviews: PublishedReview[]
  summary: { average: number; count: number; subScores: Record<string, number> }
}> {
  const reviews = await db.review.findMany({
    where: { unitId, status: 'PUBLISHED', authorRole: 'GUEST' },
    include: {
      authorParty: { select: { name: true } },
      reservation: { select: { checkOut: true, nights: true } },
    },
    orderBy: { publishedAt: 'desc' },
    take: 24,
  })

  const subAgg: Record<string, { total: number; n: number }> = {}
  for (const r of reviews) {
    const subs = (r.subRatings ?? {}) as Record<string, number>
    for (const [k, v] of Object.entries(subs)) {
      if (typeof v === 'number' && v >= 1 && v <= 5) {
        subAgg[k] = { total: (subAgg[k]?.total ?? 0) + v, n: (subAgg[k]?.n ?? 0) + 1 }
      }
    }
  }
  const subScores: Record<string, number> = {}
  for (const [k, { total, n }] of Object.entries(subAgg)) subScores[k] = Math.round((total / n) * 10) / 10

  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  return {
    reviews,
    summary: { average: Math.round(average * 10) / 10, count: reviews.length, subScores },
  }
}

/** Similar homes: same neighbourhood first, then same city. */
export async function similarUnits(unit: ListingUnit, limit = 3): Promise<MarketplaceUnit[]> {
  const candidates = (await db.unit.findMany({
    where: {
      published: true,
      id: { not: unit.id },
      lettingMode: { in: ['SHORT_STAY', 'BOTH'] },
      status: { notIn: ['OFF_MARKET', 'MAINTENANCE'] },
      property: { published: true, active: true },
    },
    include: {
      property: { select: { id: true, name: true, slug: true, city: true, neighbourhood: true, addressLine: true, images: true } },
      ratePlans: { where: { active: true } },
    },
    take: 24,
  })) as MarketplaceUnit[]

  return candidates
    .sort((a, b) => {
      const scoreOf = (u: MarketplaceUnit) =>
        (u.property.neighbourhood === unit.property.neighbourhood ? 4 : 0) +
        (u.propertyId === unit.propertyId ? 2 : 0) +
        (u.bedrooms === unit.bedrooms ? 1 : 0)
      return scoreOf(b) - scoreOf(a)
    })
    .slice(0, limit)
}

/**
 * Public availability: the next `days` nights as booked/free, computed from
 * one query. Guest names and internal notes never leave the building here.
 */
export async function publicCalendar(unitId: string, days = 62): Promise<CalendarDay[]> {
  const start = dateOnly(new Date())
  const end = new Date(start)
  end.setDate(end.getDate() + days)

  const [reservations, blocks] = await Promise.all([
    db.reservation.findMany({
      where: {
        unitId,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        checkIn: { lt: end },
        checkOut: { gt: start },
      },
      select: { checkIn: true, checkOut: true },
    }),
    db.calendarBlock.findMany({
      where: { unitId, startDate: { lt: end }, endDate: { gt: start } },
      select: { startDate: true, endDate: true },
    }),
  ])

  const out: CalendarDay[] = []
  const cursor = new Date(start)
  while (cursor < end) {
    const day = new Date(cursor)
    const busy =
      reservations.some((r) => r.checkIn <= day && r.checkOut > day) ||
      blocks.some((b) => b.startDate <= day && b.endDate > day)
    out.push({
      date: day.toISOString().slice(0, 10),
      available: !busy,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/** All distinct neighbourhoods with something to show. */
export async function activeNeighbourhoods(): Promise<string[]> {
  const properties = await db.property.findMany({
    where: { published: true, active: true, neighbourhood: { not: null } },
    select: { neighbourhood: true },
    distinct: ['neighbourhood'],
  })
  return properties.map((p) => p.neighbourhood!).filter(Boolean).sort()
}
