'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { refundPaymentAction } from './actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { Loader2, Undo2 } from 'lucide-react'

/**
 * Refund with a reason — money leaves twice (gateway + ledger), so it asks
 * first.
 */
export function RefundPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  const submit = () =>
    start(async () => {
      const result = await refundPaymentAction(paymentId, reason)
      if (result.ok) {
        toast({ title: result.message ?? 'Refunded' })
        setOpen(false)
        router.refresh()
      } else {
        toast({ title: 'Not refunded', description: result.error, variant: 'destructive' })
      }
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-700 hover:text-red-800">
          <Undo2 className="mr-1.5 size-3" />
          Refund
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Refund this payment?</DialogTitle>
          <DialogDescription>
            The gateway is asked to return the money to the guest's original method, the
            ledger entry is reversed, and the guest is notified by email and SMS.
          </DialogDescription>
        </DialogHeader>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Reason (kept in the audit log)
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Guest cancelled within the free window"
            className="w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-sm focus:border-[#0d9488] focus:outline-none"
          />
        </label>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive" disabled={pending} onClick={submit}>
            {pending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
            Refund payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
