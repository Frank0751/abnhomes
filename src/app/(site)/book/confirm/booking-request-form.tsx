'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { applyCouponAction, requestBookingAction, type BookingResult } from '../actions'
import { formatMinor } from '@/lib/core/money'
import type { Currency } from '@prisma/client'
import { CheckCircle2, Loader2, Tag, Plus, Minus, Sparkles } from 'lucide-react'

type AddOnOption = {
  id: string
  name: string
  description: string
  priceMinor: number
  currency: Currency
  maxQty: number
}

const ARRIVAL_TIMES = [
  'Not sure yet',
  'Morning (before 12:00)',
  'Afternoon (12:00–15:00)',
  'Standard check-in (15:00–18:00)',
  'Evening (18:00–21:00)',
  'Late arrival (after 21:00)',
]

export function BookingRequestForm({
  unitId,
  checkIn,
  checkOut,
  guests,
  currency,
  baseTotalMinor,
  addOns,
}: {
  unitId: string
  checkIn: string
  checkOut: string
  guests: number
  currency: Currency
  baseTotalMinor: number
  addOns: AddOnOption[]
}) {
  const [state, formAction, pending] = useActionState<BookingResult | null, FormData>(
    requestBookingAction,
    null
  )

  const [selected, setSelected] = useState<Record<string, number>>({})
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState<{ label: string; discountMinor: number } | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)

  const addOnsTotal = addOns.reduce((sum, a) => sum + (selected[a.id] ?? 0) * a.priceMinor, 0)
  const discount = coupon?.discountMinor ?? 0
  const total = Math.max(0, baseTotalMinor + addOnsTotal - discount)

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setCheckingCoupon(true)
    setCouponError(null)
    try {
      const result = await applyCouponAction({ code: couponCode, unitId, checkIn, checkOut, guests })
      if (result.ok) {
        setCoupon({ label: result.label, discountMinor: result.discountMinor })
      } else {
        setCoupon(null)
        setCouponError(result.error)
      }
    } finally {
      setCheckingCoupon(false)
    }
  }

  const bump = (id: string, delta: number, max: number) => {
    setSelected((prev) => {
      const next = Math.max(0, Math.min((prev[id] ?? 0) + delta, max))
      const copy = { ...prev }
      if (next === 0) delete copy[id]
      else copy[id] = next
      return copy
    })
  }

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-6 py-7">
        <CheckCircle2 className="size-7 text-emerald-700" />
        <p className="mt-3 font-serif text-2xl tracking-tight text-emerald-950">
          Your dates are held
        </p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-950/80">
          Reference <strong className="font-mono">{state.code}</strong>. We have emailed your
          confirmation and texted the same details to your phone. Pay now to confirm instantly —
          mobile money and cards both work, and you can pay just the one-night deposit if you
          prefer.
        </p>
        <Link
          href={state.payUrl}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#0d9488] px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-[#0f8578]"
        >
          Pay {formatMinor(state.totalMinor, state.currency as never)} securely →
        </Link>
        <p className="mt-3 text-xs text-emerald-950/70">
          The hold lasts 48 hours. Questions? Call or WhatsApp{' '}
          <a href="https://wa.me/233541704048" className="underline underline-offset-2">
            054 170 4048
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />
      <input type="hidden" name="guests" value={guests} />
      <input
        type="hidden"
        name="addOns"
        value={JSON.stringify(Object.entries(selected).map(([id, qty]) => ({ id, qty })))}
      />
      <input type="hidden" name="couponCode" value={coupon?.label ? couponCode : ''} />

      {/* ------------------------------------------------------------ guest */}
      <fieldset className="space-y-4 rounded-xl border border-black/[0.08] bg-white p-5 shadow-soft">
        <legend className="px-1 font-serif text-lg tracking-tight">Your details</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Full name (as on ID)
            </span>
            <input
              name="name"
              required
              autoComplete="name"
              className="w-full rounded-lg border border-black/12 px-3 py-2.5 text-sm focus:border-[#0d9488] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Phone (WhatsApp if possible)
            </span>
            <input
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="024 170 4048 · or +44 … from abroad"
              className="w-full rounded-lg border border-black/12 px-3 py-2.5 text-sm focus:border-[#0d9488] focus:outline-none"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Email — confirmations and receipts go here
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-black/12 px-3 py-2.5 text-sm focus:border-[#0d9488] focus:outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Arrival time
            </span>
            <select
              name="arrivalTime"
              className="w-full rounded-lg border border-black/12 bg-white px-3 py-2.5 text-sm"
              defaultValue={ARRIVAL_TIMES[0]}
            >
              {ARRIVAL_TIMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <fieldset className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Purpose of trip
            </span>
            <div className="flex gap-2">
              {['LEISURE', 'BUSINESS', 'RELOCATION'].map((p, i) => (
                <label
                  key={p}
                  className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-black/12 px-2 py-2.5 text-xs font-medium has-checked:border-[#0d9488] has-checked:bg-[#0d9488]/[0.07] has-checked:text-[#0d9488]"
                >
                  <input
                    type="radio"
                    name="purpose"
                    value={p}
                    defaultChecked={i === 0}
                    className="sr-only"
                  />
                  {p[0] + p.slice(1).toLowerCase()}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Anything we should know <span className="normal-case font-normal">(optional)</span>
          </span>
          <textarea
            name="notes"
            rows={2}
            placeholder="Flight number, dietary needs, a friend joining late…"
            className="w-full resize-none rounded-lg border border-black/12 px-3 py-2.5 text-sm focus:border-[#0d9488] focus:outline-none"
          />
        </label>
      </fieldset>

      {/* ------------------------------------------------------------ extras */}
      {addOns.length > 0 && (
        <fieldset className="rounded-xl border border-black/[0.08] bg-white p-5 shadow-soft">
          <legend className="px-1 font-serif text-lg tracking-tight">Make it easy on yourself</legend>
          <p className="mb-3 text-xs text-muted-foreground">
            Optional extras, priced in {currency}. You can also add these later from your portal.
          </p>
          <div className="space-y-2.5">
            {addOns.map((a) => {
              const qty = selected[a.id] ?? 0
              return (
                <div
                  key={a.id}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                    qty > 0 ? 'border-[#0d9488] bg-[#0d9488]/[0.05]' : 'border-black/10'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{a.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-sm tabular-nums text-foreground/80">
                      {formatMinor(a.priceMinor, a.currency)}
                    </span>
                    {a.maxQty > 1 ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => bump(a.id, -1, a.maxQty)}
                          className="rounded border border-black/10 p-1 disabled:opacity-30"
                          disabled={qty === 0}
                          aria-label={`Remove ${a.name}`}
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-4 text-center text-sm tabular-nums">{qty}</span>
                        <button
                          type="button"
                          onClick={() => bump(a.id, 1, a.maxQty)}
                          className="rounded border border-black/10 p-1 disabled:opacity-30"
                          disabled={qty >= a.maxQty}
                          aria-label={`Add ${a.name}`}
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => bump(a.id, qty > 0 ? -1 : 1, 1)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          qty > 0 ? 'bg-[#0d9488] text-white' : 'border border-black/15 hover:bg-black/5'
                        }`}
                      >
                        {qty > 0 ? 'Added ✓' : 'Add'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </fieldset>
      )}

      {/* ------------------------------------------------------------ promo */}
      <fieldset className="rounded-xl border border-black/[0.08] bg-white p-5 shadow-soft">
        <legend className="px-1 font-serif text-lg tracking-tight">Promo code</legend>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="e.g. WELCOME10"
              className="w-full rounded-lg border border-black/12 py-2.5 pl-9 pr-3 text-sm uppercase tracking-wide focus:border-[#0d9488] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={applyCoupon}
            disabled={checkingCoupon || !couponCode.trim()}
            className="rounded-lg bg-[#0a0e1a] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a2233] disabled:opacity-50"
          >
            {checkingCoupon ? <Loader2 className="size-4 animate-spin" /> : 'Apply'}
          </button>
        </div>
        {coupon && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700">
            <Sparkles className="size-3.5" />
            {coupon.label} applied — you save {formatMinor(coupon.discountMinor, currency)}
          </p>
        )}
        {couponError && <p className="mt-2 text-sm text-red-700">{couponError}</p>}
      </fieldset>

      {/* ------------------------------------------------------------ total */}
      <div className="rounded-xl border border-black/[0.08] bg-white p-5 shadow-soft">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Stay + cleaning</dt>
            <dd className="tabular-nums">{formatMinor(baseTotalMinor, currency)}</dd>
          </div>
          {addOnsTotal > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Extras</dt>
              <dd className="tabular-nums">{formatMinor(addOnsTotal, currency)}</dd>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <dt>Promo {coupon?.label ? `(${coupon.label})` : ''}</dt>
              <dd className="tabular-nums">−{formatMinor(discount, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-black/8 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMinor(total, currency)}</dd>
          </div>
        </dl>
      </div>

      {/* ------------------------------------------------------------ consents */}
      <fieldset className="space-y-2.5 rounded-xl border border-black/[0.08] bg-white p-5 text-sm shadow-soft">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" name="consentRules" className="mt-0.5 accent-[#0d9488]" />
          <span className="text-foreground/85">
            I accept the house rules of the home (no smoking indoors, quiet hours 22:00–06:00,
            registered guests only).
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" name="consentTerms" className="mt-0.5 accent-[#0d9488]" />
          <span className="text-foreground/85">
            I accept the terms of service and cancellation policy — free cancellation until 7 days
            before arrival, 50% until 48 hours, non-refundable after.
          </span>
        </label>
      </fieldset>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d9488] px-4 py-4 text-[15px] font-semibold text-white shadow-soft transition hover:bg-[#0f8578] disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? 'Holding your dates…' : `Hold these dates — pay ${formatMinor(total, currency)}`}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Nothing is charged now. Your dates are held for 48 hours; pay on your own schedule.
      </p>
    </form>
  )
}
