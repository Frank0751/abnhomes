'use client'

import { useActionState, useState } from 'react'
import { Lock, Wallet, CreditCard, Building2 } from 'lucide-react'
import { formatMinor } from '@/lib/core/money'
import type { Currency } from '@prisma/client'
import { startReservationPaymentAction, type PayResult } from './actions'

const CHANNELS = [
  { value: 'MOMO_MTN', label: 'MTN Mobile Money', hint: 'Approve the prompt on your phone', icon: Wallet },
  { value: 'MOMO_TELECEL', label: 'Telecel Cash', hint: 'Approve the prompt on your phone', icon: Wallet },
  { value: 'MOMO_AIRTELTIGO', label: 'AirtelTigo Money', hint: 'Approve the prompt on your phone', icon: Wallet },
  { value: 'CARD', label: 'Visa / Mastercard', hint: 'Pay from Ghana or abroad', icon: CreditCard },
  { value: 'BANK_TRANSFER', label: 'Bank transfer', hint: 'Transfer details shown at checkout', icon: Building2 },
]

export function PayForm({
  reservationId,
  currency,
  balanceMinor,
  depositMinor,
  needsPhone,
  suggestedPhone,
}: {
  reservationId: string
  currency: Currency
  balanceMinor: number
  depositMinor: number
  needsPhone: boolean
  suggestedPhone: string
}) {
  const [state, formAction, pending] = useActionState<PayResult, FormData>(startReservationPaymentAction, undefined)
  const [channel, setChannel] = useState('MOMO_MTN')
  const isMomo = channel.startsWith('MOMO')
  const showDeposit = depositMinor > 0

  return (
    <form action={formAction} className="px-6 py-5">
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="channel" value={channel} />

      <fieldset className="mb-4">
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a93a5]">
          Choose how to pay
        </legend>
        <div className="grid gap-2">
          {CHANNELS.map((c) => {
            const Icon = c.icon
            const active = channel === c.value
            return (
              <button
                type="button"
                key={c.value}
                onClick={() => setChannel(c.value)}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                  active ? 'border-[#0d9488] bg-[#0d9488]/[0.06] ring-1 ring-[#0d9488]' : 'border-black/10 hover:border-black/20'
                }`}
              >
                <Icon className={`size-4 shrink-0 ${active ? 'text-[#0d9488]' : 'text-[#8a93a5]'}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#0a0e1a]">{c.label}</span>
                  <span className="block text-xs text-[#8a93a5]">{c.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {isMomo && (
        <label className="mb-4 block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a93a5]">
            Mobile money number
          </span>
          <input
            name="phone"
            inputMode="tel"
            required
            defaultValue={needsPhone ? '' : suggestedPhone}
            placeholder="e.g. 024 123 4567"
            className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm focus:border-[#0d9488] focus:outline-none focus:ring-1 focus:ring-[#0d9488]"
          />
        </label>
      )}

      {showDeposit && (
        <fieldset className="mb-4">
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a93a5]">
            Amount
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-black/10 px-3.5 py-3 has-checked:border-[#0d9488] has-checked:bg-[#0d9488]/[0.06] has-checked:ring-1 has-checked:ring-[#0d9488]">
              <input type="radio" name="mode" value="FULL" defaultChecked className="mt-0.5 accent-[#0d9488]" />
              <span>
                <span className="block text-sm font-medium">Pay in full</span>
                <span className="block text-xs text-[#8a93a5]">{formatMinor(balanceMinor, currency)}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-black/10 px-3.5 py-3 has-checked:border-[#0d9488] has-checked:bg-[#0d9488]/[0.06] has-checked:ring-1 has-checked:ring-[#0d9488]">
              <input type="radio" name="mode" value="DEPOSIT" className="mt-0.5 accent-[#0d9488]" />
              <span>
                <span className="block text-sm font-medium">Deposit only</span>
                <span className="block text-xs text-[#8a93a5]">{formatMinor(depositMinor, currency)} — balance on arrival</span>
              </span>
            </label>
          </div>
        </fieldset>
      )}

      {!showDeposit && <input type="hidden" name="mode" value="FULL" />}

      {state?.ok === false && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d9488] px-4 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-[#0f8578] disabled:opacity-60"
      >
        <Lock className="size-4" />
        {pending ? 'Starting secure checkout…' : `Pay ${formatMinor(balanceMinor, currency)} securely`}
      </button>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-[#8a93a5]">
        You will be taken to Paystack's secure checkout. Card details never touch our servers.
      </p>
    </form>
  )
}
