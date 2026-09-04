'use client'

import { useActionState } from 'react'
import { requestBookingAction, type BookingResult } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function BookingRequestForm({
  unitId,
  checkIn,
  checkOut,
  guests,
  totalLabel,
}: {
  unitId: string
  checkIn: string
  checkOut: string
  guests: number
  totalLabel: string
}) {
  const [state, formAction, pending] = useActionState<BookingResult | null, FormData>(
    requestBookingAction,
    null
  )

  if (state?.ok) {
    return (
      <div className="rounded border border-emerald-200 bg-emerald-50/70 px-5 py-6">
        <CheckCircle2 className="size-6 text-emerald-700" />
        <p className="mt-3 font-serif text-xl tracking-tight text-emerald-950">
          Your booking is held
        </p>
        <p className="mt-2 text-sm text-emerald-950/80">
          Reference <strong className="font-mono">{state.code}</strong>. We have texted you a
          confirmation and the dates are reserved.
        </p>

        {state.payUrl ? (
          <>
            <p className="mt-4 text-sm text-emerald-950/80">
              Pay now to confirm the stay. Cards and mobile money both work.
            </p>
            <Button asChild className="mt-3">
              <a href={state.payUrl}>Pay {totalLabel}</a>
            </Button>
          </>
        ) : (
          <p className="mt-4 text-sm text-emerald-950/80">
            We will call you shortly to arrange payment. If you would rather reach us first, we are
            on{' '}
            <a href="tel:+233541704048" className="underline underline-offset-2">
              054 170 4048
            </a>
            .
          </p>
        )}
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />
      <input type="hidden" name="guests" value={guests} />

      <div className="space-y-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="024 170 4048, or +44 … from abroad"
        />
        <p className="text-xs text-muted-foreground">
          We text your confirmation and arrival details here.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="Optional" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Anything we should know</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Arrival time, airport pickup, anything else."
        />
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Request this stay
      </Button>

      <p className="text-xs text-muted-foreground">
        Your dates are held as soon as you submit. Nothing is charged until you choose to pay.
      </p>
    </form>
  )
}
