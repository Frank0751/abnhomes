import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { currentActor } from '@/lib/session'
import { ROLE_LABELS } from '@/lib/rbac'
import { db } from '@/lib/db'
import { SessionProvider } from '@/components/admin/providers'
import { SignOutButton } from '@/components/admin/sign-out-button'

export const metadata: Metadata = {
  title: { default: 'Your account', template: '%s | ABN Homes' },
  robots: { index: false, follow: false },
}

/**
 * The portal shell.
 *
 * Deliberately thin. A tenant opens this four times a year to check a balance
 * or report a leak; anything resembling an admin console would be in the way.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor()
  if (!actor) redirect('/signin?callbackUrl=/portal')

  const user = await db.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { name: true, role: true },
  })

  return (
    <SessionProvider>
      <div className="min-h-dvh bg-[#f7f5f0] bg-[radial-gradient(1100px_420px_at_50%_-120px,rgba(13,148,136,0.08),transparent)]">
        <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#faf8f3]/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3.5">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/images/logo/abn-badge.png" alt="" width={30} height={30} />
              <span className="font-serif text-base tracking-tight">ABN Homes</span>
            </Link>

            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <p className="text-[13px] font-medium">{user.name}</p>
                <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</p>
              </div>
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-5 py-8 sm:py-12">{children}</main>

        <footer className="mx-auto max-w-4xl px-5 pb-10 text-xs text-muted-foreground">
          <p>
            ABN Homes Company Limited · 8 Asiko Street, Tantra Hill, Accra ·{' '}
            <a href="tel:+233541704048" className="underline underline-offset-2">
              054 170 4048
            </a>
          </p>
        </footer>
      </div>
    </SessionProvider>
  )
}
