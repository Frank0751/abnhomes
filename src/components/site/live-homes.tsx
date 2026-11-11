import Link from 'next/link'
import Image from 'next/image'
import { db } from '@/lib/db'
import { formatMinor } from '@/lib/core/money'
import { unitSlug } from '@/lib/marketplace/units'
import { ArrowRight, MapPin } from 'lucide-react'

/**
 * The live, bookable inventory — straight from the database, never a
 * hardcoded array. This is the section that cannot lie: if a home is here,
 * it is published and lettable today.
 */
export async function LiveHomes() {
  const properties = await db.property.findMany({
    where: { published: true, active: true },
    include: {
      units: {
        where: { published: true, lettingMode: { in: ['SHORT_STAY', 'BOTH'] }, status: { notIn: ['OFF_MARKET'] } },
        orderBy: [{ code: 'asc' }],
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  })

  const homes = properties.flatMap((p) => p.units.map((u) => ({ unit: u, property: p })))
  if (homes.length === 0) return null

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0d9488]">
              Available to book now
            </p>
            <h2 className="font-serif text-3xl tracking-tight md:text-4xl">Our live collection</h2>
            <p className="mt-2 max-w-xl text-white/60">
              Every home below is published in our booking system with live pricing — what you
              see is what is real, and booking takes you straight to checkout.
            </p>
          </div>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium transition hover:bg-white/10"
          >
            Check dates &amp; prices
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {homes.map(({ unit, property }) => (
            <Link
              key={unit.id}
              href={`/stays/${unitSlug(unit, property)}`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-[#10151f] transition hover:border-[#14b8a6]/40"
            >
              <div className="relative aspect-[4/3] bg-black/30">
                {(unit.images[0] ?? property.images[0]) && (
                  <Image
                    src={unit.images[0] ?? property.images[0]!}
                    alt={unit.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                )}
                {unit.instantBook && (
                  <span className="absolute right-3 top-3 rounded-full bg-[#14b8a6] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#06251f]">
                    Instant book
                  </span>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-serif text-lg tracking-tight text-white">{unit.name}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
                  <MapPin className="size-3" />
                  {property.neighbourhood ?? property.city}
                  {unit.sizeSqm ? ` · ${unit.sizeSqm} m²` : ''}
                </p>
                <p className="mt-2 text-xs text-white/60">
                  {unit.bedrooms} bed · {unit.bathrooms} bath · sleeps {unit.maxGuests}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3.5">
                  {unit.baseNightlyMinor ? (
                    <p className="text-sm tabular-nums text-white">
                      <span className="font-serif text-lg">{formatMinor(unit.baseNightlyMinor, unit.currency)}</span>
                      <span className="ml-1 text-xs text-white/50">/ night</span>
                    </p>
                  ) : (
                    <span className="text-xs text-white/50">Live pricing on search</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#14b8a6]">
                    View home
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
