/**
 * Six months of one room's revenue.
 *
 * Deliberately CSS rather than a charting library: six bars do not justify a
 * runtime dependency, and drawing it this way means it inherits the theme
 * tokens exactly and prints correctly.
 *
 * Every bar is labelled with the figure it represents, so the chart is read
 * rather than estimated — and it stays legible with no colour at all.
 */

import type { Currency } from '@prisma/client'
import { formatMinor } from '@/lib/core/money'
import type { RoomMonth } from '@/lib/reporting/rooms'
import { cn } from '@/lib/utils'

export function RoomRevenueChart({
  data,
  currency,
}: {
  data: RoomMonth[]
  currency: Currency
}) {
  const peak = Math.max(...data.map((d) => d.revenueMinor), 1)
  const total = data.reduce((s, d) => s + d.revenueMinor, 0)
  const best = data.reduce((a, b) => (b.revenueMinor > a.revenueMinor ? b : a), data[0])

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nothing earned yet. Figures appear here as soon as this room is booked.
      </p>
    )
  }

  return (
    <figure className="space-y-4">
      <figcaption className="sr-only">
        Revenue by month for the last {data.length} months, in {currency}
      </figcaption>

      <div className="flex items-end gap-2" style={{ height: '140px' }}>
        {data.map((month) => {
          const height = Math.max(3, Math.round((month.revenueMinor / peak) * 100))
          const isBest = month.month === best.month && month.revenueMinor > 0

          return (
            <div
              key={month.month}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              title={`${month.month}: ${formatMinor(month.revenueMinor, currency)} from ${month.nightsSold} night${month.nightsSold === 1 ? '' : 's'}`}
            >
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {month.revenueMinor === 0
                  ? '—'
                  : formatMinor(month.revenueMinor, currency, { compact: true })}
              </span>
              <div
                className={cn(
                  'w-full rounded-t-md transition-all duration-500',
                  isBest ? 'bg-[var(--accent)]' : 'bg-[var(--accent)]/35'
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 border-t border-border pt-2">
        {data.map((month) => (
          <div
            key={month.month}
            className="min-w-0 flex-1 text-center text-[11px] text-muted-foreground"
          >
            {month.month}
          </div>
        ))}
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Six-month total</dt>
          <dd className="font-mono font-bold tabular-nums">
            {formatMinor(total, currency)}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Best month</dt>
          <dd className="font-medium">
            {best.month} · {formatMinor(best.revenueMinor, currency)}
          </dd>
        </div>
      </dl>
    </figure>
  )
}
