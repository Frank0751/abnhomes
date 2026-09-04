'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resolveTicketAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Loader2 } from 'lucide-react'

export function ResolveTicketDialog({
  ticketId,
  ticketCode,
  hasUnit,
}: {
  ticketId: string
  ticketCode: string
  hasUnit: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          Resolve
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form
          action={(formData) => {
            start(async () => {
              const result = await resolveTicketAction(ticketId, formData)
              if (result.ok) {
                toast({ title: result.message ?? 'Resolved' })
                setOpen(false)
                router.refresh()
              } else {
                toast({ title: 'Not resolved', description: result.error, variant: 'destructive' })
              }
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>Resolve {ticketCode}</DialogTitle>
            <DialogDescription>
              Any cost entered here is posted to the ledger immediately, so it reaches the owner
              statement without anyone re-keying it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resolution">What was done</Label>
              <Textarea id="resolution" name="resolution" rows={3} required autoFocus />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">Cost (GHS)</Label>
              <Input
                id="cost"
                name="cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="Leave blank if nothing was spent"
              />
            </div>

            {hasUnit && (
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox name="recharge" className="mt-0.5" />
                <span>
                  Recharge this to the tenant
                  <span className="block text-xs text-muted-foreground">
                    For damage the tenant caused. Left unticked, the property carries it and it
                    reduces the owner payout.
                  </span>
                </span>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Resolve ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
