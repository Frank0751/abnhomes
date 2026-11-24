'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setCancellationPolicyAction } from './actions'
import type { CancellationPolicy } from '@/lib/core/cancellation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function CancellationForm({ policy }: { policy: CancellationPolicy }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <form
      className="space-y-3"
      action={(formData) =>
        start(async () => {
          const result = await setCancellationPolicyAction(formData)
          if (result.ok) {
            toast({ title: result.message ?? 'Saved' })
            router.refresh()
          } else {
            toast({ title: 'Not saved', description: result.error, variant: 'destructive' })
          }
        })
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="fullRefundDays" className="text-xs">
            Full refund until (days before arrival)
          </Label>
          <Input id="fullRefundDays" name="fullRefundDays" type="number" min={0} max={90} defaultValue={policy.fullRefundDays} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="partialPercent" className="text-xs">
            Then a part refund of (%)
          </Label>
          <Input id="partialPercent" name="partialPercent" type="number" min={0} max={100} defaultValue={policy.partialPercent} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="partialRefundDays" className="text-xs">
            Part refund until (days before arrival)
          </Label>
          <Input id="partialRefundDays" name="partialRefundDays" type="number" min={0} max={90} defaultValue={policy.partialRefundDays} required />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        After the last date nothing is refunded. Set the part refund to 0% for a simple “free until, then
        non-refundable” policy. Changes apply to cancellations from now on.
      </p>
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
        Save policy
      </Button>
    </form>
  )
}
