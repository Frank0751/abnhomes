import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { requirePermission } from '@/lib/session'
import { hasPropertyAccess } from '@/lib/rbac'
import { db } from '@/lib/db'
import { formatDate, formatDateTime, today, addDays } from '@/lib/core/dates'
import { formatMinor } from '@/lib/core/money'
import { unitCalendar } from '@/lib/short-stay/availability'
import { feedUrlForUnit } from '@/lib/short-stay/ical'
import {
  Money,
  PageHeader,
  Panel,
  Pill,
  StatusPill,
  TableScroll,
  humanise,
} from '@/components/admin/ui'
import { FeedManager } from './feed-manager'
import { ArrowLeft } from 'lucide-react'

export default async function UnitDetail({
  params,
}: {
  params: Promise<{ unitId: string }>
}) {
  const actor = await requirePermission('units:read')
  const { unitId } = await params

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: {
      property: { select: { id: true, name: true, addressLine: true, city: true } },
      ratePlans: { orderBy: { priority: 'desc' } },
      icalFeeds: true,
      leases: {
        where: { status: 'ACTIVE' },
        include: { tenant: { select: { name: true, phone: true } } },
      },
      blocks: {
        where: { endDate: { gte: today() } },
        orderBy: { startDate: 'asc' },
      },
    },
  })

  if (!unit) notFound()
  if (!hasPropertyAccess(actor, unit.propertyId)) notFound()

  const calendar = await unitCalendar({
    unitId: unit.id,
    from: today(),
    to: addDays(today(), 60),
  })
  const freeNights = calendar.filter((d) => d.available).length

  const host = (await headers()).get('host') ?? 'abnhomes.com.gh'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const publicFeedUrl = feedUrlForUnit(unit.id, `${protocol}://${host}`)

  return (
    <>
      <Link
        href="/admin/portfolio"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Portfolio
      </Link>

      <PageHeader
        title={unit.name}
        description={`${unit.property.name} · ${unit.property.addressLine}, ${unit.property.city}`}
        actions={<StatusPill status={unit.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel title="Details">
            <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-3">
              <Field label="Code" value={unit.code} />
              <Field label="Type" value={humanise(unit.type)} />
              <Field
                label="Let as"
                value={
                  unit.lettingMode === 'BOTH'
                    ? 'Short stay or long let'
                    : unit.lettingMode === 'SHORT_STAY'
                      ? 'Short stay'
                      : 'Long let'
                }
              />
              <Field label="Bedrooms" value={String(unit.bedrooms)} />
              <Field label="Bathrooms" value={String(unit.bathrooms)} />
              <Field label="Sleeps" value={String(unit.maxGuests)} />
              {unit.sizeSqm && <Field label="Size" value={`${unit.sizeSqm} sqm`} />}
              {unit.baseNightlyMinor && (
                <Field
                  label="Base nightly"
                  value={formatMinor(unit.baseNightlyMinor, unit.currency)}
                />
              )}
              {unit.baseRentMinor && (
                <Field label="Base monthly rent" value={formatMinor(unit.baseRentMinor, 'GHS')} />
              )}
              <Field
                label="Free nights, next 60"
                value={`${freeNights} of ${calendar.length}`}
              />
            </dl>

            {unit.features.length > 0 && (
              <div className="border-t border-black/8 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Features
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {unit.features.map((f) => (
                    <Pill key={f}>{f}</Pill>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {unit.leases.length > 0 && (
            <Panel title="Current tenancy">
              {unit.leases.map((lease) => (
                <dl key={lease.id} className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-3">
                  <Field label="Tenant" value={lease.tenant.name} />
                  <Field label="Rent" value={formatMinor(lease.rentMinor, lease.currency)} />
                  <Field label="Cycle" value={humanise(lease.cycle)} />
                  <Field label="Started" value={formatDate(lease.startDate)} />
                  <Field label="Ends" value={formatDate(lease.endDate)} />
                  <Field
                    label="Paid in advance"
                    value={
                      lease.advanceMonths > 0
                        ? `${lease.advanceMonths} months`
                        : 'Billed each cycle'
                    }
                  />
                </dl>
              ))}
            </Panel>
          )}

          <Panel
            title="Rate plans"
            description="The highest-priority plan covering a night sets its price."
          >
            <TableScroll>
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-semibold">Plan</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Window</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Nightly</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Weekly</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Min nights</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {unit.ratePlans.map((plan) => (
                    <tr key={plan.id}>
                      <td className="px-4 py-2.5">
                        {plan.name}
                        {!plan.active && (
                          <Pill tone="neutral" className="ml-2">
                            Inactive
                          </Pill>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {plan.startDate && plan.endDate
                          ? `${formatDate(plan.startDate)} – ${formatDate(plan.endDate)}`
                          : 'All year'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Money minor={plan.nightlyMinor} currency={plan.currency} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {plan.weeklyMinor ? (
                          <Money minor={plan.weeklyMinor} currency={plan.currency} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{plan.minNights}</td>
                    </tr>
                  ))}
                  {unit.ratePlans.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        No rate plans. The base nightly rate is used.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableScroll>
          </Panel>

          {unit.blocks.length > 0 && (
            <Panel title="Blocked dates" description="Not available, and why.">
              <ul className="divide-y divide-black/6">
                {unit.blocks.map((block) => (
                  <li key={block.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm">
                        {formatDate(block.startDate)} – {formatDate(block.endDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {block.reason ?? 'Blocked'}
                      </p>
                    </div>
                    <Pill tone={block.source === 'ICAL' ? 'info' : 'neutral'}>
                      {block.source === 'ICAL' ? 'Imported' : humanise(block.source)}
                    </Pill>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <FeedManager
            unitId={unit.id}
            publicFeedUrl={publicFeedUrl}
            feeds={unit.icalFeeds.map((f) => ({
              id: f.id,
              label: f.label,
              url: f.url,
              lastSyncAt: f.lastSyncAt ? formatDateTime(f.lastSyncAt) : null,
              lastError: f.lastError,
              eventCount: f.eventCount,
            }))}
          />
        </aside>
      </div>
    </>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  )
}
