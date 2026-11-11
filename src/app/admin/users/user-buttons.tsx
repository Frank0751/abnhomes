'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { Loader2, ShieldOff, ShieldCheck, Power } from 'lucide-react'

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

export function UserActionButtons({
  userId,
  suspended,
  active,
  actions,
}: {
  userId: string
  suspended: boolean
  active: boolean
  actions: {
    suspendUserAction: (userId: string, reason: string) => Promise<ActionResult>
    restoreUserAction: (userId: string) => Promise<ActionResult>
    toggleUserActiveAction: (userId: string) => Promise<ActionResult>
  }
}) {
  const [pending, start] = useTransition()
  const [reason, setReason] = useState('')
  const [asking, setAsking] = useState(false)
  const router = useRouter()

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const result = await fn()
      if (result.ok) {
        toast({ title: result.message })
        setAsking(false)
        router.refresh()
      } else {
        toast({ title: 'Not done', description: result.error, variant: 'destructive' })
      }
    })

  if (suspended) {
    return (
      <button
        disabled={pending}
        onClick={() => run(() => actions.restoreUserAction(userId))}
        className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium transition hover:bg-black/5"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
        Restore access
      </button>
    )
  }

  if (asking) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="reason"
          className="w-28 rounded-md border border-black/12 px-2 py-1.5 text-xs"
          autoFocus
        />
        <button
          disabled={pending}
          onClick={() => run(() => actions.suspendUserAction(userId, reason))}
          className="rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {pending ? '…' : 'Confirm'}
        </button>
        <button onClick={() => setAsking(false)} className="text-xs text-muted-foreground">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        disabled={pending}
        onClick={() => setAsking(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
      >
        <ShieldOff className="size-3" />
        Suspend
      </button>
      <button
        disabled={pending}
        onClick={() => run(() => actions.toggleUserActiveAction(userId))}
        aria-label={active ? 'Deactivate' : 'Activate'}
        className="rounded-lg border border-black/10 p-1.5 text-muted-foreground transition hover:bg-black/5"
        title={active ? 'Deactivate account' : 'Reactivate account'}
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Power className="size-3" />}
      </button>
    </div>
  )
}
