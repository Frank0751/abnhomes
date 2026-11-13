'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BadgeCheck,
  Calculator,
  CheckCircle2,
  Copy,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { applyToBuyAction, type ApplyResult } from '@/app/(site)/own/actions'
import { applyToRentAction, type RentApplyResult } from '@/app/(site)/rent/actions'
import { useI18n } from '@/components/site/i18n'

const inputCls =
  'w-full rounded-lg border border-black/12 bg-white px-3.5 py-2.5 text-[15px] outline-none transition focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20'
const labelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b6472]'

function TrackingSuccess({ code, what }: { code: string; what: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useI18n()
  return (
    <div className="rounded-2xl border border-[#0d9488]/30 bg-white p-8 text-center shadow-soft">
      <CheckCircle2 className="mx-auto mb-4 size-12 text-[#0d9488]" />
      <h3 className="font-serif text-2xl text-[#1a1f2e]">{t('apply.successIn').replace('{what}', what)}</h3>
      <p className="mt-2 text-sm text-[#5b6472]">
        {t('apply.keepCode')}
      </p>
      <div className="mx-auto mt-6 flex max-w-xs items-center justify-center gap-3 rounded-xl bg-[#0a0e1a] px-5 py-4">
        <span className="font-mono text-2xl font-semibold tracking-[0.18em] text-[#14b8a6]">{code}</span>
        <button
          type="button"
          aria-label="Copy tracking code"
          className="rounded p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          onClick={() => {
            navigator.clipboard?.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          }}
        >
          <Copy className="size-4" />
        </button>
      </div>
      {copied && <p className="mt-2 text-xs text-[#0d9488]">{t('apply.copied')}</p>}
      <Link
        href={`/track/${code}`}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0d9488] px-6 py-3 text-sm font-semibold tracking-[0.08em] text-white uppercase transition hover:bg-[#0f766e]"
      >
        {t('apply.track')}
      </Link>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  )
}

/** Apply-to-buy form. On success it hands the buyer their OWN-… tracking code. */
export function BuyForm({ unitId, priceLabel }: { unitId: string; priceLabel: string }) {
  const [state, formAction, pending] = useActionState<ApplyResult | null, FormData>(applyToBuyAction, null)
  const { t } = useI18n()

  if (state?.ok) return <TrackingSuccess code={state.code} what={t('apply.whatOffer')} />

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="unitId" value={unitId} />
      {/* Honeypot — visually and programatically hidden from humans. */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="buy-name">{t('apply.fullName')}</label>
          <input id="buy-name" name="name" required minLength={2} placeholder="Ama Serwaa" className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="buy-phone">{t('apply.phone')}</label>
          <input id="buy-phone" name="phone" required inputMode="tel" placeholder="024 170 4048" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="buy-email">{t('apply.email')} <span className="font-normal normal-case text-black/40">{t('apply.optional')}</span></label>
        <input id="buy-email" name="email" type="email" placeholder="you@example.com" className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="buy-notes">{t('apply.anythingWeShouldKnow')} <span className="font-normal normal-case text-black/40">{t('apply.optional')}</span></label>
        <textarea id="buy-notes" name="notes" rows={3} placeholder="Preferred payment plan, mortgage bank, questions…" className={inputCls} />
      </div>

      {state && !state.ok && <ErrorBanner message={state.error} />}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a0e1a] px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#1a2233] disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {t('apply.buy')} {priceLabel ? `· ${priceLabel}` : ''}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-[#5b6472]">
        <ShieldCheck className="size-3.5 text-[#0d9488]" />
        {t('apply.buyNoPayment')}
      </p>
    </form>
  )
}

/** Apply-to-rent form. On success it hands the applicant their RNT-… code. */
export function RentForm({ unitId, rentLabel }: { unitId: string; rentLabel: string }) {
  const [state, formAction, pending] = useActionState<RentApplyResult | null, FormData>(applyToRentAction, null)
  const { t } = useI18n()

  if (state?.ok) return <TrackingSuccess code={state.code} what={t('apply.whatApplication')} />

  const minMoveIn = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="unitId" value={unitId} />
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="rent-name">{t('apply.fullName')}</label>
          <input id="rent-name" name="name" required minLength={2} placeholder="Yaw Mensah" className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="rent-phone">{t('apply.phone')}</label>
          <input id="rent-phone" name="phone" required inputMode="tel" placeholder="024 170 4048" className={inputCls} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="rent-email">{t('apply.email')} <span className="font-normal normal-case text-black/40">{t('apply.optional')}</span></label>
          <input id="rent-email" name="email" type="email" placeholder="you@example.com" className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="rent-ghana">{t('apply.ghanaCard')} <span className="font-normal normal-case text-black/40">{t('apply.optional')}</span></label>
          <input id="rent-ghana" name="ghanaCard" placeholder="GHA-123456789-0" className={inputCls} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="rent-movein">{t('apply.moveIn')}</label>
          <input id="rent-movein" name="moveIn" type="date" required min={minMoveIn} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="rent-months">{t('apply.leaseLength')}</label>
          <select id="rent-months" name="months" defaultValue="12" className={inputCls}>
            {[6, 12, 18, 24, 36].map((m) => (
              <option key={m} value={m}>
                {m} {t('apply.months')}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="rent-employer">{t('apply.employer')} <span className="font-normal normal-case text-black/40">{t('apply.optional')}</span></label>
        <input id="rent-employer" name="employer" placeholder="Where your rent comes from" className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="rent-notes">{t('apply.anythingElse')} <span className="font-normal normal-case text-black/40">{t('apply.optional')}</span></label>
        <textarea id="rent-notes" name="notes" rows={3} placeholder="Furnishing needs, family size, questions…" className={inputCls} />
      </div>

      {state && !state.ok && <ErrorBanner message={state.error} />}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a0e1a] px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#1a2233] disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {t('apply.rent')} {rentLabel ? `· ${rentLabel}` : ''}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-[#5b6472]">
        <ShieldCheck className="size-3.5 text-[#0d9488]" />
        {t('apply.rentFree')}
      </p>
    </form>
  )
}

/**
 * Payment-plan calculator. Pure arithmetic on the asking price: a deposit,
 * a number of monthly installments, and the resulting schedule preview.
 * Nothing is saved — the real plan is agreed with staff at contracting.
 */
export function PurchaseCalculator({ priceMinor, currency }: { priceMinor: number; currency: 'GHS' | 'USD' }) {
  const [depositPct, setDepositPct] = useState(20)
  const [months, setMonths] = useState(24)
  const { t } = useI18n()

  const { deposit, installment, total } = useMemo(() => {
    const deposit = Math.round((priceMinor * depositPct) / 100)
    const balance = priceMinor - deposit
    const installment = months > 0 ? Math.ceil(balance / months) : balance
    return { deposit, installment, total: deposit + installment * months }
  }, [priceMinor, depositPct, months])

  const symbol = currency === 'GHS' ? 'GH₵' : '$'
  const fmt = (minor: number) => `${symbol} ${Math.round(minor / 100).toLocaleString('en-US')}`

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-6 shadow-soft">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[#0d9488]/10">
          <Calculator className="size-5 text-[#0d9488]" />
        </span>
        <div>
          <h3 className="font-serif text-lg leading-tight text-[#1a1f2e]">{t('calc.title')}</h3>
          <p className="text-xs text-[#5b6472]">{t('calc.note')}</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="calc-deposit">
            {t('calc.deposit')}: <span className="font-bold text-[#1a1f2e]">{depositPct}%</span>
          </label>
          <input
            id="calc-deposit"
            type="range"
            min={10}
            max={70}
            step={5}
            value={depositPct}
            onChange={(e) => setDepositPct(Number(e.target.value))}
            className="w-full accent-[#0d9488]"
          />
          <p className="mt-1 text-xs text-[#5b6472]">{t('calc.depositNote')}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="calc-months">
            {t('calc.spreadOver')}: <span className="font-bold text-[#1a1f2e]">{months} {t('calc.monthsWord')}</span>
          </label>
          <input
            id="calc-months"
            type="range"
            min={6}
            max={60}
            step={6}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="w-full accent-[#0d9488]"
          />
          <p className="mt-1 text-xs text-[#5b6472]">{t('calc.termNote')}</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-3 rounded-xl bg-[#faf8f3] p-4 text-center">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5b6472]">{t('calc.deposit')}</dt>
          <dd className="mt-1 font-serif text-lg text-[#1a1f2e]">{fmt(deposit)}</dd>
        </div>
        <div className="border-x border-black/8">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5b6472]">{t('calc.monthly')}</dt>
          <dd className="mt-1 font-serif text-lg text-[#0d9488]">{fmt(installment)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5b6472]">{t('calc.total')}</dt>
          <dd className="mt-1 font-serif text-lg text-[#1a1f2e]">{fmt(total)}</dd>
        </div>
      </dl>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-[#5b6472]">
        <BadgeCheck className="size-3.5 text-[#0d9488]" />
        {t('calc.zeroInterest')}
      </p>
    </div>
  )
}
