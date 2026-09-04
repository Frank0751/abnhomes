'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setFxRateAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function FxRateForm() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      action={(formData) =>
        start(async () => {
          const result = await setFxRateAction(formData)
          if (result.ok) {
            toast({ title: result.message ?? 'Rate saved' })
            router.refresh()
          } else {
            toast({ title: 'Not saved', description: result.error, variant: 'destructive' })
          }
        })
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="rate" className="text-xs">
          1 USD in cedis
        </Label>
        <Input
          id="rate"
          name="rate"
          type="number"
          step="0.0001"
          min="0.0001"
          placeholder="12.5000"
          className="w-32"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="asOf" className="text-xs">
          Effective from
        </Label>
        <Input id="asOf" name="asOf" type="date" defaultValue={todayIso} className="w-40" required />
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="mr-1.5 size-3 animate-spin" />}
        Save rate
      </Button>
    </form>
  )
}
