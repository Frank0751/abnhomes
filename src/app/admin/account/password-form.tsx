'use client'

import { useActionState } from 'react'
import { changePasswordAction, type PasswordResult } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordResult | null, FormData>(changePasswordAction, null)

  return (
    // Keyed on success so the three fields empty themselves once it is done.
    <form action={formAction} key={state?.ok ? 'done' : 'form'} className="space-y-4 p-4 sm:p-5">
      {state && (
        <Alert variant={state.ok ? 'default' : 'destructive'}>
          {state.ok && <CheckCircle2 className="size-4" />}
          <AlertDescription>{state.ok ? state.message : state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="current">Current password</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="next">New password</Label>
        <Input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required />
        <p className="text-xs text-muted-foreground">
          At least 10 characters. A short sentence is easy to remember and hard to guess.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">New password again</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
        Change password
      </Button>
    </form>
  )
}
