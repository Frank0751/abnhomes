import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  BadgeCheck,
  CircleDashed,
  CircleX,
  ClipboardCheck,
  FileSignature,
  KeyRound,
  Search,
} from 'lucide-react'
import { db } from '@/lib/db'
import { formatMoney } from '@/lib/sales/public'

export const metadata: Metadata = {
  title: 'Track your application - ABN Homes',
  description: 'Follow your ABN Homes purchase or rental application with your tracking code.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type Step = {
  label: string
  detail: string
  state: 'done' | 'current' | 'todo' | 'failed'
}

const PURCHASE_STEPS: Record<string, { label: string; detail: string }[]> = {
  APPLICATION: [
    { label: 'Offer received', detail: 'Your application is with our sales team.' },
    { label: 'Review', detail: 'We confirm availability and agree the price with you.' },
    { label: 'Contract signed', detail: 'Sale agreement signed, payment plan frozen in.' },
    { label: 'Installments', detail: 'You pay per the plan; every payment posts to your account.' },
    { label: 'Keys handed over', detail: 'The home is yours.' },
  ],
}

const TENANCY_STEPS = [
  { label: 'Application received', detail: 'Your application is with our leasing team.' },
  { label: 'Screening', detail: 'ID and income checks, references where needed.' },
  { label: 'Approved', detail: 'We prepare your lease and call you to sign.' },
  { label: 'Lease signed', detail: 'Deposit paid, move-in scheduled.' },
  { label: 'Welcome home', detail: 'Your tenant portal goes live on day one.' },
]

function stepState(index: number, current: number, failed: boolean, closed: boolean): Step['state'] {
  if (failed) return index < current ? 'done' : index === current ? 'failed' : 'todo'
  if (closed) return index <= current ? 'done' : 'todo'
  if (index < current) return 'done'
  if (index === current) return 'current'
  return 'todo'
}

function StepIcon({ state, n }: { state: Step['state']; n: number }) {
  if (state === 'failed') return <CircleX className="size-6 text-red-500" />
  if (state === 'done') return <BadgeCheck className="size-6 text-[#0d9488]" />
  if (state === 'current') return (
    <span className="flex size-6 items-center justify-center rounded-full bg-[#0d9488] font-mono text-[11px] font-bold text-white">
      {n}
    </span>
  )
  return <CircleDashed className="size-6 text-black/25" />
}

export default async function TrackPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params
  const code = decodeURIComponent(rawCode).trim().toUpperCase()

  if (code.startsWith('OWN-')) {
    const purchase = await db.purchase.findUnique({
      where: { code },
      include: {
        unit: { select: { name: true, images: true, code: true } },
        property: { select: { name: true, city: true, neighbourhood: true } },
        charges: { select: { amountMinor: true, status: true, allocations: { select: { amountMinor: true } } } },
      },
    })
    if (!purchase) notFound()

    const steps = PURCHASE_STEPS.APPLICATION
    const statusMap: Record<string, number> = { APPLICATION: 0, APPROVED: 1, CONTRACTED: 3, COMPLETED: 4, DECLINED: 1, CANCELLED: 0 }
    const current = statusMap[purchase.status] ?? 0
    const failed = purchase.status === 'DECLINED' || purchase.status === 'CANCELLED'
    const closed = purchase.status === 'COMPLETED'

    const owed = purchase.charges.filter((c) => c.status !== 'REVERSED' && c.status !== 'WAIVED').reduce((s, c) => s + c.amountMinor, 0)
    const paid = purchase.charges.reduce((s, c) => s + c.allocations.reduce((a, al) => a + al.amountMinor, 0), 0)

    return (
      <TrackShell
        title={`Offer ${purchase.code}`}
        subtitle={`${purchase.unit.name} · ${purchase.property.name}${purchase.property.neighbourhood ? `, ${purchase.property.neighbourhood}` : ''}`}
        image={purchase.unit.images[0] ?? null}
        badge={purchase.status}
        badgeFailed={failed}
      >
        <ol className="space-y-6">
          {steps.map((s, i) => {
            const state = stepState(i, current, failed, closed)
            return (
              <li key={s.label} className="flex gap-4">
                <StepIcon state={state} n={i + 1} />
                <div>
                  <h3 className={`font-medium ${state === 'todo' ? 'text-black/40' : 'text-[#1a1f2e]'}`}>{s.label}</h3>
                  <p className={`mt-0.5 text-sm ${state === 'todo' ? 'text-black/35' : 'text-[#5b6472]'}`}>{s.detail}</p>
                  {state === 'current' && i === 1 && purchase.status === 'APPROVED' && (
                    <p className="mt-2 rounded-lg bg-[#0d9488]/10 px-3 py-2 text-xs font-medium text-[#0f766e]">
                      Approved — our sales team will call {purchase.buyerPhone} to agree the payment plan.
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        {purchase.status === 'CONTRACTED' || purchase.status === 'COMPLETED' ? (
          <div className="mt-8 rounded-xl bg-[#faf8f3] p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#5b6472]">Agreed price</span>
              <span className="font-medium text-[#1a1f2e]">{formatMoney(purchase.offerMinor, purchase.currency)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-[#5b6472]">Paid so far</span>
              <span className="font-medium text-[#0f766e]">{formatMoney(paid, purchase.currency)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-[#5b6472]">Outstanding</span>
              <span className="font-medium text-[#1a1f2e]">{formatMoney(Math.max(0, owed - paid), purchase.currency)}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/8">
              <div className="h-full rounded-full bg-[#0d9488]" style={{ width: `${owed > 0 ? Math.min(100, (paid / owed) * 100) : 100}%` }} />
            </div>
            <p className="mt-3 text-xs text-[#5b6472]">
              Payments post to a double-entry ledger — the figures here are the ledger, not a promise.
            </p>
          </div>
        ) : null}

        {purchase.status === 'DECLINED' && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <p className="font-medium">This offer was not taken forward.</p>
            {purchase.decisionNote && <p className="mt-1">{purchase.decisionNote}</p>}
            <p className="mt-2">You can apply for any other open home, or <Link href="/contact" className="underline">talk to our team</Link> about alternatives.</p>
          </div>
        )}
        {purchase.status === 'CANCELLED' && (
          <div className="mt-8 rounded-xl border border-black/10 bg-white p-5 text-sm text-[#5b6472]">
            This application was closed. {purchase.cancelReason ? `Reason: ${purchase.cancelReason}` : ''}
          </div>
        )}
      </TrackShell>
    )
  }

  if (code.startsWith('RNT-')) {
    const application = await db.tenancyApplication.findUnique({
      where: { code },
      include: {
        unit: { select: { name: true, images: true, baseRentMinor: true, currency: true } },
        property: { select: { name: true, city: true, neighbourhood: true } },
      },
    })
    if (!application) notFound()

    const statusMap: Record<string, number> = { NEW: 0, SCREENING: 1, APPROVED: 2, CONVERTED: 4, REJECTED: 1, WITHDRAWN: 0 }
    const current = statusMap[application.status] ?? 0
    const failed = application.status === 'REJECTED' || application.status === 'WITHDRAWN'
    const closed = application.status === 'CONVERTED'

    return (
      <TrackShell
        title={`Application ${application.code}`}
        subtitle={`${application.unit.name} · ${application.property.name}${application.property.neighbourhood ? `, ${application.property.neighbourhood}` : ''}`}
        image={application.unit.images[0] ?? null}
        badge={application.status}
        badgeFailed={failed}
      >
        <ol className="space-y-6">
          {TENANCY_STEPS.map((s, i) => {
            const state = stepState(i, current, failed, closed)
            return (
              <li key={s.label} className="flex gap-4">
                <StepIcon state={state} n={i + 1} />
                <div>
                  <h3 className={`font-medium ${state === 'todo' ? 'text-black/40' : 'text-[#1a1f2e]'}`}>{s.label}</h3>
                  <p className={`mt-0.5 text-sm ${state === 'todo' ? 'text-black/35' : 'text-[#5b6472]'}`}>{s.detail}</p>
                  {state === 'current' && application.status === 'APPROVED' && (
                    <p className="mt-2 rounded-lg bg-[#0d9488]/10 px-3 py-2 text-xs font-medium text-[#0f766e]">
                      Approved — our leasing team will call {application.applicantPhone} to sign your lease.
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-8 grid gap-3 rounded-xl bg-[#faf8f3] p-5 text-sm sm:grid-cols-2">
          <div className="flex items-center justify-between">
            <span className="text-[#5b6472]">Monthly rent</span>
            <span className="font-medium text-[#1a1f2e]">{formatMoney(application.unit.baseRentMinor ?? 0, application.unit.currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5b6472]">Move-in requested</span>
            <span className="font-medium text-[#1a1f2e]">{application.moveInDate.toISOString().slice(0, 10)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5b6472]">Lease length</span>
            <span className="font-medium text-[#1a1f2e]">{application.leaseMonths} months</span>
          </div>
        </div>

        {failed && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <p className="font-medium">
              {application.status === 'REJECTED' ? 'This application was not successful.' : 'This application was withdrawn.'}
            </p>
            {application.decisionNote && <p className="mt-1">{application.decisionNote}</p>}
            <p className="mt-2">Other homes open up weekly — <Link href="/rent" className="underline">browse what&apos;s available</Link>.</p>
          </div>
        )}
        {application.status === 'CONVERTED' && application.leaseId && (
          <div className="mt-8 rounded-xl border border-[#0d9488]/30 bg-[#0d9488]/5 p-5 text-sm text-[#0f766e]">
            <p className="flex items-center gap-2 font-medium">
              <KeyRound className="size-4" /> Your lease is active.
            </p>
            <p className="mt-1">
              Sign in at <Link href="/portal" className="underline">the portal</Link> with your phone number to see your rent
              account, documents, and to report anything that needs fixing.
            </p>
          </div>
        )}
      </TrackShell>
    )
  }

  // Neither family — fall through to a soft not-found page with a lookup form.
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf8f3] px-5">
      <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-8 text-center shadow-soft">
        <Search className="mx-auto mb-4 size-10 text-black/25" />
        <h1 className="font-serif text-2xl text-[#1a1f2e]">We could not find that code</h1>
        <p className="mt-2 text-sm text-[#5b6472]">
          Tracking codes look like <span className="font-mono text-[#1a1f2e]">OWN-4K7X2M</span> for purchases or{' '}
          <span className="font-mono text-[#1a1f2e]">RNT-9QW3TB</span> for rentals. Check the confirmation we sent you.
        </p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-[#0a0e1a] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#1a2233]">
          Back to ABN Homes
        </Link>
      </div>
    </main>
  )
}

function TrackShell({
  title,
  subtitle,
  image,
  badge,
  badgeFailed,
  children,
}: {
  title: string
  subtitle: string
  image: string | null
  badge: string
  badgeFailed: boolean
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-[#faf8f3] bg-[radial-gradient(1100px_420px_at_50%_-120px,rgba(13,148,136,0.10),transparent)]">
      <div className="mx-auto max-w-2xl px-5 py-12">
        <Link href="/" className="font-serif text-lg tracking-tight text-[#1a1f2e]">ABN Homes</Link>
        <div className="mt-6 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft">
          {image && (
            <div className="relative h-44 w-full bg-[#e8e3d8]">
              <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover" />
            </div>
          )}
          <div className="p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-serif text-2xl text-[#1a1f2e]">{title}</h1>
                <p className="mt-1 text-sm text-[#5b6472]">{subtitle}</p>
              </div>
              <span
                className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                  badgeFailed ? 'bg-red-100 text-red-700' : 'bg-[#0d9488]/10 text-[#0f766e]'
                }`}
              >
                {badge}
              </span>
            </div>
            <div className="mt-7">{children}</div>
            <p className="mt-8 flex items-center gap-1.5 border-t border-black/8 pt-5 text-xs text-[#5b6472]">
              <ClipboardCheck className="size-3.5 text-[#0d9488]" />
              Questions about this application? Call <a href="tel:+233541704048" className="underline underline-offset-2">054 170 4048</a> quoting your code.
            </p>
          </div>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#5b6472]">
          <FileSignature className="size-3.5" />
          Every status change on this page is timestamped in ABN&apos;s audit log.
        </p>
      </div>
    </main>
  )
}
