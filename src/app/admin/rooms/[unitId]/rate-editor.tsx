'use client'

/**
 * The rate editor.
 *
 * Deliberately shows the price in the two places the business thinks about it:
 * the base rate the room falls back to, and the seasonal plans that override it.
 * Anything that changes what a guest pays is shown in major units, with the
 * currency beside it, because a figure like "5000" meaning fifty dollars is how
 * a room gets let for a hundredth of its price.
 */

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Currency } from '@prisma/client'
import {
  updateRoomRatesAction,
  saveRatePlanAction,
  setRatePlanActiveAction,
  type RateResult,
} from './rate-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { formatMinor, toMajor } from '@/lib/core/money'
import { Loader2, Pencil, Plus, CalendarRange } from 'lucide-react'

export type PlanRow = {
  id: string
  name: string
  currency: Currency
  nightlyMinor: number
  weeklyMinor: number | null
  monthlyMinor: number | null
  cleaningFeeMinor: number
  minNights: number
  maxNights: number | null
  startDate: Date | null
  endDate: Date | null
  priority: number
  active: boolean
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

/** Minor units back to what a person types: 5000 -> "50". */
const major = (minor: number | null, c: Currency) =>
  minor == null ? '' : String(toMajor(minor, c))

/* ------------------------------------------------------------------ base */

export function BaseRateEditor({
  unitId,
  currency,
  baseNightlyMinor,
  baseRentMinor,
  instantBook,
}: {
  unitId: string
  currency: Currency
  baseNightlyMinor: number | null
  baseRentMinor: number | null
  instantBook: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState<Currency>(currency)
  const [state, formAction, pending] = useActionState<RateResult | null, FormData>(
    updateRoomRatesAction.bind(null, unitId),
    null
  )

  // React resets a form once its action resolves, so a refused submit would
  // otherwise blank everything just typed. The action hands the values back;
  // these keys change with each attempt, which is what makes React re-seed
  // the inputs rather than keep the now-empty DOM nodes.
  const kept = state && !state.ok ? state.values : undefined
  const seed = (field: string, fallback: string) => kept?.[field] ?? fallback
  const attempt = kept ? JSON.stringify(kept) : 'clean'

  useEffect(() => {
    if (state?.ok) {
      toast({ title: state.message })
      setOpen(false)
      router.refresh()
    }
  }, [state, router])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Pencil className="mr-1.5 size-3.5" />
          Change rates
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Rates for this room</DialogTitle>
            <DialogDescription>
              The base rate applies to any night no rate plan covers. Amounts are in
              whole {cur} — type 50 for fifty, not 5000.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select name="currency" value={cur} onValueChange={(v) => setCur(v as Currency)}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD — US dollars</SelectItem>
                  <SelectItem value="GHS">GHS — Ghana cedis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="baseNightly">Nightly rate</Label>
              <Input
                key={`n-${attempt}`}
                id="baseNightly"
                name="baseNightly"
                inputMode="decimal"
                defaultValue={seed('baseNightly', major(baseNightlyMinor, currency))}
                placeholder="e.g. 50"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank if this room is never let by the night.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="baseRent">Monthly rent, for a long let</Label>
              <Input
                key={`r-${attempt}`}
                id="baseRent"
                name="baseRent"
                inputMode="decimal"
                defaultValue={seed('baseRent', major(baseRentMinor, currency))}
                placeholder="e.g. 1200"
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <Label htmlFor="instantBook" className="text-sm">
                  Confirm bookings automatically
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  On, a paid booking confirms itself. Off, it waits for someone here to
                  accept it.
                </p>
              </div>
              <Switch
                key={`i-${attempt}`}
                id="instantBook"
                name="instantBook"
                defaultChecked={kept ? kept.instantBook === 'on' : instantBook}
              />
            </div>

            {state && !state.ok && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Save rates
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------- rate plans */

/**
 * What priority a newly added plan should start at.
 *
 * A seasonal plan is almost always meant to BEAT the standing one, and a room
 * usually has a "Standard" plan with no dates that covers every night. Starting
 * a new plan at 0 ties with it, and the engine then falls back to whichever was
 * created later — so the right answer came out by accident rather than by
 * intent, and would quietly flip if the plans were ever re-created in a
 * different order. Starting above everything present makes it deliberate.
 */
function nextPriority(plans: PlanRow[]): number {
  if (plans.length === 0) return 0
  return Math.max(...plans.map((p) => p.priority)) + 10
}

export function RatePlans({
  unitId,
  currency,
  plans,
}: {
  unitId: string
  currency: Currency
  plans: PlanRow[]
}) {
  return (
    <div className="divide-y divide-border">
      {plans.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">
          No rate plans. The room is priced at its base rate every night.
        </p>
      ) : (
        plans.map((plan) => <PlanRowView key={plan.id} unitId={unitId} plan={plan} />)
      )}

      <div className="p-4">
        <PlanDialog
          unitId={unitId}
          currency={currency}
          suggestedPriority={nextPriority(plans)}
          trigger={
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="mr-1.5 size-3.5" />
              Add a rate plan
            </Button>
          }
        />
      </div>
    </div>
  )
}

function PlanRowView({ unitId, plan }: { unitId: string; plan: PlanRow }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const window =
    plan.startDate || plan.endDate
      ? `${plan.startDate ? day(plan.startDate) : 'any date'} → ${
          plan.endDate ? day(plan.endDate) : 'no end'
        }`
      : 'Every night'

  return (
    <div className={plan.active ? 'px-4 py-3' : 'bg-secondary/40 px-4 py-3'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{plan.name}</span>
            {!plan.active && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Off
              </span>
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarRange className="size-3 shrink-0" />
            <span className="truncate">{window}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Min {plan.minNights} night{plan.minNights === 1 ? '' : 's'}
            {plan.maxNights ? `, max ${plan.maxNights}` : ''} · priority {plan.priority}
            {plan.cleaningFeeMinor > 0 &&
              ` · cleaning ${formatMinor(plan.cleaningFeeMinor, plan.currency)}`}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="font-mono text-sm font-bold tabular-nums">
            {formatMinor(plan.nightlyMinor, plan.currency)}
          </span>
          <div className="flex items-center gap-1">
            <PlanDialog
              unitId={unitId}
              currency={plan.currency}
              plan={plan}
              trigger={
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  Edit
                </Button>
              }
            />
            <Switch
              checked={plan.active}
              disabled={pending}
              aria-label={`${plan.name} active`}
              onCheckedChange={(next) =>
                start(async () => {
                  const result = await setRatePlanActiveAction(unitId, plan.id, next)
                  if (result.ok) {
                    toast({ title: result.message })
                    router.refresh()
                  } else {
                    toast({
                      title: 'Not changed',
                      description: result.error,
                      variant: 'destructive',
                    })
                    router.refresh()
                  }
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanDialog({
  unitId,
  currency,
  plan,
  suggestedPriority = 0,
  trigger,
}: {
  unitId: string
  currency: Currency
  plan?: PlanRow
  suggestedPriority?: number
  trigger: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<RateResult | null, FormData>(
    saveRatePlanAction.bind(null, unitId),
    null
  )

  // Same reasoning as the base-rate dialog: a plan has ten fields, and losing
  // all of them to one mistyped date is the difference between a tool someone
  // uses and one they avoid.
  const kept = state && !state.ok ? state.values : undefined
  const seed = (field: string, fallback: string) => kept?.[field] ?? fallback
  const attempt = kept ? JSON.stringify(kept) : 'clean'

  useEffect(() => {
    if (state?.ok) {
      toast({ title: state.message })
      setOpen(false)
      router.refresh()
    }
  }, [state, router])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form action={formAction}>
          {plan && <input type="hidden" name="planId" value={plan.id} />}

          <DialogHeader>
            <DialogTitle>{plan ? 'Edit rate plan' : 'New rate plan'}</DialogTitle>
            <DialogDescription>
              A plan overrides the base rate for the nights it covers. Where two plans
              cover the same night, the higher priority wins — so a seasonal plan needs
              to outrank the standing one. Amounts are in whole {currency}.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                key={`name-${attempt}`}
                id="name"
                name="name"
                defaultValue={seed('name', plan?.name ?? '')}
                placeholder="e.g. December peak"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nightly">Nightly rate</Label>
                <Input
                  key={`nightly-${attempt}`}
                  id="nightly"
                  name="nightly"
                  inputMode="decimal"
                  defaultValue={seed('nightly', plan ? major(plan.nightlyMinor, plan.currency) : '')}
                  placeholder="70"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cleaningFee">Cleaning fee</Label>
                <Input
                  key={`fee-${attempt}`}
                  id="cleaningFee"
                  name="cleaningFee"
                  inputMode="decimal"
                  defaultValue={seed('cleaningFee', plan ? major(plan.cleaningFeeMinor, plan.currency) : '')}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Window starts</Label>
                <Input
                  key={`start-${attempt}`}
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={seed('startDate', day(plan?.startDate ?? null))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">Window ends</Label>
                <Input
                  key={`end-${attempt}`}
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={seed('endDate', day(plan?.endDate ?? null))}
                />
              </div>
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">
              The end date is the first night the plan no longer applies, the same way a
              checkout date works. Leave both blank for a plan that always applies.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="minNights">Min nights</Label>
                <Input
                  key={`min-${attempt}`}
                  id="minNights"
                  name="minNights"
                  type="number"
                  min={1}
                  defaultValue={seed('minNights', String(plan?.minNights ?? 1))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxNights">Max nights</Label>
                <Input
                  key={`max-${attempt}`}
                  id="maxNights"
                  name="maxNights"
                  type="number"
                  min={1}
                  defaultValue={seed('maxNights', plan?.maxNights ? String(plan.maxNights) : '')}
                  placeholder="none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  key={`prio-${attempt}`}
                  id="priority"
                  name="priority"
                  type="number"
                  min={0}
                  defaultValue={seed('priority', String(plan?.priority ?? suggestedPriority))}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="weekly">Weekly rate</Label>
                <Input
                  key={`weekly-${attempt}`}
                  id="weekly"
                  name="weekly"
                  inputMode="decimal"
                  defaultValue={seed('weekly', plan ? major(plan.weeklyMinor, plan.currency) : '')}
                  placeholder="optional"
                />
                <p className="text-xs text-muted-foreground">
                  Used only when it beats the nightly total.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monthly">Monthly rate</Label>
                <Input
                  key={`monthly-${attempt}`}
                  id="monthly"
                  name="monthly"
                  inputMode="decimal"
                  defaultValue={seed('monthly', plan ? major(plan.monthlyMinor, plan.currency) : '')}
                  placeholder="optional"
                />
              </div>
            </div>

            {state && !state.ok && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              {plan ? 'Save changes' : 'Add plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
