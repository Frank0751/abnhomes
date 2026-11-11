'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { Loader2, Pause, Play } from 'lucide-react'
import { createAssetAction, createScheduleAction, toggleScheduleAction } from './actions'

type ActionResult = { ok: true; message: string } | { ok: false; error: string }
type Action = (formData: FormData) => Promise<ActionResult>

const inputClass =
  'w-full rounded-lg border border-black/12 bg-white px-2.5 py-2 text-sm focus:border-[#0d9488] focus:outline-none'
const labelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'

export function AssetForm({ properties, action }: { properties: { id: string; name: string }[]; action: Action }) {
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
        <span className={labelClass}>Name</span>
        <input name="name" required placeholder="Standby generator" className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Category</span>
          <input name="category" placeholder="Power" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Brand</span>
          <input name="brand" placeholder="Perkins" className={inputClass} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Serial</span>
          <input name="serial" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Value (GHS)</span>
          <input name="value" inputMode="decimal" className={inputClass} />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>Notes</span>
        <textarea name="notes" rows={2} className={`${inputClass} resize-none`} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#0a0e1a] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#1a2233] disabled:opacity-60"
      >
        {pending && <Loader2 className="mr-1.5 inline size-3.5 animate-spin" />}
        Add to register
      </button>
    </form>
  )
}

export function ScheduleForm({ properties, action }: { properties: { id: string; name: string }[]; action: Action }) {
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
        <span className={labelClass}>What is serviced?</span>
        <input name="name" required placeholder="Generator service" className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Instructions</span>
        <textarea name="description" rows={2} placeholder="Oil, filters, load test. Log the readings." className={`${inputClass} resize-none`} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Category</span>
          <select name="category" className={inputClass} defaultValue="OTHER">
            {['POWER_BACKUP', 'AIR_CONDITIONING', 'WATER_SUPPLY', 'PEST', 'PLUMBING', 'ELECTRICAL', 'CLEANING', 'SECURITY', 'OTHER'].map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Priority</span>
          <select name="priority" className={inputClass} defaultValue="NORMAL">
            {['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'].map((p) => (
              <option key={p} value={p}>
                {p.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Every (days)</span>
          <input name="intervalDays" type="number" min={7} max={365} defaultValue={90} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Raise N days early</span>
          <input name="leadDays" type="number" min={0} max={30} defaultValue={5} className={inputClass} />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#0a0e1a] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#1a2233] disabled:opacity-60"
      >
        {pending && <Loader2 className="mr-1.5 inline size-3.5 animate-spin" />}
        Schedule it
      </button>
    </form>
  )
}

export function ScheduleToggle({ id, active, action }: { id: string; active: boolean; action: (id: string) => Promise<ActionResult> }) {
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
      aria-label={active ? 'Pause schedule' : 'Resume schedule'}
      className="rounded-md border border-black/10 p-1.5 text-muted-foreground transition hover:bg-black/5"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
    </button>
  )
}
