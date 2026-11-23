'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { setPasswordAction, type SetPasswordResult } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function SetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<SetPasswordResult | null, FormData>(
    setPasswordAction.bind(null, token),
    null
  )

  if (state?.ok) {
    return (
      <div className="mt-8 space-y-5">
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>Your password is set. Sign in with {state.email} and your new password.</AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/signin">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {state && !state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus />
        <p className="text-xs text-muted-foreground">At least 10 characters. A short sentence is easy to remember and hard to guess.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Type it again</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
        Save password
      </Button>
    </form>
  )
}
