import { Tag, Pause, Play } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { PageHeader, Panel, Pill, EmptyState } from '@/components/admin/ui'
import { formatDate } from '@/lib/core/dates'
import { createCouponAction, toggleCouponAction } from './actions'
import { CouponForm, CouponToggle } from './coupon-forms'

export const dynamic = 'force-dynamic'

function describe(c: { kind: string; value: number; currency: string }): string {
  return c.kind === 'PERCENT' ? `${c.value / 100}% off` : `${c.value / 100} ${c.currency} off`
}

export default async function PromotionsPage() {
  await requirePermission('promotions:manage')

  const coupons = await db.coupon.findMany({
    include: { redemptions: { select: { amountMinor: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <PageHeader
        title="Promotions"
        description="Coupon codes with real limits — spend floors, per-guest caps, first-booking-only, expiry — enforced at checkout, not on trust."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Codes">
          {coupons.length === 0 ? (
            <EmptyState title="No coupons yet" description="Create the first code on the right — WELCOME10 is a good start." />
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {coupons.map((c) => {
                const redeemed = c.redemptions.length
                const givenMinor = c.redemptions.reduce((s, r) => s + r.amountMinor, 0)
                const expired = c.endsAt && c.endsAt < new Date()
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Tag className="size-3.5 text-[#0d9488]" />
                        <span className="font-mono tracking-wide">{c.code}</span>
                        <Pill tone={c.active && !expired ? 'positive' : 'neutral'}>
                          {expired ? 'Expired' : c.active ? 'Live' : 'Paused'}
                        </Pill>
                        {c.firstBookingOnly && <Pill tone="info">First booking</Pill>}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {describe(c)} · min spend {(c.minSpendMinor / 100).toFixed(0)} {c.currency}
                        {c.maxDiscountMinor ? ` · capped ${(c.maxDiscountMinor / 100).toFixed(0)} ${c.currency}` : ''}
                        {c.maxRedemptions ? ` · ${redeemed}/${c.maxRedemptions} used` : ` · ${redeemed} used`}
                        {c.endsAt ? ` · until ${formatDate(c.endsAt)}` : ''}
                        {givenMinor > 0 ? ` · given away ${(givenMinor / 100).toFixed(2)} ${c.currency}` : ''}
                      </p>
                      {c.note && <p className="mt-0.5 text-xs text-muted-foreground/80">{c.note}</p>}
                    </div>
                    <CouponToggle id={c.id} active={c.active} action={toggleCouponAction} />
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Create a coupon">
          <CouponForm action={createCouponAction} />
        </Panel>
      </div>
    </div>
  )
}
