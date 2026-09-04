'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TaskStatus } from '@prisma/client'
import { completeTaskAction, startTaskAction } from './actions'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Check, Loader2 } from 'lucide-react'

export function CompleteTaskButton({
  taskId,
  status,
}: {
  taskId: string
  status: TaskStatus
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const result = await action()
      if (result.ok) {
        toast({ title: result.message ?? 'Done' })
        router.refresh()
      } else {
        toast({ title: 'Not updated', description: result.error, variant: 'destructive' })
      }
    })
  }

  if (status === 'DONE') {
    return <span className="text-xs text-muted-foreground">Done</span>
  }

  return (
    <div className="flex shrink-0 gap-2">
      {status === 'PENDING' && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          disabled={pending}
          onClick={() => run(() => startTaskAction(taskId))}
        >
          Start
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={pending}
        onClick={() => run(() => completeTaskAction(taskId))}
      >
        {pending ? (
          <Loader2 className="mr-1.5 size-3 animate-spin" />
        ) : (
          <Check className="mr-1.5 size-3" />
        )}
        Mark done
      </Button>
    </div>
  )
}
