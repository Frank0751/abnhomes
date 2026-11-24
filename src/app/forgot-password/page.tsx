import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ForgotForm } from './forgot-form'

export const metadata: Metadata = {
  title: 'Forgot your password',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-sm">
        <Link href="/" className="mb-10 inline-flex items-center gap-3">
          <Image src="/images/logo/abn-badge.png" alt="ABN Homes" width={40} height={40} className="rounded-sm" />
          <span className="font-serif text-lg tracking-tight">ABN Homes</span>
        </Link>

        <h1 className="font-serif text-3xl tracking-tight text-balance">Forgot your password?</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground text-balance">
          For staff accounts. Enter your work email and we will send a link to choose a new one.
        </p>

        <ForgotForm />

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Guests sign in with a booking code, not a password. Trouble? Call the office on{' '}
          <a href="tel:+233541704048" className="underline underline-offset-2">
            054 170 4048
          </a>
          .
        </p>
      </div>
    </main>
  )
}
