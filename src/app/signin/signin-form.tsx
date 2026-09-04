'use client'

/**
 * Two ways in, on one screen.
 *
 * Staff have email addresses and passwords. Tenants, owners and vendors have
 * phone numbers — expecting a tenant to remember a password for a portal they
 * open four times a year is expecting them not to use it.
 */

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'

export function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') ?? '/admin'

  return (
    <Tabs defaultValue="staff" className="mt-8">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="staff">Staff</TabsTrigger>
        <TabsTrigger value="phone">Tenant, owner or vendor</TabsTrigger>
      </TabsList>

      <TabsContent value="staff" className="mt-6">
        <StaffForm callbackUrl={callbackUrl} onDone={(url) => router.push(url)} />
      </TabsContent>

      <TabsContent value="phone" className="mt-6">
        <PhoneForm callbackUrl={callbackUrl} onDone={(url) => router.push(url)} />
      </TabsContent>
    </Tabs>
  )
}

function StaffForm({
  callbackUrl,
  onDone,
}: {
  callbackUrl: string
  onDone: (url: string) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const result = await signIn('staff', {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      redirect: false,
    })

    setPending(false)

    if (result?.error) {
      setError('That email and password did not match an active account.')
      return
    }
    onDone(callbackUrl)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@abnhomes.com.gh"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  )
}

function PhoneForm({
  callbackUrl,
  onDone,
}: {
  callbackUrl: string
  onDone: (url: string) => void
}) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const response = await fetch('/api/auth/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const data = (await response.json()) as {
      ok: boolean
      message: string
      devCode?: string
    }

    setPending(false)

    if (!data.ok) {
      setError(data.message)
      return
    }

    setStep('code')
    // Shown only when no SMS gateway is configured.
    setNotice(
      data.devCode
        ? `No SMS gateway is configured, so here is the code: ${data.devCode}`
        : data.message
    )
  }

  async function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const result = await signIn('otp', {
      phone,
      code: String(form.get('code') ?? ''),
      redirect: false,
    })

    setPending(false)

    if (result?.error) {
      setError('That code was not right, or it has expired. Request a new one.')
      return
    }
    onDone(callbackUrl)
  }

  if (step === 'phone') {
    return (
      <form onSubmit={requestCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="024 170 4048"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            We will text you a six-digit code. No password needed.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Send me a code
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={submitCode} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Six-digit code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="tracking-[0.4em] text-center text-lg"
          required
          autoFocus
        />
        {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Sign in
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setStep('phone')
          setError(null)
          setNotice(null)
        }}
      >
        Use a different number
      </Button>
    </form>
  )
}
