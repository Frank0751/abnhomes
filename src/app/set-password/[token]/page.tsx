import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { findInvite } from '@/lib/staff-invites'
import { SetPasswordForm } from './set-password-form'

export const metadata: Metadata = {
  title: 'Choose your password',
  robots: { index: false, follow: false },
}

// Never cache: whether the link still works is decided on every visit.
export const dynamic = 'force-dynamic'

export default async function SetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await findInvite(token)

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-sm">
        <Link href="/" className="mb-10 inline-flex items-center gap-3">
          <Image src="/images/logo/abn-badge.png" alt="ABN Homes" width={40} height={40} className="rounded-sm" />
          <span className="font-serif text-lg tracking-tight">ABN Homes</span>
        </Link>

        {invite ? (
          <>
            <h1 className="font-serif text-3xl tracking-tight text-balance">
              {invite.user.passwordHash ? 'Choose a new password' : `Welcome, ${invite.user.name.split(' ')[0]}`}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground text-balance">
              Choose the password you will use to sign in as <strong className="text-foreground">{invite.user.email}</strong>.
            </p>
            <SetPasswordForm token={token} />
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl tracking-tight text-balance">This link no longer works</h1>
            <p className="mt-2 text-sm text-muted-foreground text-balance">
              It has expired, has already been used, or a newer one has been sent. Ask an administrator to send you
              a fresh invitation.
            </p>
            <Link href="/signin" className="mt-6 inline-block text-sm font-medium underline underline-offset-2">
              Go to sign in
            </Link>
          </>
        )}

        <p className="mt-10 text-xs text-muted-foreground">
          Trouble? Call the office on{' '}
          <a href="tel:+233541704048" className="underline underline-offset-2">
            054 170 4048
          </a>
          .
        </p>
      </div>
    </main>
  )
}
