import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Bath, BedDouble, Briefcase, MapPin, Ruler, Zap } from 'lucide-react'
import { PageHero } from '@/components/site/page-hero'
import { formatMoney, rentableUnits } from '@/lib/sales/public'

export const metadata: Metadata = {
  title: 'Rent a Home - ABN Homes',
  description:
    'Rent a furnished ABN home in Accra on a 6-36 month lease: transparent monthly rent, one-month deposit, no agency fees, and a tracked application.',
}

export const dynamic = 'force-dynamic'

export default async function RentPage({
  searchParams,
}: {
  searchParams: Promise<{ beds?: string; max?: string }>
}) {
  const sp = await searchParams
  const beds = sp.beds ? Number(sp.beds) : undefined
  const max = sp.max ? Number(sp.max) : undefined
  const homes = await rentableUnits({ bedrooms: beds, maxRentMajor: max })

  return (
    <main className="min-h-screen bg-[#faf8f3]">
      <PageHero
        title="Rent an ABN Home."
        subtitle="Furnished homes for six months or six years. One month's deposit, no agency fee, a lease you can read, and a maintenance desk that answers. Apply online and track your screening with a code."
        bgImage="/images/properties/tantra4-atrium.jpg"
        breadcrumb="Rent a Home"
      />

      {/* What renting with ABN means */}
      <section className="border-b border-black/8 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-3 lg:px-10">
          {[
            { title: 'One month deposit', body: 'Standard, written into your lease. Held, not spent — released at move-out after inspection.' },
            { title: 'No agency fees', body: 'You deal with ABN directly. The rent on this page is the rent you pay, billed to your account monthly.' },
            { title: 'A real maintenance desk', body: 'Leak at midnight? Report it in your tenant portal; a task lands on a technician, not in a WhatsApp void.' },
          ].map((f) => (
            <div key={f.title}>
              <h3 className="font-serif text-lg text-[#1a1f2e]">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#5b6472]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-10 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl text-[#1a1f2e]">Homes available now</h2>
            <p className="mt-1 text-sm text-[#5b6472]">
              {homes.length} home{homes.length === 1 ? '' : 's'} with no sitting tenant · rent shown per month
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
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5b6472]">Max monthly rent</span>
              <select name="max" defaultValue={sp.max ?? ''} className="rounded-lg border border-black/12 bg-white px-3 py-2 text-sm">
                <option value="">Any</option>
                {[5000, 10000, 15000, 25000, 40000].map((p) => (
                  <option key={p} value={p}>≤ GH₵ {p.toLocaleString('en-US')}</option>
                ))}
              </select>
            </label>
            <button className="rounded-lg bg-[#0a0e1a] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a2233]">
              Apply filters
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 lg:px-10">
        {homes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white px-8 py-16 text-center">
            <p className="font-serif text-xl text-[#1a1f2e]">Nothing available with those filters right now.</p>
            <p className="mt-2 text-sm text-[#5b6472]">
              Homes open up as leases end. <Link href="/contact" className="text-[#0d9488] underline underline-offset-2">Join the waiting list</Link> and we will call you first.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {homes.map((home) => (
              <Link
                key={home.id}
                href={`/rent/${home.slug}`}
                className="group overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#e8e3d8]">
                  {home.image && (
                    <Image
                      src={home.image}
                      alt={home.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                  <span className="absolute left-4 top-4 rounded-full bg-[#0a0e1a]/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
                    Long let
                  </span>
                  {home.deskSpace && (
                    <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#1a1f2e] backdrop-blur">
                      <Briefcase className="size-3 text-[#0d9488]" /> Work-ready
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
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#5b6472]">
                    <span className="flex items-center gap-1.5"><BedDouble className="size-4 text-[#0d9488]" />{home.bedrooms}</span>
                    <span className="flex items-center gap-1.5"><Bath className="size-4 text-[#0d9488]" />{home.bathrooms}</span>
                    {home.sizeSqm && <span className="flex items-center gap-1.5"><Ruler className="size-4 text-[#0d9488]" />{home.sizeSqm} m²</span>}
                    {home.backupPower && home.backupPower !== 'none' && (
                      <span className="flex items-center gap-1.5"><Zap className="size-4 text-[#0d9488]" />Backup</span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-black/8 pt-4">
                    <p className="font-serif text-xl text-[#1a1f2e]">
                      {formatMoney(home.rentMinor, home.currency)}
                      <span className="ml-1 font-sans text-xs font-medium text-[#5b6472]">/ month</span>
                    </p>
                    <span className="text-sm font-semibold text-[#0d9488] transition group-hover:underline">
                      View & apply
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bg-[#0a0e1a] py-16 text-center text-white">
        <div className="mx-auto max-w-3xl px-5 lg:px-10">
          <h2 className="font-serif text-3xl md:text-4xl">Looking to buy instead?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/65">
            Some tenants become owners. Every ABN home that goes on sale appears first on our Own a Home page, with interest-free payment plans.
          </p>
          <Link
            href="/own"
            className="mt-8 inline-block rounded-lg bg-[#0d9488] px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#14b8a6]"
          >
            See homes for sale
          </Link>
        </div>
      </section>
    </main>
  )
}
