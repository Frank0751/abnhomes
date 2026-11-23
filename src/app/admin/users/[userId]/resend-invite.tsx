'use client'

import { useState, useTransition } from 'react'
import type { StaffResult } from '../staff-actions'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Loader2, Send } from 'lucide-react'
import { InviteLink } from '../invite-link'

export function ResendInvite({ action }: { action: () => Promise<StaffResult> }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<StaffResult | null>(null)

  return (
    <div className="space-y-3 p-4 sm:p-5">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await action()
            setResult(r)
            toast(r.ok ? { title: r.message } : { title: 'Not sent', description: r.error, variant: 'destructive' })
          })
        }
      >
        {pending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Send className="mr-1.5 size-4" />}
        Send a new invitation
      </Button>
      {result?.ok && result.link && <InviteLink link={result.link} emailed={Boolean(result.emailed)} />}
    </div>
  )
}
