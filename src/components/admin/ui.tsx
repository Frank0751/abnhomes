/**
 * Small building blocks shared across the admin screens, so every page shows
 * money, status and emptiness the same way. Consistency here is not cosmetic:
 * a figure that looks different on two screens gets read as two figures.
 */

import { cn } from '@/lib/utils'
import { formatMinor } from '@/lib/core/money'
import type { Currency, SyncState } from '@prisma/client'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-2xl tracking-tight text-balance sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground text-balance">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function StatCard({
  label,
  value,
  sublabel,
  tone = 'default',
}: {
  label: string
  value: string
  sublabel?: string
  tone?: 'default' | 'positive' | 'warning' | 'critical'
}) {
  return (
    <div className="rounded border border-black/8 bg-white px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 font-serif text-2xl tracking-tight tabular-nums',
          tone === 'positive' && 'text-emerald-700',
          tone === 'warning' && 'text-amber-700',
          tone === 'critical' && 'text-red-700'
        )}
      >
        {value}
      </p>
      {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  )
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
      {children}
    </div>
  )
}

/** Money always renders through here, tabular and currency-tagged. */
export function Money({
  minor,
  currency,
  className,
  showCode,
}: {
  minor: number
  currency: Currency
  className?: string
  showCode?: boolean
}) {
  return (
    <span className={cn('tabular-nums', minor < 0 && 'text-emerald-700', className)}>
      {formatMinor(minor, currency, { showCurrencyCode: showCode })}
    </span>
  )
}

const PILL_TONES = {
  neutral: 'bg-black/5 text-foreground/70',
  positive: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200',
  critical: 'bg-red-50 text-red-800 ring-1 ring-red-200',
  info: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200',
} as const

export type PillTone = keyof typeof PILL_TONES

export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: PillTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-medium',
        PILL_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

const STATUS_TONES: Record<string, PillTone> = {
  // Reservations
  INQUIRY: 'neutral',
  PENDING: 'warning',
  CONFIRMED: 'info',
  CHECKED_IN: 'positive',
  CHECKED_OUT: 'neutral',
  CANCELLED: 'neutral',
  NO_SHOW: 'critical',
  // Leases
  DRAFT: 'neutral',
  ACTIVE: 'positive',
  ENDED: 'neutral',
  TERMINATED: 'critical',
  // Charges and payments
  OPEN: 'warning',
  PART_PAID: 'warning',
  SETTLED: 'positive',
  WAIVED: 'neutral',
  REVERSED: 'critical',
  FAILED: 'critical',
  // Tickets
  ASSIGNED: 'info',
  IN_PROGRESS: 'info',
  ON_HOLD: 'warning',
  RESOLVED: 'positive',
  CLOSED: 'neutral',
  // Units
  AVAILABLE: 'positive',
  OCCUPIED: 'info',
  RESERVED: 'warning',
  MAINTENANCE: 'warning',
  OFF_MARKET: 'neutral',
  // Priority
  EMERGENCY: 'critical',
  HIGH: 'warning',
  NORMAL: 'neutral',
  LOW: 'neutral',
  // Statements
  ISSUED: 'info',
  PAID: 'positive',
}

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={STATUS_TONES[status] ?? 'neutral'}>{humanise(status)}</Pill>
}

export function humanise(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

/**
 * The sync badge. Never hidden: staff must always be able to tell whether the
 * office can see what they just recorded.
 */
export function SyncBadge({ state }: { state: SyncState }) {
  if (state === 'SYNCED') return null

  return (
    <Pill tone={state === 'CONFLICT' ? 'critical' : 'warning'}>
      {state === 'CONFLICT' ? 'Needs review' : 'Pending confirmation'}
    </Pill>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded border border-dashed border-black/12 bg-white/40 px-6 py-14 text-center">
      <p className="font-serif text-lg tracking-tight">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground text-balance">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded border border-black/8 bg-white', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

/** Tables scroll inside their own container; the page never scrolls sideways. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>
}
