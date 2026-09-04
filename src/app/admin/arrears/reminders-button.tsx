'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { previewRemindersAction, sendRemindersAction } from './actions'
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
import { Loader2, Send } from 'lucide-react'

/**
 * Reminders are rehearsed before they are sent. Texting the wrong tenant that
 * they are in arrears is not a bug you can take back.
 */
export function RunRemindersButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<{ sent: number; skipped: number } | null>(null)
  const [pending, start] = useTransition()

  function openDialog(next: boolean) {
    setOpen(next)
    if (next) {
      start(async () => setPreview(await previewRemindersAction()))
    } else {
      setPreview(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Send className="mr-1.5 size-3.5" />
          Send reminders
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send arrears reminders</DialogTitle>
          <DialogDescription>
            One message per tenant, not one per charge. Tenants with no phone number on file are
            skipped and listed for you to chase another way.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 text-sm">
          {pending && !preview && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Working out who would be messaged…
            </p>
          )}
          {preview && (
            <ul className="space-y-1.5">
              <li>
                <strong className="tabular-nums">{preview.sent}</strong> tenant
                {preview.sent === 1 ? '' : 's'} would be texted.
              </li>
              {preview.skipped > 0 && (
                <li className="text-amber-800">
                  <strong className="tabular-nums">{preview.skipped}</strong> skipped — no phone
                  number on record.
                </li>
              )}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => openDialog(false)}>
            Not now
          </Button>
          <Button
            disabled={pending || !preview || preview.sent === 0}
            onClick={() =>
              start(async () => {
                const result = await sendRemindersAction()
                if (result.ok) {
                  toast({ title: result.message ?? 'Reminders sent' })
                  openDialog(false)
                  router.refresh()
                } else {
                  toast({ title: 'Not sent', description: result.error, variant: 'destructive' })
                }
              })
            }
          >
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Send them
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
