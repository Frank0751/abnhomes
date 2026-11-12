import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Bath,
  BedDouble,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  MapPin,
  Ruler,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { BuyForm, PurchaseCalculator } from '@/components/site/apply-forms'
import { forSaleUnits, formatMoney, getForSaleBySlug } from '@/lib/sales/public'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const home = await getForSaleBySlug(slug)
  if (!home) return { title: 'Home not found - ABN Homes' }
  return {
    title: `${home.name}, ${home.propertyName} - Own an ABN Home`,
    description:
      home.saleBlurb ??
      `${home.bedrooms}-bedroom home for sale at ${home.propertyName}, ${home.city}. Interest-free payment plans, tracked purchase, honest ledger.`,
  }
}

const POWER_LABELS: Record<string, string> = {
  generator: 'Backup generator',
  inverter: 'Inverter backup',
  'solar hybrid': 'Solar hybrid power',
}

export default async function OwnDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const home = await getForSaleBySlug(slug)
  if (!home) notFound()

  const others = (await forSaleUnits()).filter((h) => h.id !== home.id).slice(0, 3)
  const priceLabel = formatMoney(home.salePriceMinor, home.saleCurrency)

  return (
    <main className="min-h-screen bg-[#faf8f3]">
      {/* Header image band */}
      <section className="relative h-[46vh] min-h-72 w-full overflow-hidden bg-[#0a0e1a]">
        {home.allImages[0] && (
          <Image
            src={home.allImages[0]}
            alt={home.name}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-90"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a]/85 via-[#0a0e1a]/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-5 pb-8 lg:px-10">
          <Link
            href="/own"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> All homes for sale
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
        {/* Left: facts, story, gallery */}
        <div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-black/8 bg-white p-5 shadow-soft">
            <p className="font-serif text-2xl text-[#1a1f2e]">{priceLabel}</p>
            <span className="text-[#5b6472]">·</span>
            <span className="flex items-center gap-1.5 text-sm text-[#5b6472]"><BedDouble className="size-4 text-[#0d9488]" />{home.bedrooms} bed</span>
            <span className="flex items-center gap-1.5 text-sm text-[#5b6472]"><Bath className="size-4 text-[#0d9488]" />{home.bathrooms} bath</span>
            {home.sizeSqm && <span className="flex items-center gap-1.5 text-sm text-[#5b6472]"><Ruler className="size-4 text-[#0d9488]" />{home.sizeSqm} m²</span>}
            {home.backupPower && home.backupPower !== 'none' && (
              <span className="flex items-center gap-1.5 rounded-full bg-[#0d9488]/10 px-3 py-1 text-xs font-medium text-[#0f766e]">
                <Zap className="size-3.5" />{POWER_LABELS[home.backupPower] ?? 'Backup power'}
              </span>
            )}
          </div>

          {home.saleBlurb && <p className="mt-6 font-serif text-xl leading-relaxed text-[#1a1f2e]">{home.saleBlurb}</p>}
          {home.description && <p className="mt-4 leading-relaxed text-[#4b5563]">{home.description}</p>}

          {home.features.length > 0 && (
            <div className="mt-8">
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

          {/* The journey, specific to this home */}
          <div className="mt-10 rounded-2xl border border-black/8 bg-white p-6 shadow-soft">
            <h2 className="font-serif text-2xl text-[#1a1f2e]">Buying this home, step by step</h2>
            <ol className="mt-5 space-y-5">
              {[
                { icon: FileCheck2, title: 'Your offer is logged', body: 'Applying creates a tracked application with its own code. No payment happens at this step.' },
                { icon: ShieldCheck, title: 'We verify and agree', body: 'A sales manager confirms availability, shows you the home, and agrees the final price and plan with you.' },
                { icon: KeyRound, title: 'Contract and keys', body: 'The signed agreement freezes your plan. Every installment posts to a double-entry ledger you can see, and when the balance clears, the home is yours.' },
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

        {/* Right: sticky apply rail */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <PurchaseCalculator priceMinor={home.salePriceMinor} currency={home.saleCurrency} />

          <div className="rounded-2xl border border-black/8 bg-white p-6 shadow-soft">
            <h3 className="font-serif text-xl text-[#1a1f2e]">Apply to buy this home</h3>
            <p className="mb-5 mt-1 text-sm text-[#5b6472]">
              Takes about 90 seconds. You will get a tracking code the moment you submit.
            </p>
            <BuyForm unitId={home.id} priceLabel={priceLabel} />
          </div>
        </aside>
      </div>

      {/* Other homes */}
      {others.length > 0 && (
        <section className="border-t border-black/8 bg-white py-14">
          <div className="mx-auto max-w-6xl px-5 lg:px-10">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="font-serif text-2xl text-[#1a1f2e]">Other homes for sale</h2>
              <Link href="/own" className="text-sm font-medium text-[#0d9488] hover:underline">
                View all
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {others.map((h) => (
                <Link key={h.id} href={`/own/${h.slug}`} className="group overflow-hidden rounded-xl border border-black/8 bg-[#faf8f3] transition hover:shadow-md">
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#e8e3d8]">
                    {h.image && (
                      <Image src={h.image} alt={h.name} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-serif text-lg text-[#1a1f2e]">{h.name}</h3>
                    <p className="mt-1 text-sm text-[#5b6472]">{formatMoney(h.salePriceMinor, h.saleCurrency)} · {h.bedrooms} bed</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
