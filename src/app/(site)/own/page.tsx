import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Bath, BedDouble, MapPin, Ruler, Zap, ArrowRight } from 'lucide-react'
import { PageHero } from '@/components/site/page-hero'
import { forSaleUnits, formatMoney } from '@/lib/sales/public'
import type { UnitType } from '@prisma/client'

export const metadata: Metadata = {
  title: 'Own a Home - ABN Homes',
  description:
    'Buy an ABN Home in Accra: transparent pricing, interest-free payment plans up to five years, and a tracked application from first offer to key handover.',
}

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Partial<Record<UnitType, string>> = {
  STUDIO: 'Studio',
  ONE_BED: '1 bed',
  TWO_BED: '2 bed',
  THREE_BED: '3 bed',
  FOUR_BED: '4 bed',
  PENTHOUSE: 'Penthouse',
  TOWNHOUSE: 'Townhouse',
  DETACHED: 'Detached',
  COMMERCIAL: 'Commercial',
}

const STEPS = [
  {
    n: '1',
    title: 'Apply online',
    body: 'Pick a home and submit an offer of interest. Ninety seconds, no payment, no commitment. You get a tracking code immediately.',
  },
  {
    n: '2',
    title: 'Meet the team',
    body: 'We confirm the home is still available, walk you through it (in person or virtually) and agree the price and your payment plan.',
  },
  {
    n: '3',
    title: 'Sign and pay',
    body: 'The sale agreement is signed, the plan is frozen into your account, and every installment posts to a ledger you can inspect.',
  },
  {
    n: '4',
    title: 'Get the keys',
    body: 'When the plan is paid, we hand over. The home leaves the market, and you become an ABN owner with a portal of your own.',
  },
]

export default async function OwnPage({
  searchParams,
}: {
  searchParams: Promise<{ beds?: string; max?: string; sort?: string }>
}) {
  const sp = await searchParams
  const beds = sp.beds ? Number(sp.beds) : undefined
  const max = sp.max ? Number(sp.max) : undefined
  const sort = sp.sort === 'price_asc' || sp.sort === 'price_desc' ? sp.sort : undefined

  let homes = await forSaleUnits({ bedrooms: beds, maxPriceMajor: max, sort })
  if (sort === undefined) {
    homes = [...homes].sort((a, b) => a.salePriceMinor - b.salePriceMinor)
  }

  return (
    <main className="min-h-screen bg-[#faf8f3]">
      <PageHero
        title="Own an ABN Home."
        subtitle="Transparently priced homes in Accra with interest-free payment plans, a tracked application, and an honest ledger behind every payment. From offer to keys, you always know where you stand."
        bgImage="/images/properties/tantra4-atrium.jpg"
        breadcrumb="Own a Home"
      />

      {/* Process strip */}
      <section className="border-b border-black/8 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-10">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-[#0d9488]/10 font-serif text-lg text-[#0d9488]">
                {s.n}
              </div>
              <h3 className="font-serif text-lg text-[#1a1f2e]">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#5b6472]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Filters */}
      <section className="mx-auto max-w-6xl px-5 pt-10 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl text-[#1a1f2e]">Homes for sale</h2>
            <p className="mt-1 text-sm text-[#5b6472]">
              {homes.length} home{homes.length === 1 ? '' : 's'} open for offers · prices include documentation
            </p>
          </div>
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5b6472]">Bedrooms</span>
              <select name="beds" defaultValue={sp.beds ?? ''} className="rounded-lg border border-black/12 bg-white px-3 py-2 text-sm">
                <option value="">Any</option>
                {[1, 2, 3, 4].map((b) => (
                  <option key={b} value={b}>{b}+</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5b6472]">Max price</span>
              <select name="max" defaultValue={sp.max ?? ''} className="rounded-lg border border-black/12 bg-white px-3 py-2 text-sm">
                <option value="">Any</option>
                {[500000, 1000000, 2000000, 3000000, 5000000].map((p) => (
                  <option key={p} value={p}>≤ GH₵ {p.toLocaleString('en-US')}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5b6472]">Sort</span>
              <select name="sort" defaultValue={sp.sort ?? ''} className="rounded-lg border border-black/12 bg-white px-3 py-2 text-sm">
                <option value="">Featured</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
            <button className="rounded-lg bg-[#0a0e1a] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a2233]">
              Apply filters
            </button>
          </form>
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 lg:px-10">
        {homes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white px-8 py-16 text-center">
            <p className="font-serif text-xl text-[#1a1f2e]">No homes match those filters right now.</p>
            <p className="mt-2 text-sm text-[#5b6472]">
              New homes go on sale as owners list them. <Link href="/contact" className="text-[#0d9488] underline underline-offset-2">Tell us what you are looking for</Link> and we will call you first.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {homes.map((home) => (
              <Link
                key={home.id}
                href={`/own/${home.slug}`}
                className="group overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#e8e3d8]">
                  {home.image ? (
                    <Image
                      src={home.image}
                      alt={home.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : null}
                  <span className="absolute left-4 top-4 rounded-full bg-[#0a0e1a]/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
                    For sale
                  </span>
                  {home.backupPower && home.backupPower !== 'none' && (
                    <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#1a1f2e] backdrop-blur">
                      <Zap className="size-3 text-[#0d9488]" /> Backup power
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <p className="flex items-center gap-1 text-xs text-[#5b6472]">
                    <MapPin className="size-3.5 text-[#0d9488]" />
                    {home.propertyName}
                    {home.neighbourhood ? ` · ${home.neighbourhood}` : ''}
                  </p>
                  <h3 className="mt-1 font-serif text-xl text-[#1a1f2e]">{home.name}</h3>
                  {home.saleBlurb && <p className="mt-1 line-clamp-2 text-sm text-[#5b6472]">{home.saleBlurb}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#5b6472]">
                    <span className="flex items-center gap-1.5"><BedDouble className="size-4 text-[#0d9488]" />{home.bedrooms}</span>
                    <span className="flex items-center gap-1.5"><Bath className="size-4 text-[#0d9488]" />{home.bathrooms}</span>
                    {home.sizeSqm && <span className="flex items-center gap-1.5"><Ruler className="size-4 text-[#0d9488]" />{home.sizeSqm} m²</span>}
                    <span>{TYPE_LABELS[home.type] ?? home.type}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-black/8 pt-4">
                    <p className="font-serif text-xl text-[#1a1f2e]">
                      {formatMoney(home.salePriceMinor, home.saleCurrency)}
                    </p>
                    <span className="flex items-center gap-1 text-sm font-semibold text-[#0d9488] transition group-hover:gap-2">
                      View home <ArrowRight className="size-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="bg-[#0a0e1a] py-16 text-center text-white">
        <div className="mx-auto max-w-3xl px-5 lg:px-10">
          <h2 className="font-serif text-3xl md:text-4xl">Can&apos;t find the one? Be first to know.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/65">
            Homes go on sale as owners list them. Leave your details and we will show you each new
            listing before it reaches the market.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="rounded-lg bg-[#0d9488] px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#14b8a6]"
            >
              Talk to sales
            </Link>
            <Link
              href="/rent"
              className="rounded-lg border border-white/25 px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
            >
              Prefer to rent?
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
