'use client'

import { useState, useTransition } from 'react'
import type { Currency, PaymentChannel } from '@prisma/client'
import { startTenantPaymentAction } from './actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatMinor } from '@/lib/core/money'
import { toast } from '@/hooks/use-toast'
import { Loader2, Smartphone, CreditCard } from 'lucide-react'

const CHANNELS: Array<{
  value: PaymentChannel
  label: string
  hint: string
  icon: typeof Smartphone
}> = [
  {
    value: 'MOMO_MTN',
    label: 'MTN MoMo',
    hint: 'Approve the prompt on your phone',
    icon: Smartphone,
  },
  {
    value: 'MOMO_TELECEL',
    label: 'Telecel Cash',
    hint: 'Approve the prompt on your phone',
    icon: Smartphone,
  },
  {
    value: 'MOMO_AIRTELTIGO',
    label: 'AirtelTigo Money',
    hint: 'Approve the prompt on your phone',
    icon: Smartphone,
  },
  {
    value: 'CARD',
    label: 'Visa or Mastercard',
    hint: 'Debit or credit card, including from abroad',
    icon: CreditCard,
  },
]

export function PayNowButton({
  amountMinor,
  currency,
  className,
}: {
  amountMinor: number
  currency: Currency
  propertyId: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function pay(channel: PaymentChannel) {
    start(async () => {
      const result = await startTenantPaymentAction(amountMinor, channel)
      if (result.ok) {
        if (result.simulated) {
          toast({
            title: 'Simulation mode',
            description:
              'No payment gateway is configured yet, so nothing was charged. Once Paystack is live this opens the real payment page.',
          })
          setOpen(false)
          return
        }
        window.location.href = result.redirectUrl
      } else {
        toast({ title: 'Could not start', description: result.error, variant: 'destructive' })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={className}>Pay {formatMinor(amountMinor, currency)}</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay {formatMinor(amountMinor, currency)}</DialogTitle>
          <DialogDescription>
            Your receipt is issued automatically once the payment clears, and your balance updates
            straight away.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-4">
          {CHANNELS.map((channel) => {
            const Icon = channel.icon
            return (
              <button
                key={channel.value}
                type="button"
                disabled={pending}
                onClick={() => pay(channel.value)}
                className="flex items-center gap-3 rounded border border-black/10 bg-white px-4 py-3 text-left transition-colors hover:border-black/20 hover:bg-black/[0.02] disabled:opacity-50"
              >
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{channel.label}</span>
                  <span className="block text-xs text-muted-foreground">{channel.hint}</span>
                </span>
                {pending && <Loader2 className="size-4 animate-spin" />}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Prefer to pay cash or by bank transfer? Call the office on{' '}
          <a href="tel:+233541704048" className="underline underline-offset-2">
            054 170 4048
          </a>{' '}
          and you will be issued a numbered receipt.
        </p>
      </DialogContent>
    </Dialog>
  )
}
