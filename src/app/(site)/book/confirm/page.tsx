import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { quoteFromUnit } from '@/lib/short-stay/pricing'
import { isUnitAvailable } from '@/lib/short-stay/availability'
import { dateOnly, formatDate } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import { BookingRequestForm } from './booking-request-form'

export const metadata: Metadata = {
  title: 'Confirm your stay',
  robots: { index: false, follow: false },
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    unitId?: string
    checkIn?: string
    checkOut?: string
    guests?: string
  }>
}) {
  const params = await searchParams
  if (!params.unitId || !params.checkIn || !params.checkOut) notFound()

  const checkIn = dateOnly(params.checkIn)
  const checkOut = dateOnly(params.checkOut)
  const guests = Number(params.guests ?? 2) || 2

  const unit = await db.unit.findFirst({
    where: { id: params.unitId, published: true, property: { published: true } },
    include: {
      property: { select: { name: true, addressLine: true, city: true } },
      ratePlans: { where: { active: true } },
    },
  })
  if (!unit) notFound()

  const quote = quoteFromUnit(unit, { checkIn, checkOut, guests })
  const stillFree = await isUnitAvailable({ unitId: unit.id, checkIn, checkOut })

  return (
    <main className="pt-28 pb-24">
      <div className="mx-auto max-w-3xl px-5">
        <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">Confirm your stay</h1>

        <div className="mt-8 grid gap-8 sm:grid-cols-[1fr_1.2fr]">
          <aside>
            <div className="overflow-hidden rounded border border-black/10 bg-white">
              {unit.images[0] && (
                <div className="relative aspect-[4/3]">
                  <Image
                    src={unit.images[0]}
                    alt={unit.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
              )}

              <div className="space-y-3 p-4">
                <div>
                  <h2 className="font-serif text-lg tracking-tight">{unit.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {unit.property.addressLine}, {unit.property.city}
                  </p>
                </div>

                <dl className="space-y-1.5 border-t border-black/8 pt-3 text-sm">
                  <Row label="Arrive" value={formatDate(checkIn)} />
                  <Row label="Leave" value={formatDate(checkOut)} />
                  <Row label="Guests" value={String(guests)} />
                  <Row
                    label={`${quote.nights} night${quote.nights === 1 ? '' : 's'}`}
                    value={formatMinor(quote.accommodationMinor, quote.currency)}
                  />
                  {quote.cleaningFeeMinor > 0 && (
                    <Row
                      label="Cleaning"
                      value={formatMinor(quote.cleaningFeeMinor, quote.currency)}
                    />
                  )}
                </dl>

                <div className="flex items-baseline justify-between border-t border-black/8 pt-3">
                  <span className="text-sm font-medium">Total</span>
                  <span className="font-serif text-2xl tabular-nums">
                    {formatMinor(quote.totalMinor, quote.currency, { showCurrencyCode: true })}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          <div>
            {!stillFree ? (
              <div className="rounded border border-amber-300 bg-amber-50/70 px-5 py-6">
                <p className="font-serif text-lg tracking-tight text-amber-900">
                  Those dates have just gone
                </p>
                <p className="mt-2 text-sm text-amber-900/80">
                  Someone booked them while you were deciding. Search again for different dates, or
                  call us on{' '}
                  <a href="tel:+233541704048" className="underline underline-offset-2">
                    054 170 4048
                  </a>
                  .
                </p>
              </div>
            ) : (
              <BookingRequestForm
                unitId={unit.id}
                checkIn={params.checkIn}
                checkOut={params.checkOut}
                guests={guests}
                totalLabel={formatMinor(quote.totalMinor, quote.currency)}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
