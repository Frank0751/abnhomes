'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { forgotPasswordAction, type ForgotResult } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function ForgotForm() {
  const [state, formAction, pending] = useActionState<ForgotResult | null, FormData>(forgotPasswordAction, null)

  if (state?.done) {
    return (
      <div className="mt-8 space-y-5">
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>
            If that address belongs to a staff account, a link to choose a new password is on its way. It works once
            and expires in an hour. Check your spam folder if it has not arrived in a few minutes.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full">
          <Link href="/signin">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {state && !state.done && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
        Email me a link
      </Button>
      <p className="text-center text-sm">
        <Link href="/signin" className="text-muted-foreground underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
