'use client'

/**
 * Portal access for the guest.
 *
 * Confirmation mints a code; this surface is where the desk reads it out or
 * copies it into a chat. Before confirmation there is nothing to show — a
 * code for a stay that may not happen is a key handed out too early.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ReservationStatus } from '@prisma/client'
import { issuePortalCodeAction, type ActionResult } from '../actions'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/admin/ui'
import { toast } from '@/hooks/use-toast'
import { Check, Copy, Loader2 } from 'lucide-react'

export function PortalAccessCard({
  reservationId,
  status,
  portalCode,
}: {
  reservationId: string
  status: ReservationStatus
  portalCode: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [copied, setCopied] = useState(false)

  const live = status === 'CONFIRMED' || status === 'CHECKED_IN' || status === 'CHECKED_OUT'

  if (!live) {
    return (
      <Panel title="Guest portal access">
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Issued automatically when the booking is confirmed, together with the confirmation
          text to the guest.
        </p>
      </Panel>
    )
  }

  if (!portalCode) {
    return (
      <Panel title="Guest portal access">
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            This booking was confirmed without a portal code. Issue one so the guest can sign
            into their portal.
          </p>
          <Button
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result: ActionResult = await issuePortalCodeAction(reservationId)
                if (result.ok) {
                  toast({ title: result.message ?? 'Portal code issued' })
                  router.refresh()
                } else {
                  toast({ title: 'Not issued', description: result.error, variant: 'destructive' })
                }
              })
            }
          >
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Issue portal code
          </Button>
        </div>
      </Panel>
    )
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(portalCode ?? '')
      setCopied(true)
      toast({ title: 'Code copied' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'Could not copy — read it out instead' })
    }
  }

  return (
    <Panel
      title="Guest portal access"
      description="The guest signs in at /portal with the email or phone they booked with, plus this code."
    >
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3 rounded border border-black/10 bg-[#faf8f3] px-4 py-3">
          <span className="font-mono text-xl font-semibold tracking-[0.14em]">{portalCode}</span>
          <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy portal code">
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Read it out, or paste it into WhatsApp or an email. The code alone does not open
          anything — the guest&apos;s own email or phone must match the booking.
        </p>
      </div>
    </Panel>
  )
}
