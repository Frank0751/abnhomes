'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { createExpenseAction, approveExpenseAction } from './actions'

type ActionResult = { ok: true; message: string } | { ok: false; error: string }
type Action = (formData: FormData) => Promise<ActionResult>

const inputClass =
  'w-full rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm focus:border-[#0d9488] focus:outline-none'
const labelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'

export function ExpenseForm({
  properties,
  vendors,
  action,
}: {
  properties: { id: string; name: string }[]
  vendors: { id: string; name: string }[]
  action: Action
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const submit = (formData: FormData) =>
    start(async () => {
      const result = await action(formData)
      if (result.ok) {
        toast({ title: result.message })
        router.refresh()
      } else {
        toast({ title: 'Not saved', description: result.error, variant: 'destructive' })
      }
    })

  return (
    <form action={submit} className="space-y-3 px-5 py-4">
      <label className="block">
        <span className={labelClass}>Property</span>
        <select name="propertyId" required className={inputClass}>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>Description</span>
        <input name="description" required placeholder="Diesel refill for the generator" className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Category</span>
          <select name="category" className={inputClass} defaultValue="MAINTENANCE">
            {['CLEANING', 'MAINTENANCE', 'UTILITIES', 'SUPPLIES', 'MARKETING', 'INSURANCE', 'TAX', 'OTHER'].map((c) => (
              <option key={c} value={c}>
                {c.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Vendor (optional)</span>
          <select name="vendorPartyId" className={inputClass}>
            <option value="">—</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Amount</span>
          <input name="amount" required inputMode="decimal" placeholder="350.00" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Currency</span>
          <select name="currency" className={inputClass} defaultValue="GHS">
            <option value="GHS">GHS</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>Date incurred</span>
        <input name="incurredAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#0a0e1a] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#1a2233] disabled:opacity-60"
      >
        {pending && <Loader2 className="mr-1.5 inline size-3.5 animate-spin" />}
        Record expense
      </button>
    </form>
  )
}

export function ApproveButton({ expenseId, action }: { expenseId: string; action: (id: string) => Promise<ActionResult> }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const run = () =>
    start(async () => {
      const result = await action(expenseId)
      if (result.ok) {
        toast({ title: result.message })
        router.refresh()
      } else {
        toast({ title: 'Not approved', description: result.error, variant: 'destructive' })
      }
    })

  return (
    <button
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0f8578] disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
      Approve &amp; post
    </button>
  )
}
