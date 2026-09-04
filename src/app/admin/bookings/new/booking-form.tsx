'use client'

/**
 * The booking form.
 *
 * The quote is recalculated on the server as the dates change, because the
 * price depends on rate plans the browser has never seen. Showing a guess and
 * correcting it after submission is how a guest ends up quoted one figure and
 * charged another.
 */

import { useEffect, useState, useTransition } from 'react'
import { useActionState } from 'react'
import { createBookingAction, quoteAction, type ActionResult } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatMinor } from '@/lib/core/money'
import { Panel } from '@/components/admin/ui'
import { Loader2, TriangleAlert } from 'lucide-react'
import type { Currency } from '@prisma/client'

type Quote = {
  nights: number
  currency: Currency
  accommodationMinor: number
  cleaningFeeMinor: number
  totalMinor: number
  violations: string[]
}

export function BookingForm({
  units,
  defaultUnitId,
  defaultCheckIn,
  defaultCheckOut,
}: {
  units: Array<{ id: string; label: string; maxGuests: number }>
  defaultUnitId?: string
  defaultCheckIn: string
  defaultCheckOut: string
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createBookingAction,
    null
  )

  const [unitId, setUnitId] = useState(defaultUnitId ?? units[0]?.id ?? '')
  const [checkIn, setCheckIn] = useState(defaultCheckIn)
  const [checkOut, setCheckOut] = useState(defaultCheckOut)
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoting, startQuote] = useTransition()

  useEffect(() => {
    if (!unitId || !checkIn || !checkOut) return
    startQuote(async () => {
      const result = await quoteAction(unitId, checkIn, checkOut, adults + children)
      setQuote(result)
    })
  }, [unitId, checkIn, checkOut, adults, children])

  const blocking = quote?.violations.filter((v) => !v.startsWith('Weekly rate applied')) ?? []

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Panel title="Stay">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="unitId">Unit</Label>
              <Select name="unitId" value={unitId} onValueChange={setUnitId}>
                <SelectTrigger id="unitId">
                  <SelectValue placeholder="Choose a unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkIn">Arrives</Label>
              <Input
                id="checkIn"
                name="checkIn"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkOut">Leaves</Label>
              <Input
                id="checkOut"
                name="checkOut"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The unit is free again from this morning.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adults">Adults</Label>
              <Input
                id="adults"
                name="adults"
                type="number"
                min={1}
                max={20}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="children">Children</Label>
              <Input
                id="children"
                name="children"
                type="number"
                min={0}
                max={20}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
                required
              />
            </div>
          </div>
        </Panel>

        <Panel title="Guest">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="guestName">Full name</Label>
              <Input id="guestName" name="guestName" required placeholder="Michael Osei" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guestPhone">Phone</Label>
              <Input id="guestPhone" name="guestPhone" type="tel" placeholder="024 170 4048" />
              <p className="text-xs text-muted-foreground">
                Used to match returning guests and to text the confirmation.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guestEmail">Email</Label>
              <Input id="guestEmail" name="guestEmail" type="email" placeholder="optional" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="source">Where did this booking come from?</Label>
              <Select name="source" defaultValue="DIRECT">
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECT">Direct</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="WEBSITE">Website</SelectItem>
                  <SelectItem value="AIRBNB">Airbnb</SelectItem>
                  <SelectItem value="BOOKING_COM">Booking.com</SelectItem>
                  <SelectItem value="WALK_IN">Walk in</SelectItem>
                  <SelectItem value="REFERRAL">Referral</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Internal notes</Label>
              <Textarea id="notes" name="notes" rows={3} placeholder="Not shown to the guest." />
            </div>
          </div>
        </Panel>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Panel title="Quote">
          <div className="space-y-2.5 p-4 text-sm">
            {quoting && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Pricing…
              </p>
            )}

            {!quoting && quote && quote.nights > 0 && (
              <>
                <Line
                  label={`${quote.nights} night${quote.nights === 1 ? '' : 's'}`}
                  value={formatMinor(quote.accommodationMinor, quote.currency)}
                />
                {quote.cleaningFeeMinor > 0 && (
                  <Line
                    label="Cleaning"
                    value={formatMinor(quote.cleaningFeeMinor, quote.currency)}
                  />
                )}
                <div className="border-t border-black/8 pt-2.5">
                  <Line
                    label="Total"
                    value={formatMinor(quote.totalMinor, quote.currency, {
                      showCurrencyCode: true,
                    })}
                    strong
                  />
                </div>
              </>
            )}

            {!quoting && (!quote || quote.nights === 0) && (
              <p className="text-muted-foreground">Choose a unit and dates to see the price.</p>
            )}

            {quote && quote.violations.length > 0 && (
              <ul className="space-y-1.5 border-t border-black/8 pt-2.5">
                {quote.violations.map((v) => (
                  <li key={v} className="flex gap-2 text-xs text-amber-800">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Confirm">
          <div className="space-y-4 p-4">
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox name="confirmNow" defaultChecked className="mt-0.5" />
              <span>
                Confirm immediately
                <span className="block text-xs text-muted-foreground">
                  Texts the guest and holds the dates. Leave unticked to hold as pending.
                </span>
              </span>
            </label>

            {blocking.length > 0 && (
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox name="override" className="mt-0.5" />
                <span>
                  Override the warnings above
                  <span className="block text-xs text-muted-foreground">
                    For a minimum-stay exception agreed with a manager.
                  </span>
                </span>
              </label>
            )}

            {state && !state.ok && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create booking
            </Button>
          </div>
        </Panel>
      </aside>
    </form>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={strong ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-serif text-lg' : ''}`}>{value}</span>
    </div>
  )
}
