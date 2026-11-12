import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Bath,
  BedDouble,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  MapPin,
  Ruler,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { RentForm } from '@/components/site/apply-forms'
import { formatMoney, getRentableBySlug } from '@/lib/sales/public'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const home = await getRentableBySlug(slug)
  if (!home) return { title: 'Home not found - ABN Homes' }
  return {
    title: `${home.name}, ${home.propertyName} - Rent an ABN Home`,
    description: `${formatMoney(home.rentMinor, home.currency)} per month · ${home.bedrooms} bedroom at ${home.propertyName}, ${home.city}. One month deposit, no agency fees, tracked application.`,
  }
}

export default async function RentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const home = await getRentableBySlug(slug)
  if (!home) notFound()

  const rentLabel = formatMoney(home.rentMinor, home.currency)
  const depositLabel = formatMoney(home.rentMinor, home.currency) // one month, standard

  return (
    <main className="min-h-screen bg-[#faf8f3]">
      <section className="relative h-[46vh] min-h-72 w-full overflow-hidden bg-[#0a0e1a]">
        {home.allImages[0] && (
          <Image src={home.allImages[0]} alt={home.name} fill priority sizes="100vw" className="object-cover opacity-90" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a]/85 via-[#0a0e1a]/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-5 pb-8 lg:px-10">
          <Link href="/rent" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white/70 transition hover:text-white">
            <ArrowLeft className="size-3.5" /> All homes to rent
          </Link>
          <p className="flex items-center gap-1.5 text-sm text-white/75">
            <MapPin className="size-4 text-[#14b8a6]" />
            {home.propertyName}
            {home.neighbourhood ? ` · ${home.neighbourhood}, ${home.city}` : ''}
          </p>
          <h1 className="mt-1 font-serif text-4xl text-white md:text-5xl">{home.name}</h1>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1fr_400px] lg:px-10">
        <div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-black/8 bg-white p-5 shadow-soft">
            <p className="font-serif text-2xl text-[#1a1f2e]">
              {rentLabel}<span className="ml-1 font-sans text-sm font-medium text-[#5b6472]">/ month</span>
            </p>
            <span className="text-[#5b6472]">·</span>
            <span className="flex items-center gap-1.5 text-sm text-[#5b6472]"><BedDouble className="size-4 text-[#0d9488]" />{home.bedrooms} bed</span>
            <span className="flex items-center gap-1.5 text-sm text-[#5b6472]"><Bath className="size-4 text-[#0d9488]" />{home.bathrooms} bath</span>
            {home.sizeSqm && <span className="flex items-center gap-1.5 text-sm text-[#5b6472]"><Ruler className="size-4 text-[#0d9488]" />{home.sizeSqm} m²</span>}
          </div>

          {home.description && <p className="mt-6 leading-relaxed text-[#4b5563]">{home.description}</p>}

          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Wallet, t: 'Deposit', d: `${depositLabel} — one month, held and returned after inspection` },
              { icon: CalendarClock, t: 'Lease terms', d: '6–36 months, billed monthly to your account, 5-day grace before late fees' },
              { icon: ShieldCheck, t: 'Screening', d: 'ID + income check, free, about two working days' },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border border-black/8 bg-white p-4">
                <f.icon className="size-5 text-[#0d9488]" />
                <dt className="mt-2 font-medium text-[#1a1f2e]">{f.t}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-[#5b6472]">{f.d}</dd>
              </div>
            ))}
          </dl>

          {home.features.length > 0 && (
            <div className="mt-10">
              <h2 className="font-serif text-2xl text-[#1a1f2e]">What&apos;s inside</h2>
              <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {home.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#4b5563]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#0d9488]" /> {f.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {home.allImages.length > 1 && (
            <div className="mt-10">
              <h2 className="font-serif text-2xl text-[#1a1f2e]">Gallery</h2>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {home.allImages.slice(1, 5).map((img, i) => (
                  <div key={img + i} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-black/8 bg-[#e8e3d8]">
                    <Image src={img} alt={`${home.name} photo ${i + 2}`} fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 rounded-2xl border border-black/8 bg-white p-6 shadow-soft">
            <h2 className="font-serif text-2xl text-[#1a1f2e]">How renting here works</h2>
            <ol className="mt-5 space-y-5">
              {[
                { icon: FileCheck2, title: 'Apply with a code', body: 'Submit the form — it takes two minutes and creates your tracked RNT- application.' },
                { icon: Search, title: 'We screen', body: 'ID and income check, references if needed. You can watch the status move on the tracking page.' },
                { icon: KeyRound, title: 'Sign and move in', body: 'Approved applicants sign digitally, pay the deposit, and get a tenant portal on day one.' },
              ].map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0d9488]/10">
                    <s.icon className="size-5 text-[#0d9488]" />
                  </span>
                  <div>
                    <h3 className="font-medium text-[#1a1f2e]">{s.title}</h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-[#5b6472]">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-black/8 bg-white p-6 shadow-soft">
            <h3 className="font-serif text-xl text-[#1a1f2e]">Apply to rent this home</h3>
            <p className="mb-5 mt-1 text-sm text-[#5b6472]">
              Free screening, no obligation. You get a tracking code immediately.
            </p>
            <RentForm unitId={home.id} rentLabel={`${rentLabel}/mo`} />
          </div>
        </aside>
      </div>
    </main>
  )
}
