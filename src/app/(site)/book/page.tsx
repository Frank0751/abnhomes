/**
 * Public availability search.
 *
 * The same availability engine the front desk uses, so the website can never
 * offer a night the office has already sold. Prices come from the live rate
 * plans rather than a hardcoded figure that drifts out of date.
 */

import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { findAvailableUnits } from '@/lib/short-stay/availability'
import { quoteFromUnit } from '@/lib/short-stay/pricing'
import { formatMinor } from '@/lib/core/money'
import { addDays, dateOnly, formatDate, nightsBetween, toISODate, today } from '@/lib/core/dates'
import { Button } from '@/components/ui/button'
import { BedDouble, Users, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Check availability',
  description:
    'See live availability and nightly rates for ABN Homes serviced apartments in Accra. Book directly with the owner.',
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>
}) {
  const params = await searchParams

  const checkIn = params.checkIn ? dateOnly(params.checkIn) : today()
  const checkOut = params.checkOut ? dateOnly(params.checkOut) : addDays(checkIn, 3)
  const guests = Number(params.guests ?? 2) || 2
  const nights = nightsBetween(checkIn, checkOut)
  const searched = Boolean(params.checkIn)

  const units =
    nights > 0
      ? await findAvailableUnits({ checkIn, checkOut, guests, publishedOnly: true })
      : []

  const results = units
    .map((unit) => ({
      unit,
      quote: quoteFromUnit(unit, { checkIn, checkOut, guests }),
    }))
    .filter((r) => r.quote.nights > 0 && r.quote.totalMinor > 0)

  return (
    <main className="pt-28 pb-24">
      <div className="mx-auto max-w-5xl px-5">
        <header className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Serviced apartments, Accra
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-balance sm:text-5xl">
            Check availability
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground text-balance">
            Live availability across our apartments. Booking here goes straight to us, with no
            platform fee in between.
          </p>
        </header>

        <form
          method="GET"
          className="mb-10 grid gap-4 rounded border border-black/10 bg-white p-5 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="checkIn"
              className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Arrive
            </label>
            <input
              id="checkIn"
              name="checkIn"
              type="date"
              defaultValue={toISODate(checkIn)}
              min={toISODate(today())}
              className="w-full rounded-sm border border-black/12 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="checkOut"
              className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Leave
            </label>
            <input
              id="checkOut"
              name="checkOut"
              type="date"
              defaultValue={toISODate(checkOut)}
              min={toISODate(addDays(today(), 1))}
              className="w-full rounded-sm border border-black/12 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="guests"
              className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Guests
            </label>
            <input
              id="guests"
              name="guests"
              type="number"
              min={1}
              max={12}
              defaultValue={guests}
              className="w-full rounded-sm border border-black/12 bg-white px-3 py-2 text-sm sm:w-20"
            />
          </div>

          <div className="flex items-end">
            <Button type="submit" className="w-full sm:w-auto">
              Search
            </Button>
          </div>
        </form>

        {nights <= 0 && (
          <p className="rounded border border-amber-300 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
            Your departure date needs to be after your arrival date.
          </p>
        )}

        {nights > 0 && (
          <>
            <p className="mb-5 text-sm text-muted-foreground">
              {results.length === 0
                ? 'Nothing available for those dates.'
                : `${results.length} apartment${results.length === 1 ? '' : 's'} available`}{' '}
              · {formatDate(checkIn)} to {formatDate(checkOut)} · {nights} night
              {nights === 1 ? '' : 's'}
            </p>

            {results.length === 0 && searched && (
              <div className="rounded border border-dashed border-black/15 bg-white/50 px-6 py-14 text-center">
                <p className="font-serif text-xl tracking-tight">Fully booked</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground text-balance">
                  Try shifting your dates by a day or two, or call us on{' '}
                  <a href="tel:+233541704048" className="underline underline-offset-2">
                    054 170 4048
                  </a>{' '}
                  — we sometimes have space that has just come free.
                </p>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {results.map(({ unit, quote }) => (
                <article
                  key={unit.id}
                  className="group overflow-hidden rounded border border-black/10 bg-white"
                >
                  <div className="relative aspect-[4/3] bg-muted">
                    {unit.images[0] && (
                      <Image
                        src={unit.images[0]}
                        alt={unit.name}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    )}
                  </div>

                  <div className="p-5">
                    <h2 className="font-serif text-xl tracking-tight">{unit.name}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {unit.property.name} · {unit.property.city}
                    </p>

                    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <BedDouble className="size-3.5" />
                        {unit.bedrooms} bedroom{unit.bedrooms === 1 ? '' : 's'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-3.5" />
                        Sleeps {unit.maxGuests}
                      </span>
                    </p>

                    {unit.features.length > 0 && (
                      <p className="mt-3 line-clamp-2 text-sm text-foreground/75">
                        {unit.features.slice(0, 4).join(' · ')}
                      </p>
                    )}

                    <div className="mt-5 flex items-end justify-between gap-3 border-t border-black/8 pt-4">
                      <div>
                        <p className="font-serif text-2xl tracking-tight tabular-nums">
                          {formatMinor(quote.totalMinor, quote.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {nights} night{nights === 1 ? '' : 's'}
                          {quote.cleaningFeeMinor > 0 && ', cleaning included'}
                        </p>
                      </div>

                      <Button asChild size="sm">
                        <Link
                          href={`/book/confirm?unitId=${unit.id}&checkIn=${toISODate(checkIn)}&checkOut=${toISODate(checkOut)}&guests=${guests}`}
                        >
                          Book
                          <ArrowRight className="ml-1.5 size-3.5" />
                        </Link>
                      </Button>
                    </div>

                    {quote.violations.some((v) => v.includes('minimum')) && (
                      <p className="mt-2 text-xs text-amber-800">
                        {quote.violations.find((v) => v.includes('minimum'))}
                      </p>
                    )}
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
