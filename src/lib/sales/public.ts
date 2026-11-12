/**
 * Public queries for the Own-with-ABN and Rent-with-ABN journeys.
 *
 * These run on the marketing site, so the rules are strict: only published
 * units of published, active properties are ever returned, and money is only
 * shown when the platform actually has a price to show. Nothing here trusts
 * a slug to exist — callers handle null and render a friendly not-found.
 */

import { db } from '@/lib/db'
import type { UnitType } from '@prisma/client'

export type ForSaleCard = {
  id: string
  slug: string
  name: string
  unitCode: string
  propertyName: string
  neighbourhood: string | null
  city: string
  type: UnitType
  bedrooms: number
  bathrooms: number
  sizeSqm: number | null
  salePriceMinor: number
  saleCurrency: 'GHS' | 'USD'
  saleBlurb: string | null
  image: string | null
  features: string[]
  backupPower: string | null
}

const forSaleInclude = {
  property: { select: { slug: true, name: true, city: true, neighbourhood: true } },
} as const

function toForSaleCard(
  unit: { id: string; slug: string | null; code: string; name: string; type: UnitType; bedrooms: number; bathrooms: number; sizeSqm: number | null; salePriceMinor: number | null; saleCurrency: 'GHS' | 'USD'; saleBlurb: string | null; images: string[]; features: string[]; backupPower: string | null },
  property: { slug: string; name: string; city: string; neighbourhood: string | null; images?: string[] }
): ForSaleCard | null {
  if (!unit.salePriceMinor) return null
  return {
    id: unit.id,
    // Same slug convention as the marketplace: stored slug, else property-code.
    slug: unit.slug ?? `${property.slug}-${unit.code.toLowerCase()}`,
    name: unit.name,
    unitCode: unit.code,
    propertyName: property.name,
    neighbourhood: property.neighbourhood,
    city: property.city,
    type: unit.type,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    sizeSqm: unit.sizeSqm,
    salePriceMinor: unit.salePriceMinor,
    saleCurrency: unit.saleCurrency,
    saleBlurb: unit.saleBlurb,
    image: unit.images[0] ?? property.images?.[0] ?? null,
    features: unit.features.slice(0, 4),
    backupPower: unit.backupPower,
  }
}

export type SaleFilters = {
  bedrooms?: number
  maxPriceMajor?: number
  type?: UnitType
  sort?: 'price_asc' | 'price_desc' | 'newest'
}

/** Published, for-sale homes. `forSale` is the switch staff flip in Portfolio. */
export async function forSaleUnits(filters: SaleFilters = {}): Promise<ForSaleCard[]> {
  const units = await db.unit.findMany({
    where: {
      published: true,
      forSale: true,
      status: { notIn: ['SOLD', 'OFF_MARKET', 'MAINTENANCE'] },
      salePriceMinor: { not: null },
      ...(filters.bedrooms ? { bedrooms: { gte: filters.bedrooms } } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      property: { published: true, active: true },
    },
    include: forSaleInclude,
    orderBy:
      filters.sort === 'price_asc'
        ? { salePriceMinor: 'asc' }
        : filters.sort === 'price_desc'
          ? { salePriceMinor: 'desc' }
          : [{ propertyId: 'asc' }, { code: 'asc' }],
  })

  const cards = units
    .map((u) => toForSaleCard(u, u.property))
    .filter((c): c is ForSaleCard => c !== null)

  const filtered =
    filters.maxPriceMajor && filters.maxPriceMajor > 0
      ? cards.filter((c) => c.salePriceMinor <= filters.maxPriceMajor! * 100)
      : cards
  return filtered
}

export async function getForSaleBySlug(slug: string) {
  const units = await db.unit.findMany({
    where: {
      published: true,
      forSale: true,
      status: { notIn: ['SOLD', 'OFF_MARKET'] },
      property: { published: true, active: true },
    },
    include: {
      property: { select: { slug: true, name: true, city: true, neighbourhood: true, addressLine: true, images: true, amenities: true } },
    },
  })
  for (const unit of units) {
    const computed = unit.slug ?? `${unit.property.slug}-${unit.code.toLowerCase()}`
    if (computed === slug) {
      const card = toForSaleCard(unit, unit.property)
      if (card) {
        return { ...card, property: unit.property, description: unit.description, features: unit.features, houseRules: unit.houseRules, allImages: unit.images.length > 0 ? unit.images : unit.property.images }
      }
    }
  }
  return null
}

export type RentableCard = {
  id: string
  slug: string
  name: string
  propertyName: string
  neighbourhood: string | null
  city: string
  type: UnitType
  bedrooms: number
  bathrooms: number
  sizeSqm: number | null
  rentMinor: number
  currency: 'GHS' | 'USD'
  image: string | null
  features: string[]
  deskSpace: boolean
  backupPower: string | null
}

/** Published long-let homes with an active rent price and no sitting tenant. */
export async function rentableUnits(filters: { bedrooms?: number; maxRentMajor?: number } = {}): Promise<RentableCard[]> {
  const units = await db.unit.findMany({
    where: {
      published: true,
      lettingMode: { in: ['LONG_LET', 'BOTH'] },
      status: 'AVAILABLE',
      baseRentMinor: { not: null },
      leases: { none: { status: 'ACTIVE' } },
      property: { published: true, active: true },
      ...(filters.bedrooms ? { bedrooms: { gte: filters.bedrooms } } : {}),
    },
    include: {
      property: { select: { slug: true, name: true, city: true, neighbourhood: true, images: true } },
    },
    orderBy: [{ propertyId: 'asc' }, { code: 'asc' }],
  })

  const cards: RentableCard[] = []
  for (const u of units) {
    if (!u.baseRentMinor) continue
    cards.push({
      id: u.id,
      slug: u.slug ?? `${u.property.slug}-${u.code.toLowerCase()}`,
      name: u.name,
      propertyName: u.property.name,
      neighbourhood: u.property.neighbourhood,
      city: u.property.city,
      type: u.type,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      sizeSqm: u.sizeSqm,
      rentMinor: u.baseRentMinor,
      currency: u.currency as 'GHS' | 'USD',
      image: u.images[0] ?? u.property.images[0] ?? null,
      features: u.features.slice(0, 4),
      deskSpace: u.deskSpace,
      backupPower: u.backupPower,
    })
  }

  return cards.filter((c) => (filters.maxRentMajor ? c.rentMinor <= filters.maxRentMajor! * 100 : true))
}

export async function getRentableBySlug(slug: string) {
  const units = await db.unit.findMany({
    where: {
      published: true,
      lettingMode: { in: ['LONG_LET', 'BOTH'] },
      status: 'AVAILABLE',
      baseRentMinor: { not: null },
      leases: { none: { status: 'ACTIVE' } },
      property: { published: true, active: true },
    },
    include: {
      property: { select: { slug: true, name: true, city: true, neighbourhood: true, addressLine: true, images: true } },
    },
  })
  for (const unit of units) {
    const computed = unit.slug ?? `${unit.property.slug}-${unit.code.toLowerCase()}`
    if (computed === slug && unit.baseRentMinor) {
      return {
        id: unit.id,
        slug: computed,
        name: unit.name,
        propertyName: unit.property.name,
        neighbourhood: unit.property.neighbourhood,
        city: unit.property.city,
        addressLine: unit.property.addressLine,
        type: unit.type,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        sizeSqm: unit.sizeSqm,
        rentMinor: unit.baseRentMinor,
        currency: unit.currency as 'GHS' | 'USD',
        description: unit.description,
        features: unit.features,
        houseRules: unit.houseRules,
        allImages: unit.images.length > 0 ? unit.images : unit.property.images,
        deskSpace: unit.deskSpace,
        backupPower: unit.backupPower,
      }
    }
  }
  return null
}

/** GHS display for sale prices and rents: "GHS 2,450,000" / "GHS 12,500 / month". */
export function formatMoney(minor: number, currency: 'GHS' | 'USD'): string {
  const symbol = currency === 'GHS' ? 'GH₵' : '$'
  return `${symbol} ${Math.round(minor / 100).toLocaleString('en-US')}`
}
