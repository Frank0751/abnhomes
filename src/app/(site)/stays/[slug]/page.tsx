import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  BedDouble,
  Bath,
  Users,
  Ruler,
  Building2,
  Wifi,
  Zap,
  Droplets,
  ShieldCheck,
  Sparkles,
  MapPin,
  Star,
  BadgeCheck,
  Clock3,
  DoorOpen,
  Coffee,
  ArrowRight,
  Flag,
} from 'lucide-react'
import { getListingBySlug, publishedReviewsForUnit, publicCalendar, similarUnits, unitSlug } from '@/lib/marketplace/units'
import { quoteFromUnit } from '@/lib/short-stay/pricing'
import { formatMinor } from '@/lib/core/money'
import { addDays, formatDate, toISODate, today } from '@/lib/core/dates'
import { Gallery } from '@/components/site/listing-gallery'
import { AvailabilityPreview } from '@/components/site/availability-preview'

export const dynamic = 'force-dynamic'

type Safety = {
  smokeAlarm?: boolean
  coAlarm?: boolean
  firstAidKit?: boolean
  fireExtinguisher?: boolean
  securityCameraNote?: string
  poolUngated?: boolean
  hazardNote?: string
}

type Sleeping = { room: string; bed: string; count?: number }[]

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const unit = await getListingBySlug(slug)
  if (!unit) return { title: 'Home not found — ABN Homes' }
  const title = `${unit.name} — ${unit.property.neighbourhood ?? unit.property.city} | ABN Homes`
  const description =
    unit.description?.slice(0, 155) ??
    `Serviced ${unit.bedrooms}-bedroom apartment in ${unit.property.city}, Ghana. Book directly with ABN Homes — no platform fees.`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: unit.images.slice(0, 2).map((url) => ({ url })),
    },
    alternates: { canonical: `/stays/${unit.slug ?? slug}` },
  }
}

export default async function StayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const unit = await getListingBySlug(slug)
  if (!unit) notFound()

  const { reviews, summary } = await publishedReviewsForUnit(unit.id)
  const calendar = await publicCalendar(unit.id)
  const similar = await similarUnits(unit)

  const guests = Number(sp.guests ?? Math.min(2, unit.maxGuests)) || Math.min(2, unit.maxGuests)
  const checkIn = sp.checkIn ? new Date(sp.checkIn) : addDays(today(), 7)
  const checkOut = sp.checkOut ? new Date(sp.checkOut) : addDays(checkIn, 3)
  const quote = quoteFromUnit(unit as never, { checkIn, checkOut, guests })
  const hasDates = Boolean(sp.checkIn && sp.checkOut)
  const bookUrl = hasDates
    ? `/book/confirm?unitId=${unit.id}&checkIn=${toISODate(checkIn)}&checkOut=${toISODate(checkOut)}&guests=${guests}`
    : `/book?checkIn=${toISODate(checkIn)}&checkOut=${toISODate(checkOut)}&guests=${guests}`

  const safety = (unit.safety ?? {}) as Safety
  const sleeping = (unit.sleeping ?? []) as Sleeping
  const nightlyFrom = unit.baseNightlyMinor ?? unit.ratePlans[0]?.nightlyMinor ?? 0

  const freeUntil = addDays(checkIn, -7)
  const halfUntil = addDays(checkIn, -2)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Apartment',
    name: unit.name,
    description: unit.description ?? undefined,
    image: unit.images,
    address: {
      '@type': 'PostalAddress',
      streetAddress: unit.property.addressLine,
      addressLocality: unit.property.city,
      addressCountry: 'GH',
    },
    numberOfBedrooms: unit.bedrooms,
    numberOfBathroomsTotal: unit.bathrooms,
    occupancy: { '@type': 'QuantitativeValue', maxValue: unit.maxGuests },
    ...(summary.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: summary.average.toFixed(1),
            reviewCount: summary.count,
          },
        }
      : {}),
    ...(nightlyFrom
      ? {
          makesOffer: {
            '@type': 'Offer',
            price: nightlyFrom / 100,
            priceCurrency: unit.currency,
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  }

  return (
    <main className="pt-24 pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-6xl px-5">
        <nav className="mb-4 text-xs text-muted-foreground">
          <Link href="/residences" className="hover:underline">
            Our homes
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{unit.name}</span>
        </nav>

        <Gallery images={unit.images} name={unit.name} />

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ------------------------------ Main column ------------------------------ */}
          <div className="min-w-0">
            <header>
              <div className="flex flex-wrap items-center gap-2">
                {unit.property.neighbourhood && (
                  <span className="rounded-full bg-[#0d9488]/10 px-2.5 py-1 text-[11px] font-medium text-[#0d9488]">
                    {unit.property.neighbourhood}
                  </span>
                )}
                {unit.instantBook && (
                  <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-medium text-foreground/70">
                    Instant book
                  </span>
                )}
                {summary.count > 0 && summary.average >= 4.8 && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                    ★ Guest favourite
                  </span>
                )}
              </div>
              <h1 className="mt-2 font-serif text-3xl tracking-tight text-balance sm:text-4xl">
                {unit.name}
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5" />
                {unit.property.name} · {unit.property.addressLine}, {unit.property.city}, Ghana
              </p>
              <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/80">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" /> Sleeps {unit.maxGuests}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="size-4" /> {unit.bedrooms} bedroom{unit.bedrooms === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Bath className="size-4" /> {unit.bathrooms} bath{unit.bathrooms === 1 ? '' : 's'}
                </span>
                {unit.sizeSqm && (
                  <span className="inline-flex items-center gap-1.5">
                    <Ruler className="size-4" /> {unit.sizeSqm} m²
                  </span>
                )}
                {unit.floor !== null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="size-4" /> Floor {unit.floor}
                  </span>
                )}
              </p>
            </header>

            {unit.description && (
              <section className="mt-8">
                <h2 className="font-serif text-xl tracking-tight">About this home</h2>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-foreground/85">
                  {unit.description}
                </p>
              </section>
            )}

            {/* Ghana-specific essentials, always visible */}
            {(unit.backupPower || unit.waterStorageLitres || unit.wifiSpeedMbps || unit.deskSpace) && (
              <section className="mt-8">
                <h2 className="font-serif text-xl tracking-tight">Built for real life in Accra</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {unit.backupPower && unit.backupPower !== 'none' && (
                    <div className="flex items-start gap-3 rounded-xl border border-black/[0.08] bg-white px-4 py-3">
                      <Zap className="mt-0.5 size-4 shrink-0 text-[#0d9488]" />
                      <div>
                        <p className="text-sm font-medium">
                          {unit.backupPower === 'generator' && 'Backup generator'}
                          {unit.backupPower === 'inverter' && 'Inverter backup'}
                          {unit.backupPower === 'solar hybrid' && 'Solar hybrid power'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {unit.generatorKva ? `${unit.generatorKva} kVA · ` : ''}Lights, fans, Wi-Fi and sockets stay on during outages
                        </p>
                      </div>
                    </div>
                  )}
                  {unit.waterStorageLitres ? (
                    <div className="flex items-start gap-3 rounded-xl border border-black/[0.08] bg-white px-4 py-3">
                      <Droplets className="mt-0.5 size-4 shrink-0 text-[#0d9488]" />
                      <div>
                        <p className="text-sm font-medium">{(unit.waterStorageLitres / 1000).toFixed(1)} m³ water storage</p>
                        <p className="text-xs text-muted-foreground">Reserve supply when the flow stops</p>
                      </div>
                    </div>
                  ) : null}
                  {unit.wifiSpeedMbps ? (
                    <div className="flex items-start gap-3 rounded-xl border border-black/[0.08] bg-white px-4 py-3">
                      <Wifi className="mt-0.5 size-4 shrink-0 text-[#0d9488]" />
                      <div>
                        <p className="text-sm font-medium">{unit.wifiSpeedMbps} Mbps verified Wi-Fi</p>
                        <p className="text-xs text-muted-foreground">
                          {unit.deskSpace ? 'Dedicated workspace included' : 'Speed tested on site'}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {unit.securityNotes && (
                    <div className="flex items-start gap-3 rounded-xl border border-black/[0.08] bg-white px-4 py-3">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#0d9488]" />
                      <div>
                        <p className="text-sm font-medium">Security</p>
                        <p className="text-xs text-muted-foreground">{unit.securityNotes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {sleeping.length > 0 && (
              <section className="mt-8">
                <h2 className="font-serif text-xl tracking-tight">Where you&apos;ll sleep</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {sleeping.map((s, i) => (
                    <div key={i} className="rounded-xl border border-black/[0.08] bg-white px-4 py-3">
                      <BedDouble className="mb-1.5 size-4 text-[#0d9488]" />
                      <p className="text-sm font-medium">{s.room}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.bed}
                        {s.count && s.count > 1 ? ` × ${s.count}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {unit.features.length > 0 && (
              <section className="mt-8">
                <h2 className="font-serif text-xl tracking-tight">What this place offers</h2>
                <ul className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {unit.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-foreground/85">
                      <Sparkles className="size-3.5 shrink-0 text-[#0d9488]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-8">
              <h2 className="font-serif text-xl tracking-tight">Availability</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Live calendar — what is free now is genuinely free.
              </p>
              <div className="mt-4 rounded-xl border border-black/[0.08] bg-white p-5">
                <AvailabilityPreview days={calendar} />
              </div>
            </section>

            {/* Reviews */}
            <section className="mt-8">
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-xl tracking-tight">
                  {summary.count > 0 ? (
                    <span className="inline-flex items-center gap-2">
                      <Star className="size-4 fill-[#0d9488] text-[#0d9488]" />
                      {summary.average.toFixed(1)} · {summary.count} review{summary.count === 1 ? '' : 's'}
                    </span>
                  ) : (
                    'Reviews'
                  )}
                </h2>
              </div>

              {summary.count > 0 && Object.keys(summary.subScores).length > 0 && (
                <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {Object.entries(summary.subScores).map(([key, score]) => (
                    <div key={key} className="flex items-center gap-3 text-sm">
                      <span className="w-28 capitalize text-muted-foreground">
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.07]">
                        <span
                          className="block h-full rounded-full bg-[#0d9488]"
                          style={{ width: `${(score / 5) * 100}%` }}
                        />
                      </span>
                      <span className="w-8 text-right tabular-nums">{score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {reviews.slice(0, 6).map((r) => (
                  <article key={r.id} className="rounded-xl border border-black/[0.08] bg-white px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-[#0a0e1a] font-serif text-sm text-white">
                        {(r.authorParty?.name ?? 'G')[0]}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{r.authorParty?.name ?? 'Guest'}</p>
                        <p className="text-xs text-muted-foreground">
                          Stayed {r.reservation.nights} nights · left{' '}
                          {new Date(r.publishedAt ?? r.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`size-3.5 ${i < r.rating ? 'fill-[#0d9488] text-[#0d9488]' : 'text-black/15'}`} />
                      ))}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/85">{r.body}</p>
                    {r.hostResponse && (
                      <div className="mt-3 rounded-lg bg-[#f7f5f0] px-3.5 py-2.5">
                        <p className="text-xs font-semibold text-[#0a0e1a]">Response from ABN Homes</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">{r.hostResponse}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              {summary.count === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Be the first to tell the world about this home — reviews only appear from verified, completed stays.
                </p>
              )}
            </section>

            {/* Location */}
            <section className="mt-8">
              <h2 className="font-serif text-xl tracking-tight">Where you&apos;ll be</h2>
              <p className="mt-3 text-sm text-foreground/85">
                <MapPin className="mr-1.5 inline size-4 text-[#0d9488]" />
                {unit.property.addressLine}, {unit.property.city}
                {unit.property.neighbourhood ? ` (${unit.property.neighbourhood})` : ''}
              </p>
              {unit.property.aboutArea && (
                <p className="mt-2 text-[15px] leading-relaxed text-foreground/85">{unit.property.aboutArea}</p>
              )}
              {unit.transitNotes && (
                <p className="mt-2 text-sm text-muted-foreground">
                  <strong className="font-medium text-foreground/80">Getting around:</strong> {unit.transitNotes}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                The exact pin, gate photos and driver directions are shared in your portal once your booking is confirmed.
              </p>
            </section>

            {/* House rules */}
            {unit.houseRules.length > 0 && (
              <section className="mt-8">
                <h2 className="font-serif text-xl tracking-tight">House rules</h2>
                <ul className="mt-3 space-y-1.5">
                  {unit.houseRules.map((r) => (
                    <li key={r} className="flex items-center gap-2.5 text-sm text-foreground/85">
                      <span className="size-1 rounded-full bg-[#0d9488]" />
                      {r}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Safety */}
            <section className="mt-8">
              <h2 className="font-serif text-xl tracking-tight">Safety &amp; property details</h2>
              <ul className="mt-3 space-y-1.5 text-sm text-foreground/85">
                <li className="flex items-center gap-2.5">
                  <BadgeCheck className={`size-4 ${safety.smokeAlarm ? 'text-[#0d9488]' : 'text-black/20'}`} />
                  Smoke alarm {safety.smokeAlarm ? 'installed' : 'not reported'}
                </li>
                <li className="flex items-center gap-2.5">
                  <BadgeCheck className={`size-4 ${safety.coAlarm ? 'text-[#0d9488]' : 'text-black/20'}`} />
                  Carbon monoxide alarm {safety.coAlarm ? 'installed' : 'not reported'}
                </li>
                <li className="flex items-center gap-2.5">
                  <BadgeCheck className={`size-4 ${safety.fireExtinguisher ? 'text-[#0d9488]' : 'text-black/20'}`} />
                  Fire extinguisher {safety.fireExtinguisher ? 'on site' : 'not reported'}
                </li>
                <li className="flex items-center gap-2.5">
                  <BadgeCheck className={`size-4 ${safety.firstAidKit ? 'text-[#0d9488]' : 'text-black/20'}`} />
                  First aid kit {safety.firstAidKit ? 'on site' : 'not reported'}
                </li>
                {safety.securityCameraNote && <li className="text-muted-foreground">📷 {safety.securityCameraNote}</li>}
                {safety.hazardNote && <li className="text-muted-foreground">⚠️ {safety.hazardNote}</li>}
              </ul>
              {unit.licenseNumber && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Ghana Tourism Authority licence: <span className="font-mono">{unit.licenseNumber}</span>
                </p>
              )}
            </section>

            {/* Host */}
            <section className="mt-8 rounded-xl border border-black/[0.08] bg-white px-5 py-5">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo/abn-badge.png" alt="" className="size-14 rounded-full" />
                <div>
                  <p className="font-serif text-lg tracking-tight">Hosted by ABN Homes</p>
                  <p className="text-xs text-muted-foreground">
                    Owner-operated in Accra · {unit.property.owner?.name ? `Managed for ${unit.property.owner.name}` : 'Direct operator'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/85">
                We are the operator, not a middleman: our own team cleans, maintains and stands
                behind every home. Guests reach us on WhatsApp any hour, and someone local is
                always on call.
              </p>
              <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" /> Responds within the hour, 7am–10pm GMT
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <DoorOpen className="size-3.5" /> {unit.selfCheckIn ? 'Self check-in from' : 'Check-in from'} {unit.checkInFrom ?? '15:00'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Coffee className="size-3.5" /> Checkout by {unit.checkOutUntil ?? '11:00'}
                </span>
              </p>
            </section>

            <p className="mt-6 text-xs text-muted-foreground">
              <Flag className="mr-1 inline size-3" />
              Something wrong with this listing?{' '}
              <a href="mailto:care@abnhomes.com.gh" className="underline underline-offset-2">
                Report it
              </a>{' '}
              — we take every report seriously.
            </p>
          </div>

          {/* ------------------------------ Price box ------------------------------ */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-black/[0.08] bg-white p-6 shadow-lifted">
              {hasDates && quote.nights > 0 ? (
                <>
                  <p className="font-serif text-3xl tracking-tight tabular-nums">
                    {formatMinor(quote.totalMinor, quote.currency)}
                    <span className="ml-1.5 align-middle text-sm font-sans font-normal text-muted-foreground">
                      total · {quote.nights} night{quote.nights === 1 ? '' : 's'}
                    </span>
                  </p>
                  <dl className="mt-4 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <dt>
                        {formatMinor(quote.averageNightlyMinor, quote.currency)} × {quote.nights} night
                        {quote.nights === 1 ? '' : 's'}
                      </dt>
                      <dd className="tabular-nums">{formatMinor(quote.accommodationMinor, quote.currency)}</dd>
                    </div>
                    {quote.cleaningFeeMinor > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <dt>Cleaning fee</dt>
                        <dd className="tabular-nums">{formatMinor(quote.cleaningFeeMinor, quote.currency)}</dd>
                      </div>
                    )}
                    {quote.discountMinor > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <dt>Weekly discount</dt>
                        <dd className="tabular-nums">−{formatMinor(quote.discountMinor, quote.currency)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-black/[0.08] pt-2 font-medium text-foreground">
                      <dt>Total, all in</dt>
                      <dd className="tabular-nums">{formatMinor(quote.totalMinor, quote.currency)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  <p className="font-serif text-3xl tracking-tight tabular-nums">
                    {nightlyFrom ? formatMinor(nightlyFrom, unit.currency) : '—'}
                    <span className="ml-1.5 align-middle text-sm font-sans font-normal text-muted-foreground">
                      / night
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Pick your dates to see the exact total.</p>
                </>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Arrive
                  </span>
                  <input
                    type="date"
                    form="dates"
                    name="checkIn"
                    defaultValue={toISODate(checkIn)}
                    min={toISODate(today())}
                    className="w-full rounded-lg border border-black/12 px-2.5 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Leave
                  </span>
                  <input
                    type="date"
                    form="dates"
                    name="checkOut"
                    defaultValue={toISODate(checkOut)}
                    min={toISODate(addDays(today(), 1))}
                    className="w-full rounded-lg border border-black/12 px-2.5 py-2 text-sm"
                  />
                </label>
              </div>
              <form id="dates" method="GET" action={`/stays/${unit.slug ?? slug}`}>
                <input type="hidden" name="guests" value={guests} />
                <button className="mt-2 w-full rounded-lg border border-black/12 px-3 py-2 text-sm font-medium transition hover:bg-black/[0.03]">
                  Update price
                </button>
              </form>

              <Link
                href={bookUrl}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d9488] px-4 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-[#0f8578]"
              >
                {unit.instantBook ? 'Book instantly' : 'Request to book'}
                <ArrowRight className="size-4" />
              </Link>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                Free cancellation until {formatDate(freeUntil)} · 50% refund until {formatDate(halfUntil)}
              </p>
            </div>

            <p className="mt-3 px-2 text-center text-[11px] text-muted-foreground">
              Wi-Fi{unit.wifiPassword ? ' details' : ''}, door codes and the house manual are released in your
              guest portal 24 hours before check-in.
            </p>
          </aside>
        </div>

        {/* Similar homes */}
        {similar.length > 0 && (
          <section className="mt-16">
            <h2 className="font-serif text-2xl tracking-tight">Similar homes in Accra</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              {similar.map((s) => (
                <Link
                  key={s.id}
                  href={`/stays/${unitSlug(s, s.property)}`}
                  className="group overflow-hidden rounded-xl border border-black/[0.08] bg-white transition hover:shadow-lifted"
                >
                  <div className="relative aspect-[4/3] bg-black/5">
                    {s.images[0] && (
                      <Image src={s.images[0]} alt={s.name} fill sizes="33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-serif tracking-tight">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.property.neighbourhood ?? s.property.city} · sleeps {s.maxGuests}
                    </p>
                    {s.baseNightlyMinor && (
                      <p className="mt-1.5 text-sm tabular-nums">
                        <strong className="font-semibold">{formatMinor(s.baseNightlyMinor, s.currency)}</strong>{' '}
                        <span className="text-xs text-muted-foreground">/ night</span>
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
