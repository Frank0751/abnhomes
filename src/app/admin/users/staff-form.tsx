'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Role } from '@prisma/client'
import type { StaffResult } from './staff-actions'
import { FormField, NativeSelect } from '../rooms/form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { InviteLink } from './invite-link'

/** What each role is for, in the words a manager would use. */
export const ROLE_HELP: Record<string, { label: string; help: string; scoped: boolean }> = {
  PROPERTY_MANAGER: {
    label: 'Property manager',
    help: 'Runs their buildings: rooms, rates, bookings, tenancies, maintenance and reviews.',
    scoped: true,
  },
  FRONT_DESK: {
    label: 'Front desk',
    help: 'Takes bookings and payments, checks guests in and out. Cannot change what is owed.',
    scoped: true,
  },
  HOUSEKEEPING: {
    label: 'Housekeeping',
    help: 'Sees the cleaning list and today’s arrivals, marks rooms done, reports problems.',
    scoped: true,
  },
  FINANCE: {
    label: 'Finance',
    help: 'Sees money in every building, issues owner statements, reconciles. Cannot change bookings.',
    scoped: false,
  },
  SUPER_ADMIN: {
    label: 'Administrator',
    help: 'Everything, in every building, including staff and settings. Give this to very few people.',
    scoped: false,
  },
}

export type StaffFormValues = {
  name: string
  email: string
  phone: string
  role: Role
  propertyIds: string[]
}

export function StaffForm({
  mode,
  action,
  properties,
  initial,
  lockRole,
}: {
  mode: 'invite' | 'edit'
  action: (prev: StaffResult | null, formData: FormData) => Promise<StaffResult>
  properties: { id: string; name: string }[]
  initial: StaffFormValues
  /** Set when editing yourself: your own role is not yours to change. */
  lockRole?: boolean
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<StaffResult | null, FormData>(action, null)
  const kept = state && !state.ok ? state.values : undefined
  const keptStr = (k: string, fallback: string) => (typeof kept?.[k] === 'string' ? (kept[k] as string) : fallback)

  const [role, setRole] = useState<string>(keptStr('role', initial.role))
  const scoped = ROLE_HELP[role]?.scoped ?? true
  const chosen = new Set(Array.isArray(kept?.propertyIds) ? kept.propertyIds : initial.propertyIds)

  useEffect(() => {
    if (state?.ok && mode === 'edit') {
      toast({ title: state.message })
      router.refresh()
    }
  }, [state, mode, router])

  if (state?.ok && mode === 'invite') {
    return (
      <div className="space-y-4 p-4 sm:p-5">
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
        {state.link && <InviteLink link={state.link} emailed={Boolean(state.emailed)} />}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => router.push('/admin/users')}>Back to users</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Invite someone else
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} key={kept ? JSON.stringify(kept) : 'clean'} className="space-y-5 p-4 sm:p-5">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="name" label="Full name" className="sm:col-span-2">
          <Input id="name" name="name" required maxLength={80} defaultValue={keptStr('name', initial.name)} autoComplete="off" />
        </FormField>
        <FormField
          id="email"
          label="Work email"
          hint={mode === 'invite' ? 'The invitation goes here, and it is what they sign in with.' : 'Used to sign in. It cannot be changed here.'}
        >
          <Input
            id="email"
            name="email"
            type="email"
            required={mode === 'invite'}
            disabled={mode === 'edit'}
            defaultValue={keptStr('email', initial.email)}
            autoComplete="off"
          />
        </FormField>
        <FormField id="phone" label="Phone (optional)" hint="For staff alerts by SMS.">
          <Input id="phone" name="phone" type="tel" defaultValue={keptStr('phone', initial.phone)} autoComplete="off" placeholder="024 123 4567" />
        </FormField>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Role</legend>
        {lockRole && <input type="hidden" name="role" value={initial.role} />}
        <div className="grid gap-2">
          {Object.entries(ROLE_HELP).map(([value, info]) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
            >
              <input
                type="radio"
                name={lockRole ? undefined : 'role'}
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                disabled={lockRole}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                <span className="font-medium">{info.label}</span>
                <span className="block text-xs text-muted-foreground">{info.help}</span>
              </span>
            </label>
          ))}
        </div>
        {lockRole && <p className="text-xs text-muted-foreground">You cannot change your own role.</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Buildings</legend>
        {scoped ? (
          properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">There are no buildings yet. Add one under Portfolio first.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {properties.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="propertyIds"
                    value={p.id}
                    defaultChecked={chosen.has(p.id)}
                    className="size-4 accent-primary"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">This role covers every building automatically.</p>
        )}
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
        {mode === 'invite' ? 'Send invitation' : 'Save changes'}
      </Button>
    </form>
  )
}
