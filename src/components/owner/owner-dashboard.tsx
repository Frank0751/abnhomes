import type { OwnerDashboard } from '@/lib/reporting/owner'
import { formatMinor } from '@/lib/core/money'
import { Delta, Panel, StatCard, StatGrid, TableScroll } from '@/components/admin/ui'

const pct = (n: number) => `${Math.round(n * 100)}%`

/**
 * How the buildings are doing: this month beside last month, the last six
 * months, each room, and today. Shared by the owner's own portal and the
 * office's view of an owner, so both always see the same figures.
 */
export function OwnerDashboardView({ data }: { data: OwnerDashboard }) {
  const cur = data.months[data.months.length - 1]
  const prev = data.months[data.months.length - 2]
  const money = (minor: number) => formatMinor(minor, data.currency)
  const peak = Math.max(1, ...data.months.map((m) => m.revenueMinor))
  const monthName = cur.start.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
  const prevName = prev?.start.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard
          label={`Revenue, ${monthName}`}
          value={money(cur.revenueMinor)}
          sublabel={prev ? `${money(prev.revenueMinor)} in ${prevName}` : undefined}
          delta={prev && <Delta current={cur.revenueMinor} previous={prev.revenueMinor} label="" />}
        />
        <StatCard
          label="Occupancy"
          value={pct(cur.occupancy)}
          sublabel={`${cur.nightsSold} of ${cur.nightsAvailable} nights booked${prev ? ` · ${pct(prev.occupancy)} in ${prevName}` : ''}`}
          delta={prev && <Delta current={cur.occupancy} previous={prev.occupancy} label="" />}
        />
        <StatCard
          label="Average per night"
          value={cur.adrMinor ? money(cur.adrMinor) : '—'}
          sublabel={prev?.adrMinor ? `${money(prev.adrMinor)} in ${prevName}` : 'Earned per night sold'}
          delta={prev && <Delta current={cur.adrMinor} previous={prev.adrMinor} label="" />}
        />
        <StatCard
          label="Stays"
          value={String(cur.bookings)}
          sublabel={prev ? `${prev.bookings} in ${prevName}` : undefined}
          delta={prev && <Delta current={cur.bookings} previous={prev.bookings} label="" />}
        />
      </StatGrid>
      <p className="-mt-3 text-xs text-muted-foreground">
        {monthName} is not over: its figures include nights already booked for the rest of the month, and grow as more
        are sold. Revenue is counted when it is earned, the same way as your statements. Occupancy is measured across
        the {data.roomsOnTheMarket} room{data.roomsOnTheMarket === 1 ? '' : 's'} on the market.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title="Today" description="Across your buildings.">
          <dl className="grid grid-cols-3 divide-x divide-black/[0.06] text-center">
            {[
              ['In house', data.today.inHouse],
              ['Arriving', data.today.arriving],
              ['Leaving', data.today.leaving],
            ].map(([label, value]) => (
              <div key={label} className="px-3 py-5">
                <dd className="font-serif text-3xl tracking-tight tabular-nums">{value}</dd>
                <dt className="mt-1 text-xs text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
          <p className="border-t border-black/[0.06] px-4 py-3 text-sm text-foreground/85">
            Next 30 days:{' '}
            <strong className="font-medium">
              {data.ahead.bookings} confirmed stay{data.ahead.bookings === 1 ? '' : 's'}
            </strong>{' '}
            holding {data.ahead.nights} night{data.ahead.nights === 1 ? '' : 's'}.
          </p>
        </Panel>

        <Panel title="Last six months" description="Revenue earned each month, and how full the rooms were.">
          <ol className="flex items-end gap-2 px-4 pb-4 pt-5 sm:gap-3">
            {data.months.map((m) => (
              <li key={m.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] tabular-nums text-muted-foreground">{pct(m.occupancy)}</span>
                <div className="flex h-28 w-full items-end rounded-md bg-black/[0.04]">
                  <div
                    className="w-full rounded-md bg-[#00a878]"
                    style={{ height: `${Math.max(m.revenueMinor > 0 ? 4 : 0, (m.revenueMinor / peak) * 100)}%` }}
                    title={`${m.label}: ${money(m.revenueMinor)}`}
                  />
                </div>
                <span className="w-full truncate text-center text-[11px] font-medium tabular-nums">
                  {m.revenueMinor > 0 ? money(m.revenueMinor) : '—'}
                </span>
                <span className="text-[11px] text-muted-foreground">{m.label}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel title="Room by room" description={`${monthName} so far, beside ${prevName ?? 'the month before'}.`}>
        {data.rooms.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No rooms on these buildings yet.</p>
        ) : (
          <TableScroll>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-black/8 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Room</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Nights</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Occupancy</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Avg / night</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Revenue</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{prevName ?? 'Before'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {data.rooms.map((r) => (
                  <tr key={r.unitId}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{r.name}</span>
                      <span className="block text-xs text-muted-foreground">{r.propertyName}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.thisMonth.nightsSold}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{pct(r.thisMonth.occupancy)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.thisMonth.adrMinor ? money(r.thisMonth.adrMinor) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(r.thisMonth.revenueMinor)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {money(r.lastMonth.revenueMinor)}
                      <span className="block text-xs">{pct(r.lastMonth.occupancy)} full</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </div>
  )
}
