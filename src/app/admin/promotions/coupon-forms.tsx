'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { Loader2, Pause, Play } from 'lucide-react'
import { createCouponAction, toggleCouponAction } from './actions'

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

const inputClass =
  'w-full rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm focus:border-[#0d9488] focus:outline-none'
const labelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'

export function CouponForm({ action }: { action: (formData: FormData) => Promise<ActionResult> }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const submit = (formData: FormData) =>
    start(async () => {
      const result = await action(formData)
      if (result.ok) {
        toast({ title: result.message })
        router.refresh()
      } else {
        toast({ title: 'Not created', description: result.error, variant: 'destructive' })
      }
    })

  return (
    <form action={submit} className="space-y-3 px-5 py-4">
      <label className="block">
        <span className={labelClass}>Code</span>
        <input name="code" required placeholder="WELCOME10" className={`${inputClass} uppercase tracking-wide`} />
      </label>
      <label className="block">
        <span className={labelClass}>Type</span>
        <select name="kind" className={inputClass} defaultValue="PERCENT">
          <option value="PERCENT">Percentage off</option>
          <option value="FIXED">Fixed amount off</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Percent (%)</span>
          <input name="percent" inputMode="decimal" placeholder="10" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Or fixed amount</span>
          <input name="amount" inputMode="decimal" placeholder="50.00" className={inputClass} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Currency</span>
          <select name="currency" className={inputClass} defaultValue="USD">
            <option value="USD">USD</option>
            <option value="GHS">GHS</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Min spend</span>
          <input name="minSpend" inputMode="decimal" placeholder="0" className={inputClass} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Cap discount at</span>
          <input name="maxDiscount" inputMode="decimal" placeholder="No cap" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Max redemptions</span>
          <input name="maxRedemptions" type="number" min={1} placeholder="Unlimited" className={inputClass} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Starts</span>
          <input name="startsAt" type="date" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Ends</span>
          <input name="endsAt" type="date" className={inputClass} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="firstBookingOnly" className="accent-[#0d9488]" />
        First booking only
      </label>
      <label className="block">
        <span className={labelClass}>Note</span>
        <input name="note" placeholder="What is this campaign for?" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#0a0e1a] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#1a2233] disabled:opacity-60"
      >
        {pending && <Loader2 className="mr-1.5 inline size-3.5 animate-spin" />}
        Create coupon
      </button>
    </form>
  )
}

export function CouponToggle({ id, active, action }: { id: string; active: boolean; action: (id: string) => Promise<ActionResult> }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const run = () =>
    start(async () => {
      const result = await action(id)
      if (result.ok) {
        toast({ title: result.message })
        router.refresh()
      } else {
        toast({ title: 'Not changed', description: result.error, variant: 'destructive' })
      }
    })

  return (
    <button
      onClick={run}
      disabled={pending}
      aria-label={active ? 'Pause coupon' : 'Resume coupon'}
      className="rounded-md border border-black/10 p-1.5 text-muted-foreground transition hover:bg-black/5"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
    </button>
  )
}
