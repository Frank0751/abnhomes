'use client'

/**
 * What can be done to this booking right now.
 *
 * Only the actions that make sense for the current state are shown. A
 * cancelled booking has no check-in button; a guest who has already left
 * cannot be checked in again. Offering an action that will fail is worse than
 * not offering it.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Currency, ReservationStatus } from '@prisma/client'
import {
  cancelBookingAction,
  checkInAction,
  checkOutAction,
  confirmBookingAction,
  takePaymentAction,
  type ActionResult,
} from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Panel } from '@/components/admin/ui'
import { formatMinor } from '@/lib/core/money'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function BookingActions({
  reservationId,
  status,
  currency,
  outstandingMinor,
}: {
  reservationId: string
  status: ReservationStatus
  currency: Currency
  outstandingMinor: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function run(action: () => Promise<ActionResult>) {
    start(async () => {
      const result = await action()
      if (result.ok) {
        toast({ title: result.message ?? 'Done' })
        router.refresh()
      } else {
        toast({ title: 'That did not work', description: result.error, variant: 'destructive' })
      }
    })
  }

  const isLive = !['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(status)

  return (
    <>
      <Panel title="Actions">
        <div className="space-y-2 p-4">
          {status === 'PENDING' && (
            <Button
              className="w-full"
              disabled={pending}
              onClick={() => run(() => confirmBookingAction(reservationId))}
            >
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirm booking
            </Button>
          )}

          {(status === 'CONFIRMED' || status === 'PENDING') && (
            <Button
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() => run(() => checkInAction(reservationId))}
            >
              Check in
            </Button>
          )}

          {status === 'CHECKED_IN' && <CheckOutDialog reservationId={reservationId} currency={currency} />}

          {outstandingMinor > 0 && isLive && (
            <TakePaymentDialog
              reservationId={reservationId}
              currency={currency}
              outstandingMinor={outstandingMinor}
            />
          )}

          {isLive && <CancelDialog reservationId={reservationId} />}
        </div>
      </Panel>

      {outstandingMinor > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          {formatMinor(outstandingMinor, currency)} is still outstanding on this stay.
        </p>
      )}
    </>
  )
}

function TakePaymentDialog({
  reservationId,
  currency,
  outstandingMinor,
}: {
  reservationId: string
  currency: Currency
  outstandingMinor: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Record a payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          action={(formData) => {
            start(async () => {
              const result = await takePaymentAction(reservationId, formData)
              if (result.ok) {
                toast({ title: result.message ?? 'Payment recorded' })
                setOpen(false)
                router.refresh()
              } else {
                toast({ title: 'Not recorded', description: result.error, variant: 'destructive' })
              }
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              For cash at the desk or a transfer already received. Card and mobile money taken
              through the gateway record themselves.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({currency})</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={(outstandingMinor / 100).toFixed(2)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel">Received by</Label>
              <Select name="channel" defaultValue="CASH">
                <SelectTrigger id="channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="MOMO_MTN">MTN MoMo</SelectItem>
                  <SelectItem value="MOMO_TELECEL">Telecel Cash</SelectItem>
                  <SelectItem value="MOMO_AIRTELTIGO">AirtelTigo Money</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" name="reference" placeholder="Transaction id or note" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CheckOutDialog({
  reservationId,
  currency,
}: {
  reservationId: string
  currency: Currency
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">Check out</Button>
      </DialogTrigger>
      <DialogContent>
        <form
          action={(formData) => {
            start(async () => {
              const result = await checkOutAction(reservationId, formData)
              if (result.ok) {
                toast({ title: result.message ?? 'Checked out' })
                setOpen(false)
                router.refresh()
              } else {
                toast({ title: 'Not checked out', description: result.error, variant: 'destructive' })
              }
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>Check out</DialogTitle>
            <DialogDescription>
              The deposit is released automatically. Deduct from it only for damage or extra
              cleaning, and say why — the guest can see this.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deduction">Deduct from deposit ({currency})</Label>
              <Input
                id="deduction"
                name="deduction"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deductionReason">Reason</Label>
              <Textarea
                id="deductionReason"
                name="deductionReason"
                rows={2}
                placeholder="Leave blank if nothing is being deducted."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Check out and queue the clean
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({ reservationId }: { reservationId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive">
          Cancel booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          action={(formData) => {
            start(async () => {
              const result = await cancelBookingAction(reservationId, formData)
              if (result.ok) {
                toast({ title: result.message ?? 'Cancelled' })
                setOpen(false)
                router.refresh()
              } else {
                toast({ title: 'Not cancelled', description: result.error, variant: 'destructive' })
              }
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>Cancel this booking</DialogTitle>
            <DialogDescription>
              The dates are released and every charge raised for the stay is reversed. Nothing is
              deleted — the cancellation stays on the record.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              name="reason"
              rows={3}
              required
              className="mt-2"
              placeholder="Guest cancelled, double booking, no payment received…"
            />
          </div>

          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Cancel booking
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
