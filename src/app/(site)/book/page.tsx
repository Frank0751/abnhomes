/**
 * Public availability search — the revenue engine.
 *
 * Same availability engine the front desk uses, so the website can never
 * offer a night the office has already sold. Filters and sorting run through
 * the marketplace read layer; every price is quoted live from rate plans.
 */

import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { searchMarketplace, activeNeighbourhoods, unitSlug, type SearchFilters } from '@/lib/marketplace/units'
import { formatMinor } from '@/lib/core/money'
import { addDays, dateOnly, formatDate, nightsBetween, toISODate, today } from '@/lib/core/dates'
import type { UnitType } from '@prisma/client'
import { BedDouble, Users, ArrowRight, SlidersHorizontal, Star, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Check availability',
  description:
    'See live availability and nightly rates for ABN Homes serviced apartments in Accra. Book directly with the owner — mobile money, card, no platform fees.',
}

const AMENITY_CHOICES = [
  'Backup generator',
  'Inverter backup',
  'Air conditioning',
  'Fast Wi-Fi',
  'Dedicated workspace',
  'Washing machine',
  'Swimming pool',
  'Gym',
  'Free parking',
  '24/7 security',
  'Water storage',
  'Fully equipped kitchen',
]

const TYPE_CHOICES: { value: UnitType; label: string }[] = [
  { value: 'STUDIO', label: 'Studio' },
  { value: 'ONE_BED', label: '1 bedroom' },
  { value: 'TWO_BED', label: '2 bedrooms' },
  { value: 'THREE_BED', label: '3 bedrooms' },
  { value: 'PENTHOUSE', label: 'Penthouse' },
]

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams

  const checkIn = params.checkIn ? dateOnly(params.checkIn) : today()
  const checkOut = params.checkOut ? dateOnly(params.checkOut) : addDays(checkIn, 3)
  const guests = Number(params.guests ?? 2) || 2
  const nights = nightsBetween(checkIn, checkOut)
  const searched = Boolean(params.checkIn)

  const filters: SearchFilters = {
    checkIn,
    checkOut,
    guests,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    bedrooms: params.bedrooms ? Number(params.bedrooms) : undefined,
    types: params.type ? [params.type as UnitType] : undefined,
    hoods: params.hood ? [params.hood] : undefined,
    amenities: params.amenities ? params.amenities.split(',').filter(Boolean) : undefined,
    instantOnly: params.instant === '1',
    sort: (params.sort as SearchFilters['sort']) ?? 'recommended',
  }

  const [results, hoods] = await Promise.all([
    nights > 0 ? searchMarketplace(filters) : Promise.resolve([]),
    activeNeighbourhoods(),
  ])

  const relaxed = (over: Record<string, string | null>) => {
    const next = new URLSearchParams(params as Record<string, string>)
    for (const [k, v] of Object.entries(over)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    return `/book?${next.toString()}`
  }

  return (
    <main className="pt-28 pb-24">
      <div className="mx-auto max-w-6xl px-5">
        <header className="mb-8">
          <h1 className="font-serif text-4xl tracking-tight text-balance sm:text-5xl">Find your stay</h1>
          <p className="mt-3 max-w-xl text-muted-foreground text-balance">
            Live availability across our apartments in Accra. Book directly with the operator —
            mobile money or card, no platform fee in between.
          </p>
        </header>

        {/* Dates + guests + sort */}
        <form
          method="GET"
          className="mb-4 grid gap-4 rounded-xl border border-black/10 bg-white p-5 shadow-soft sm:grid-cols-[1fr_1fr_auto_auto_auto]"
        >
          <input type="hidden" name="sort" value={filters.sort} />
          {(filters.amenities ?? []).map((a) => (
            <input key={a} type="hidden" name="amenities" value={a} readOnly />
          ))}
          {filters.instantOnly && <input type="hidden" name="instant" value="1" readOnly />}
          {filters.bedrooms ? <input type="hidden" name="bedrooms" value={filters.bedrooms} readOnly /> : null}
          {params.type ? <input type="hidden" name="type" value={params.type} readOnly /> : null}
          {params.hood ? <input type="hidden" name="hood" value={params.hood} readOnly /> : null}
          {params.maxPrice ? <input type="hidden" name="maxPrice" value={params.maxPrice} readOnly /> : null}

          <div className="space-y-1.5">
            <label htmlFor="checkIn" className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Arrive
            </label>
            <input
              id="checkIn"
              name="checkIn"
              type="date"
              defaultValue={toISODate(checkIn)}
              min={toISODate(today())}
              className="w-full rounded-lg border border-black/12 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="checkOut" className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Leave
            </label>
            <input
              id="checkOut"
              name="checkOut"
              type="date"
              defaultValue={toISODate(checkOut)}
              min={toISODate(addDays(today(), 1))}
              className="w-full rounded-lg border border-black/12 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="guests" className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Guests
            </label>
            <input
              id="guests"
              name="guests"
              type="number"
              min={1}
              max={12}
              defaultValue={guests}
              className="w-full rounded-lg border border-black/12 bg-white px-3 py-2 text-sm sm:w-20"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sort" className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Sort
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={filters.sort}
              className="w-full rounded-lg border border-black/12 bg-white px-3 py-2 text-sm"
            >
              <option value="recommended">Recommended</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="rating">Top rated</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full rounded-lg bg-[#0a0e1a] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a2233] sm:w-auto">
              Search
            </button>
          </div>
        </form>

        {/* Filter chips row */}
        <details className="mb-8 rounded-xl border border-black/10 bg-white/70" open={Boolean(filters.amenities?.length || filters.instantOnly || params.hood || params.bedrooms || params.type || params.maxPrice)}>
          <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 text-sm font-medium">
            <SlidersHorizontal className="size-4" />
            Filters
            {(filters.amenities?.length ?? 0) + (filters.instantOnly ? 1 : 0) + (params.hood ? 1 : 0) + (params.bedrooms ? 1 : 0) + (params.type ? 1 : 0) + (params.maxPrice ? 1 : 0) > 0 && (
              <span className="rounded-full bg-[#0d9488] px-2 py-0.5 text-[11px] font-semibold text-white">
                {(filters.amenities?.length ?? 0) + (filters.instantOnly ? 1 : 0) + (params.hood ? 1 : 0) + (params.bedrooms ? 1 : 0) + (params.type ? 1 : 0) + (params.maxPrice ? 1 : 0)}
              </span>
            )}
          </summary>
          <form method="GET" className="grid gap-5 border-t border-black/8 px-5 py-5">
            <input type="hidden" name="checkIn" value={toISODate(checkIn)} />
            <input type="hidden" name="checkOut" value={toISODate(checkOut)} />
            <input type="hidden" name="guests" value={guests} />
            <input type="hidden" name="sort" value={filters.sort} />

            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Bedrooms</p>
                <select name="bedrooms" defaultValue={params.bedrooms ?? ''} className="w-full rounded-lg border border-black/12 px-2.5 py-2 text-sm">
                  <option value="">Any</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Home type</p>
                <select name="type" defaultValue={params.type ?? ''} className="w-full rounded-lg border border-black/12 px-2.5 py-2 text-sm">
                  <option value="">Any</option>
                  {TYPE_CHOICES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Neighbourhood</p>
                <select name="hood" defaultValue={params.hood ?? ''} className="w-full rounded-lg border border-black/12 px-2.5 py-2 text-sm">
                  <option value="">Anywhere in Accra</option>
                  {hoods.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Max price / night (USD)</p>
                <input
                  name="maxPrice"
                  type="number"
                  min={20}
                  step={5}
                  defaultValue={params.maxPrice ?? ''}
                  placeholder="No cap"
                  className="w-full rounded-lg border border-black/12 px-2.5 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {AMENITY_CHOICES.map((a) => {
                  const active = filters.amenities?.includes(a) ?? false
                  const next = new URLSearchParams(params as Record<string, string>)
                  const list = (filters.amenities ?? []).filter((x) => x !== a)
                  if (!active) list.push(a)
                  if (list.length) next.set('amenities', list.join(','))
                  else next.delete('amenities')
                  return (
                    <a
                      key={a}
                      href={`/book?${next.toString()}`}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        active
                          ? 'border-[#0d9488] bg-[#0d9488]/10 font-medium text-[#0d9488]'
                          : 'border-black/12 text-foreground/75 hover:border-black/25'
                      }`}
                    >
                      {a}
                    </a>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <a
                href={filters.instantOnly ? relaxed({ instant: null }) : relaxed({ instant: '1' })}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                  filters.instantOnly
                    ? 'border-[#0d9488] bg-[#0d9488]/10 font-medium text-[#0d9488]'
                    : 'border-black/12 text-foreground/75 hover:border-black/25'
                }`}
              >
                <Zap className="size-3.5" />
                Instant book only
              </a>
              <a href={`/book?checkIn=${toISODate(checkIn)}&checkOut=${toISODate(checkOut)}&guests=${guests}`} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                Clear all filters
              </a>
              <button className="rounded-lg bg-[#0a0e1a] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#1a2233]">
                Apply filters
              </button>
            </div>
          </form>
        </details>

        {nights <= 0 && (
          <p className="mb-6 rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
            Your departure date needs to be after your arrival date.
          </p>
        )}

        {nights > 0 && (
          <>
            <p className="mb-5 text-sm text-muted-foreground">
              {results.length === 0
                ? 'Nothing available for those dates.'
                : `${results.length} home${results.length === 1 ? '' : 's'} available`}{' '}
              · {formatDate(checkIn)} to {formatDate(checkOut)} · {nights} night{nights === 1 ? '' : 's'}
            </p>

            {results.length === 0 && (
              <div className="mb-8 rounded-xl border border-dashed border-black/15 bg-white/50 px-6 py-14 text-center">
                <p className="font-serif text-xl tracking-tight">Fully booked for those dates</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground text-balance">
                  Try shifting your dates by a day or two, clearing a filter, or{' '}
                  <a href="https://wa.me/233541704048" className="underline underline-offset-2">
                    message us on WhatsApp
                  </a>{' '}
                  — we sometimes have space that has just come free.
                </p>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.map(({ unit, quote, rating }) => (
                <article key={unit.id} className="group overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-soft transition hover:shadow-lifted">
                  <Link href={`/stays/${unitSlug(unit, unit.property)}`} className="relative block aspect-[4/3] bg-black/5">
                    {unit.images[0] && (
                      <Image
                        src={unit.images[0]}
                        alt={unit.name}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    )}
                    {rating && rating.average >= 4.8 && (
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#0a0e1a] shadow">
                        ★ Guest favourite
                      </span>
                    )}
                    {unit.instantBook && (
                      <span className="absolute right-3 top-3 rounded-full bg-[#0a0e1a]/85 px-2.5 py-1 text-[11px] font-medium text-white">
                        <Zap className="mr-1 inline size-3" />
                        Instant
                      </span>
                    )}
                  </Link>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-serif text-lg tracking-tight">
                          <Link href={`/stays/${unitSlug(unit, unit.property)}`} className="hover:underline">
                            {unit.name}
                          </Link>
                        </h2>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {unit.property.neighbourhood ?? unit.property.city}, Ghana
                        </p>
                      </div>
                      {rating && (
                        <span className="flex shrink-0 items-center gap-1 text-sm tabular-nums">
                          <Star className="size-3.5 fill-[#0d9488] text-[#0d9488]" />
                          {rating.average.toFixed(1)}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="size-3.5" />
                        {unit.bedrooms} bed{unit.bedrooms === 1 ? '' : 's'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" />
                        Sleeps {unit.maxGuests}
                      </span>
                      {unit.backupPower && unit.backupPower !== 'none' && <span>⚡ Backup power</span>}
                    </p>

                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-black/8 pt-3.5">
                      <div>
                        <p className="font-serif text-xl tracking-tight tabular-nums">
                          {formatMinor(quote.totalMinor, quote.currency)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          total · {nights} night{nights === 1 ? '' : 's'} · all fees in
                        </p>
                      </div>
                      <Link
                        href={`/book/confirm?unitId=${unit.id}&checkIn=${toISODate(checkIn)}&checkOut=${toISODate(checkOut)}&guests=${guests}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#0f8578]"
                      >
                        Book
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
