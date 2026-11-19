'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignManagerAction } from './actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { ROLE_LABELS } from '@/lib/rbac'
import type { Role } from '@prisma/client'
import { Loader2 } from 'lucide-react'

const NOBODY = '__nobody__'

export function AssignManager({
  unitId,
  currentId,
  staff,
}: {
  unitId: string
  currentId: string | null
  staff: Array<{ id: string; name: string; role: Role }>
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <div className="space-y-2">
      <Select
        defaultValue={currentId ?? NOBODY}
        disabled={pending}
        onValueChange={(value) =>
          start(async () => {
            const result = await assignManagerAction(unitId, value === NOBODY ? null : value)
            if (result.ok) {
              toast({ title: result.message ?? 'Updated' })
              router.refresh()
            } else {
              toast({
                title: 'Not updated',
                description: result.error,
                variant: 'destructive',
              })
            }
          })
        }
      >
        <SelectTrigger aria-label="Room manager">
          <SelectValue placeholder="Choose a manager" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOBODY}>Nobody assigned</SelectItem>
          {staff.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.name}
              <span className="ml-2 text-xs text-muted-foreground">
                {ROLE_LABELS[person.role]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {pending ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Saving…
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Saved as soon as you choose. The change is recorded in the audit trail.
        </p>
      )}
    </div>
  )
}
