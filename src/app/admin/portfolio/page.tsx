import Link from 'next/link'
import { requirePermission } from '@/lib/session'
import { propertyWhere } from '@/lib/rbac'
import { db } from '@/lib/db'
import { formatMinor, basisPointsToPercent } from '@/lib/core/money'
import {
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  StatusPill,
  TableScroll,
  humanise,
} from '@/components/admin/ui'
import { Building2 } from 'lucide-react'

export default async function PortfolioPage() {
  const actor = await requirePermission('units:read')

  const properties = await db.property.findMany({
    where: { active: true, ...propertyWhere(actor) },
    include: {
      owner: { select: { name: true } },
      agreements: { where: { active: true }, take: 1 },
      units: { orderBy: { code: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  const totalUnits = properties.reduce((s, p) => s + p.units.length, 0)
  const shortStay = properties.reduce(
    (s, p) => s + p.units.filter((u) => u.lettingMode !== 'LONG_LET').length,
    0
  )
  const longLet = properties.reduce(
    (s, p) => s + p.units.filter((u) => u.lettingMode !== 'SHORT_STAY').length,
    0
  )
  const occupied = properties.reduce(
    (s, p) => s + p.units.filter((u) => u.status === 'OCCUPIED').length,
    0
  )

  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Buildings, units and who owns them. ABN's own properties and those managed for clients run on identical rails."
      />

      <StatGrid>
        <StatCard label="Properties" value={String(properties.length)} />
        <StatCard label="Units" value={String(totalUnits)} sublabel={`${occupied} occupied`} />
        <StatCard label="Short stay" value={String(shortStay)} sublabel="Nightly or either" />
        <StatCard label="Long let" value={String(longLet)} sublabel="Monthly or either" />
      </StatGrid>

      <div className="mt-8 space-y-6">
        {properties.length === 0 && (
          <EmptyState
            title="No properties assigned"
            description="Ask an administrator to give you access to a building."
          />
        )}

        {properties.map((property) => {
          const agreement = property.agreements[0]

          return (
            <Panel
              key={property.id}
              title={property.name}
              description={`${property.addressLine}, ${property.city}`}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="neutral">
                    <Building2 className="mr-1 inline size-3" />
                    {property.owner.name}
                  </Pill>
                  {agreement && (
                    <Pill tone={agreement.feeBasisPoints > 0 ? 'info' : 'neutral'}>
                      {agreement.feeBasisPoints > 0
                        ? `${basisPointsToPercent(agreement.feeBasisPoints)} management fee`
                        : 'Owned by ABN'}
                    </Pill>
                  )}
                  {!property.published && <Pill tone="warning">Not listed publicly</Pill>}
                </div>
              }
            >
              <TableScroll>
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-semibold">Unit</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Let as</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Nightly</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Monthly</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/6">
                    {property.units.map((unit) => (
                      <tr key={unit.id} className="hover:bg-black/[0.02]">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/admin/portfolio/${unit.id}`}
                            className="font-medium hover:underline"
                          >
                            {unit.name}
                          </Link>
                          <span className="block text-xs text-muted-foreground">{unit.code}</span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {humanise(unit.type)} · {unit.bedrooms} bed
                        </td>
                        <td className="px-4 py-2.5">
                          <Pill
                            tone={
                              unit.lettingMode === 'BOTH'
                                ? 'info'
                                : unit.lettingMode === 'SHORT_STAY'
                                  ? 'neutral'
                                  : 'neutral'
                            }
                          >
                            {unit.lettingMode === 'BOTH'
                              ? 'Either'
                              : unit.lettingMode === 'SHORT_STAY'
                                ? 'Short stay'
                                : 'Long let'}
                          </Pill>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {unit.baseNightlyMinor
                            ? formatMinor(unit.baseNightlyMinor, unit.currency)
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {unit.baseRentMinor ? formatMinor(unit.baseRentMinor, 'GHS') : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill status={unit.status} />
                        </td>
                      </tr>
                    ))}
                    {property.units.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                          No units recorded for this building yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </TableScroll>
            </Panel>
          )
        })}
      </div>
    </>
  )
}
