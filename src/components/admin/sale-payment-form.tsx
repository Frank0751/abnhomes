'use client'

/**
 * Payment capture and handover for a contracted sale.
 *
 * Recording money reuses the platform's money:record permission and receipt
 * pipeline — a purchase payment is a rent payment with different paperwork.
 * Handover refuses to run while a balance remains; that check lives in the
 * engine, not in this interface.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2, Receipt } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMinor } from '@/lib/core/money'
import type { Currency } from '@prisma/client'
import { completePurchaseAction, recordPurchasePaymentAction } from '@/app/admin/sales/actions'

const labelCls = 'mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'
const inputCls = 'w-full rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm outline-none transition focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20'

export function SalePaymentForm({
  purchaseId,
  suggestedAmountMinor,
  currency,
}: {
  purchaseId: string
  suggestedAmountMinor: number | null
  currency: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(suggestedAmountMinor ? (suggestedAmountMinor / 100).toFixed(2) : '')
  const [channel, setChannel] = useState('BANK_TRANSFER')
  const [reference, setReference] = useState('')

  const submit = () =>
    startTransition(async () => {
      const result = await recordPurchasePaymentAction(purchaseId, Number(amount), channel as 'BANK_TRANSFER', reference)
      if (result.ok) {
        toast({ title: result.message })
        router.refresh()
      } else {
        toast({ title: 'Not recorded', description: result.error, variant: 'destructive' })
      }
    })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className={labelCls}>Amount ({currency})</span>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={1} step={100} required />
        </label>
        <label className="block">
          <span className={labelCls}>Channel</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="MOMO_MTN">MTN MoMo</option>
            <option value="MOMO_TELECEL">Telecel Cash</option>
            <option value="MOMO_AIRTELTIGO">AirtelTigo</option>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Reference</span>
        <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank slip / MoMo ref (optional)" />
      </label>
      <Button onClick={submit} disabled={pending} className="w-full bg-[#0d9488] hover:bg-[#0f766e]">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
        Record payment &amp; issue receipt
      </Button>
    </div>
  )
}

export function CompleteSaleButton({
  purchaseId,
  outstandingMinor,
  currency,
}: {
  purchaseId: string
  outstandingMinor: number
  currency: string
}) {
  const router = useRouter()
  const disabled = outstandingMinor > 0

  async function onComplete() {
    if (disabled) return
    const result = await completePurchaseAction(purchaseId)
    if (result.ok) {
      toast({ title: result.message })
      router.refresh()
    } else {
      toast({ title: 'Handover blocked', description: result.error, variant: 'destructive' })
    }
  }

  return (
    <div>
      <Button
        onClick={onComplete}
        disabled={disabled}
        className="w-full bg-[#0a0e1a] hover:bg-[#1a2233]"
        title={disabled ? 'Settle the balance first' : 'Mark as sold and hand over'}
      >
        <KeyRound className="size-4" />
        Complete sale &amp; hand over keys
      </Button>
      <p className={`mt-2 text-xs ${disabled ? 'text-muted-foreground' : 'text-[#0f766e]'}`}>
        {disabled
          ? `Blocked until the outstanding ${formatMinor(outstandingMinor, currency as Currency)} is settled — the engine enforces this, not the UI.`
          : 'Everything is settled. This marks the unit SOLD, withdraws it from /own and closes the journey.'}
      </p>
    </div>
  )
}
