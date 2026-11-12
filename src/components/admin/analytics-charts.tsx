'use client'

/**
 * The analytics charts.
 *
 * Recharts owns the axes; the brand owns the colour. Charts render nothing
 * (not a frame) when their series is empty — an empty chart that looks like
 * zero is a lie, and this platform does not ship those.
 */

import { useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  OccupancyBar,
  OccupancyMonth,
  PaceMonth,
  ArrearsBucket,
  FunnelStep,
  RevenuePoint,
} from '@/lib/reporting/dashboard'

const NAVY = '#0a0e1a'
const TEAL = '#0d9488'
const TEAL_LIGHT = '#14b8a6'
const SAND = '#e8e3d8'
const MUTED = '#5b6472'
const PIE_COLORS = [TEAL, NAVY, TEAL_LIGHT, '#5b6472', '#0f766e', '#94a3b8', '#f59e0b']
const AGE_COLORS: Record<string, string> = {
  current: TEAL,
  '1-30': '#fbbf24',
  '31-60': '#f59e0b',
  '61-90': '#ea580c',
  '90+': '#dc2626',
}

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 8px 24px rgba(10,14,26,0.12)',
  fontSize: 12,
  background: '#fff',
}

const money = (minor: number) =>
  `GH₵ ${(minor / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

const compact = (minor: number) => {
  const major = minor / 100
  if (major >= 1_000_000) return `${(major / 1_000_000).toFixed(1)}M`
  if (major >= 1_000) return `${Math.round(major / 1_000)}k`
  return String(Math.round(major))
}

const monthLabel = (m: string) => m.slice(2).replace('-', '/')

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-56 items-center justify-center rounded-lg border border-dashed border-black/12 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

/** Segmented control for the chart mode toggles. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { key: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-black/10 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === o.key ? 'bg-[#0a0e1a] text-white' : 'text-muted-foreground hover:bg-black/5'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

type RevMode = 'both' | 'monthly' | 'cumulative'

/** Monthly collections as bars with the running total as a line. */
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const [mode, setMode] = useState<RevMode>('both')

  const withCumulative = (() => {
    let run = 0
    return data.map((d) => {
      run += d.revenueMinor
      return { ...d, cumulativeMinor: run }
    })
  })()
  const hasData = data.some((d) => d.revenueMinor > 0)
  if (!hasData) return <EmptyChart label="No payments posted yet — the line appears with the first cedi." />

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { key: 'both', label: 'Trend' },
            { key: 'monthly', label: 'Monthly' },
            { key: 'cumulative', label: 'Running total' },
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={withCumulative} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={NAVY} stopOpacity={0.14} />
              <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: MUTED }}
            axisLine={false}
            tickLine={false}
            tickFormatter={monthLabel}
          />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={46} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number | string, name) => {
              if (name === 'Collected') return [money(Number(value)), 'Collected that month']
              if (name === 'Running total') return [money(Number(value)), 'Running total']
              return [value, name as string]
            }}
            labelFormatter={(m: string) => m}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ fontSize: 12, color: '#4b5563' }}>
                {value === 'revenueMinor' ? 'Collected' : 'Running total'}
              </span>
            )}
          />
          {mode !== 'cumulative' && (
            <Bar dataKey="revenueMinor" name="revenueMinor" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={34} />
          )}
          {mode !== 'monthly' && (
            <Area
              dataKey="cumulativeMinor"
              name="cumulativeMinor"
              stroke={NAVY}
              strokeWidth={2}
              fill="url(#cumFill)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Occupancy per month across the window — the trend, not the snapshot. */
export function OccupancyTrendChart({ data }: { data: OccupancyMonth[] }) {
  if (data.length === 0 || data.every((d) => d.nightsSold === 0))
    return <EmptyChart label="No stays in this window yet — the trend line fills as guests check in." />

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="occFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL_LIGHT} stopOpacity={0.3} />
            <stop offset="100%" stopColor={TEAL_LIGHT} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          tickFormatter={monthLabel}
        />
        <YAxis
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          width={44}
          domain={[0, 1]}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number | string, name, entry) => [
            `${(Number(value) * 100).toFixed(0)}% · ${(entry?.payload as OccupancyMonth).nightsSold} nights`,
            'Occupancy',
          ]}
        />
        <Area
          type="monotone"
          dataKey="occupancy"
          stroke={TEAL_LIGHT}
          strokeWidth={2.5}
          fill="url(#occFill)"
          dot={{ r: 3, fill: TEAL_LIGHT, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function OccupancyChart({ data }: { data: OccupancyBar[] }) {
  if (data.length === 0) return <EmptyChart label="No properties yet." />

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis
          dataKey="property"
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          interval={0}
          tickFormatter={(p: string) => (p.length > 14 ? `${p.slice(0, 13)}…` : p)}
        />
        <YAxis
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          width={44}
          domain={[0, 1]}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number | string) => [`${(Number(value) * 100).toFixed(0)}%`, 'Occupancy']}
        />
        <Bar dataKey="occupancy" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.occupancy >= 0.7 ? TEAL : d.occupancy >= 0.4 ? TEAL_LIGHT : SAND}
              stroke={d.occupancy < 0.4 ? 'rgba(0,0,0,0.12)' : undefined}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Bookings created per month, with cancellations alongside. */
export function BookingPaceChart({ data }: { data: PaceMonth[] }) {
  if (data.length === 0 || data.every((d) => d.bookings === 0 && d.cancelled === 0))
    return <EmptyChart label="No bookings created in this window." />

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="24%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          tickFormatter={monthLabel}
        />
        <YAxis
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          width={36}
          allowDecimals={false}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ fontSize: 12, color: '#4b5563' }}>
              {value === 'bookings' ? 'Booked' : 'Cancelled'}
            </span>
          )}
        />
        <Bar dataKey="bookings" name="bookings" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={30} />
        <Bar dataKey="cancelled" name="cancelled" fill={SAND} stroke="rgba(0,0,0,0.12)" radius={[4, 4, 0, 0]} maxBarSize={30} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Open charges by how late they are. Colour deepens with age. */
export function ArrearsAgingChart({ data }: { data: ArrearsBucket[] }) {
  const rows = data.filter((d) => d.minor > 0)
  if (rows.length === 0) return <EmptyChart label="Nothing overdue — the ledger is clean." />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }} barCategoryGap="24%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} tickFormatter={compact} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 12, fill: '#1a1f2e' }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number | string) => [money(Number(v)), 'Outstanding']} />
        <Bar dataKey="minor" radius={[0, 6, 6, 0]} barSize={18}>
          {rows.map((d) => (
            <Cell key={d.bucket} fill={AGE_COLORS[d.bucket]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Funnel bars with the stage-to-stage conversion printed under the chart. */
export function FunnelChart({
  data,
  color,
  noun = 'applications',
}: {
  data: FunnelStep[]
  color: string
  noun?: string
}) {
  if (data.every((d) => d.count === 0)) {
    return <EmptyChart label={`No ${noun} yet — this funnel fills as people apply.`} />
  }

  const conversions = data.slice(0, -1).map((step, i) => {
    const next = data[i + 1]
    const pct = step.count > 0 ? Math.round((next.count / step.count) * 100) : null
    return { from: step.stage, to: next.stage, pct }
  })

  return (
    <div>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }} barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="stage"
            tick={{ fontSize: 12, fill: '#1a1f2e' }}
            axisLine={false}
            tickLine={false}
            width={92}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number | string) => [v, 'Applications']} />
          <Bar dataKey="count" fill={color} radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground">
        {conversions.map((c) => (
          <span key={`${c.from}-${c.to}`} className="tabular-nums">
            {c.from} → {c.to}:{' '}
            <strong className={c.pct !== null && c.pct >= 50 ? 'text-emerald-700' : 'text-foreground'}>
              {c.pct === null ? '—' : `${c.pct}%`}
            </strong>
          </span>
        ))}
      </p>
    </div>
  )
}

export function SourceMixChart({
  data,
}: {
  data: { source: string; count: number; valueMinor: number | null }[]
}) {
  if (data.length === 0) return <EmptyChart label="No bookings in this period." />

  const labelled = data.map((d) => ({
    ...d,
    name: d.source.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={labelled}
          dataKey="count"
          nameKey="name"
          innerRadius="52%"
          outerRadius="78%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {labelled.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value, entry) => {
            const row = entry?.payload as unknown as
              | { name: string; count: number; valueMinor: number | null }
              | undefined
            if (!row) return value
            return (
              <span style={{ fontSize: 12, color: '#4b5563' }}>
                {row.name} · {row.count}
                {row.valueMinor !== null ? ` · ${money(row.valueMinor)}` : ''}
              </span>
            )
          }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number | string, name, entry) => {
            const row = entry?.payload as { count: number; valueMinor: number | null }
            const bits = [`${row.count} booking${row.count === 1 ? '' : 's'}`]
            if (row.valueMinor !== null) bits.push(money(row.valueMinor))
            return [bits.join(' · '), name as string]
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
