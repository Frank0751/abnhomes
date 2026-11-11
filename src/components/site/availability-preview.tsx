import type { CalendarDay } from '@/lib/short-stay/availability'

/**
 * Two months of availability, guest-facing: green means bookable. No guest
 * names, no internal reasons — just the nights that are real.
 */
export function AvailabilityPreview({ days }: { days: CalendarDay[] }) {
  const months: { label: string; weeks: (CalendarDay | null)[][] }[] = buildMonths(days)
  const firstWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {months.map((month) => (
        <div key={month.label}>
          <p className="mb-2 text-center text-sm font-medium text-[#0a0e1a]">{month.label}</p>
          <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-[#8a93a5]">
            {firstWeekday.map((d) => (
              <span key={d}>{d[0]}</span>
            ))}
            {month.weeks.flat().map((day, i) =>
              day === null ? (
                <span key={`x${i}`} />
              ) : (
                <span
                  key={day.date}
                  title={day.available ? 'Available' : 'Booked'}
                  className={`mx-auto flex size-8 items-center justify-center rounded-full text-[13px] ${
                    day.available
                      ? 'bg-[#0d9488]/10 text-[#0a0e1a]'
                      : 'text-black/25 line-through decoration-black/20'
                  }`}
                >
                  {Number(day.date.slice(-2))}
                </span>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function buildMonths(days: CalendarDay[]) {
  const out: { label: string; weeks: (CalendarDay | null)[][] }[] = []
  let current: { label: string; weeks: (CalendarDay | null)[][] } | null = null

  for (const day of days) {
    const date = new Date(day.date + 'T00:00:00Z')
    const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    if (!current || current.label !== label) {
      current = { label, weeks: [[]] }
      out.push(current)
      // pad the first week
      const weekday = (date.getUTCDay() + 6) % 7 // Monday = 0
      for (let i = 0; i < weekday; i++) current.weeks[0].push(null)
    }
    const week = current.weeks[current.weeks.length - 1]
    week.push(day)
    if (week.length === 7) current.weeks.push([])
  }
  return out
}
