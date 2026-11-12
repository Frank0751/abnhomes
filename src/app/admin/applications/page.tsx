import Link from 'next/link'
import Image from 'next/image'
import { Building2, CalendarClock, KeyRound, Mail, Phone, ShieldQuestion } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { PageHeader, Panel, StatGrid, StatCard, EmptyState, Pill, humanise } from '@/components/admin/ui'
import { formatMinor } from '@/lib/core/money'
import { formatDate } from '@/lib/core/dates'
import { PurchaseReviewActions, PurchaseContractForm, TenancyReviewActions } from '@/components/admin/application-actions'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'tenancy', label: 'Rentals' },
  { key: 'sales', label: 'Purchases' },
] as const

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requirePermission('applications:read')
  const { tab: rawTab } = await searchParams
  const tab = rawTab === 'sales' ? 'sales' : 'tenancy'

  const [newTenancy, screening, approvedTenancy, newPurchase, approvedPurchase] = await Promise.all([
    db.tenancyApplication.count({ where: { status: 'NEW' } }),
    db.tenancyApplication.count({ where: { status: 'SCREENING' } }),
    db.tenancyApplication.count({ where: { status: 'APPROVED' } }),
    db.purchase.count({ where: { status: 'APPLICATION' } }),
    db.purchase.count({ where: { status: 'APPROVED' } }),
  ])

  return (
    <div>
      <PageHeader
        title="Applications"
        description="Everyone who asked to rent or buy through the public site. Approve, screen and convert — every decision is audit-logged and messaged to the applicant."
      />

      <StatGrid>
        <StatCard label="New rental applications" value={String(newTenancy)} sublabel="waiting for a first look" />
        <StatCard label="In screening" value={String(screening)} sublabel="ID / income checks underway" />
        <StatCard label="Approved, awaiting lease" value={String(approvedTenancy)} sublabel="ready to convert" />
        <StatCard label="Purchase offers" value={String(newPurchase + approvedPurchase)} sublabel={`${newPurchase} fresh · ${approvedPurchase} approved`} />
      </StatGrid>

      <div className="mb-5 mt-6 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/applications?tab=${t.key}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? 'bg-primary text-primary-foreground' : 'border border-black/10 bg-white hover:bg-black/5'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'tenancy' ? <TenancyQueue /> : <PurchaseQueue />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rentals
// ---------------------------------------------------------------------------

const TENANCY_TONE: Record<string, 'positive' | 'warning' | 'neutral' | 'critical'> = {
  NEW: 'warning',
  SCREENING: 'warning',
  APPROVED: 'positive',
  CONVERTED: 'positive',
  REJECTED: 'critical',
  WITHDRAWN: 'neutral',
}

async function TenancyQueue() {
  const applications = await db.tenancyApplication.findMany({
    where: { status: { in: ['NEW', 'SCREENING', 'APPROVED'] } },
    include: {
      unit: { select: { name: true, baseRentMinor: true, currency: true, images: true, property: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })

  if (applications.length === 0) {
    return (
      <Panel title="No open rental applications">
        <EmptyState
          title="The queue is clear"
          description="New applications from /rent appear here the moment they are submitted."
        />
      </Panel>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {applications.map((a) => (
        <Panel key={a.id} title={a.code} description={`${a.applicantName} · applied ${formatDate(a.createdAt)}`}>
          <div className="flex gap-4 px-5">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-black/8 bg-[#e8e3d8]">
              {a.unit.images[0] && <Image src={a.unit.images[0]} alt="" fill sizes="80px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={TENANCY_TONE[a.status] ?? 'neutral'}>{humanise(a.status)}</Pill>
                <span className="text-sm font-medium text-[#1a1f2e]">{a.unit.name}</span>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="size-3" /> {a.unit.property.name} ·{' '}
                {a.unit.baseRentMinor ? formatMinor(a.unit.baseRentMinor, a.unit.currency) : '—'}/mo
              </p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Phone className="size-3" />{a.applicantPhone}</span>
                {a.applicantEmail && <span className="flex items-center gap-1"><Mail className="size-3" />{a.applicantEmail}</span>}
                <span className="flex items-center gap-1"><CalendarClock className="size-3" />move-in {formatDate(a.moveInDate)} · {a.leaseMonths}mo</span>
              </p>
              {a.employer && <p className="mt-0.5 text-xs text-muted-foreground">Income: {a.employer}</p>}
              {a.ghanaCard && <p className="font-mono text-[11px] text-muted-foreground">{a.ghanaCard}</p>}
              {a.notes && <p className="mt-1.5 rounded bg-black/[0.04] px-2 py-1.5 text-xs italic text-muted-foreground">“{a.notes}”</p>}
            </div>
          </div>
          <div className="px-5 pb-5 pt-4">
            <TenancyReviewActions applicationId={a.id} status={a.status} suggestedRentMinor={a.unit.baseRentMinor ?? 0} />
          </div>
        </Panel>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

async function PurchaseQueue() {
  const purchases = await db.purchase.findMany({
    where: { status: { in: ['APPLICATION', 'APPROVED'] } },
    include: {
      unit: { select: { name: true, salePriceMinor: true, saleCurrency: true, images: true, property: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })

  if (purchases.length === 0) {
    return (
      <Panel title="No open purchase offers">
        <EmptyState
          title="No offers to review"
          description="Applications from /own appear here. The buyer tracks progress with their OWN- code."
        />
      </Panel>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {purchases.map((p) => (
        <Panel key={p.id} title={p.code} description={`${p.buyerName} · applied ${formatDate(p.createdAt)}`}>
          <div className="flex gap-4 px-5">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-black/8 bg-[#e8e3d8]">
              {p.unit.images[0] && <Image src={p.unit.images[0]} alt="" fill sizes="80px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={p.status === 'APPLICATION' ? 'warning' : 'positive'}>{humanise(p.status)}</Pill>
                <span className="text-sm font-medium text-[#1a1f2e]">{p.unit.name}</span>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="size-3" /> {p.unit.property.name} · asking{' '}
                {p.unit.salePriceMinor ? formatMinor(p.unit.salePriceMinor, p.unit.saleCurrency) : '—'}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Phone className="size-3" />{p.buyerPhone}</span>
                {p.buyerEmail && <span className="flex items-center gap-1"><Mail className="size-3" />{p.buyerEmail}</span>}
              </p>
              {p.buyerNotes && <p className="mt-1.5 rounded bg-black/[0.04] px-2 py-1.5 text-xs italic text-muted-foreground">“{p.buyerNotes}”</p>}
            </div>
          </div>
          <div className="px-5 pb-5 pt-4">
            {p.status === 'APPLICATION' ? (
              <PurchaseReviewActions purchaseId={p.id} />
            ) : (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#0f766e]">
                  <ShieldQuestion className="size-3.5" />
                  Approved — agree the plan below to contract this sale
                </p>
                <PurchaseContractForm purchaseId={p.id} suggestedOffer={p.unit.salePriceMinor ?? p.offerMinor} />
              </div>
            )}
          </div>
        </Panel>
      ))}
    </div>
  )
}
