import Link from 'next/link'
import { COMPANY } from '@/lib/abn-data'

/**
 * The frame the policy pages share: a readable column, a date, and the same
 * way to reach a person at the bottom of each.
 */
export function LegalPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string
  intro: string
  /** Shown as written, e.g. "24 November 2026". */
  updated: string
  children: React.ReactNode
}) {
  return (
    <main className="bg-[#f5f7f5] pb-24 pt-28">
      <article className="mx-auto max-w-3xl px-5">
        <nav className="mb-4 text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{title}</span>
        </nav>
        <h1 className="font-serif text-4xl tracking-tight text-balance">{title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">{intro}</p>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {updated}</p>

        <div className="mt-8 space-y-8 rounded-2xl border border-black/[0.08] bg-white px-6 py-7 sm:px-8">{children}</div>

        <section className="mt-8 text-sm leading-relaxed text-foreground/80">
          <h2 className="font-serif text-lg tracking-tight text-foreground">Talk to us</h2>
          <p className="mt-2">
            {COMPANY.fullName}, {COMPANY.address}. Call or WhatsApp{' '}
            <a href={COMPANY.whatsapp} className="underline underline-offset-2">
              {COMPANY.phone}
            </a>{' '}
            or email{' '}
            <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-2">
              {COMPANY.email}
            </a>
            . {COMPANY.hours}.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link href="/terms" className="underline underline-offset-2">
              Terms of service
            </Link>
            <Link href="/privacy" className="underline underline-offset-2">
              Privacy policy
            </Link>
            <Link href="/cancellation-policy" className="underline underline-offset-2">
              Cancellation policy
            </Link>
          </p>
        </section>
      </article>
    </main>
  )
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-xl tracking-tight">{title}</h2>
      <div className="mt-2.5 space-y-2.5 text-[15px] leading-relaxed text-foreground/85 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
