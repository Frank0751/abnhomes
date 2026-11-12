'use client'

/**
 * The analytics charts.
 *
 * Recharts owns the axes; the brand owns the colour. Charts render nothing
 * (not a frame) when their series is empty — an empty chart that looks like
 * zero is a lie, and this platform does not ship those.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RevenuePoint, OccupancyBar, FunnelStep } from '@/lib/reporting/dashboard'

const NAVY = '#0a0e1a'
const TEAL = '#0d9488'
const TEAL_LIGHT = '#14b8a6'
const SAND = '#e8e3d8'
const MUTED = '#5b6472'
const PIE_COLORS = [TEAL, NAVY, TEAL_LIGHT, '#5b6472', '#0f766e', '#94a3b8', '#f59e0b']

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

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-56 items-center justify-center rounded-lg border border-dashed border-black/12 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function RevenueTrendChart({ data }: { data: RevenuePoint[] }) {
  const hasData = data.some((d) => d.revenueMinor > 0)
  if (!hasData) return <EmptyChart label="No payments posted yet — the line appears with the first cedi." />

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity={0.28} />
            <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(m: string) => m.slice(2).replace('-', '/')}
        />
        <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number | string) => [money(Number(value)), 'Collected']}
        />
        <Area
          type="monotone"
          dataKey="revenueMinor"
          stroke={TEAL}
          strokeWidth={2.5}
          fill="url(#revFill)"
          dot={{ r: 3, fill: TEAL, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function OccupancyChart({ data }: { data: OccupancyBar[] }) {
  if (data.length === 0) return <EmptyChart label="No properties yet." />

  return (
    <ResponsiveContainer width="100%" height={280}>
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
            <Cell key={i} fill={d.occupancy >= 0.7 ? TEAL : d.occupancy >= 0.4 ? TEAL_LIGHT : SAND} stroke={d.occupancy < 0.4 ? 'rgba(0,0,0,0.12)' : undefined} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function FunnelChart({
  data,
  color,
}: {
  data: FunnelStep[]
  color: string
}) {
  if (data.every((d) => d.count === 0)) {
    return <EmptyChart label="No applications yet — this funnel fills as people apply." />
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
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
  )
}

export function SourceMixChart({ data }: { data: { source: string; count: number }[] }) {
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
          formatter={(value) => <span style={{ fontSize: 12, color: '#4b5563' }}>{value}</span>}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number | string, name) => [v, name as string]} />
      </PieChart>
    </ResponsiveContainer>
  )
}
