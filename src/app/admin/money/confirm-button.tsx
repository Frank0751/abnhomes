'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirmPaymentAction } from './actions'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function ConfirmPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await confirmPaymentAction(paymentId)
          if (result.ok) {
            toast({ title: result.message ?? 'Confirmed' })
            router.refresh()
          } else {
            toast({ title: 'Not confirmed', description: result.error, variant: 'destructive' })
          }
        })
      }
    >
      {pending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
      Confirm
    </Button>
  )
}
