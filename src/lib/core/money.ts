/**
 * Money.
 *
 * Every amount in this system is an INTEGER NUMBER OF MINOR UNITS
 * (pesewas for GHS, cents for USD) carried alongside its currency.
 * No floating-point number ever represents money. `0.1 + 0.2` is not `0.3`,
 * and a landlord who loses a pesewa a thousand times will notice.
 */

import type { Currency } from '@prisma/client'

/** Both currencies we handle use two decimal places. */
const MINOR_UNITS_PER_MAJOR: Record<Currency, number> = {
  GHS: 100,
  USD: 100,
}

export type Money = {
  minor: number
  currency: Currency
}

export function money(minor: number, currency: Currency): Money {
  if (!Number.isInteger(minor)) {
    throw new Error(`Money must be an integer number of minor units, received ${minor}`)
  }
  return { minor, currency }
}

export function zero(currency: Currency): Money {
  return { minor: 0, currency }
}

/** 45.5 GHS -> 4550 pesewas. Rounds half away from zero. */
export function toMinor(major: number, currency: Currency): number {
  const factor = MINOR_UNITS_PER_MAJOR[currency]
  return Math.round(major * factor)
}

/** 4550 pesewas -> 45.5. For display and export only, never for arithmetic. */
export function toMajor(minor: number, currency: Currency): number {
  return minor / MINOR_UNITS_PER_MAJOR[currency]
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot combine ${a.currency} with ${b.currency}. Convert explicitly first.`)
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return { minor: a.minor + b.minor, currency: a.currency }
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return { minor: a.minor - b.minor, currency: a.currency }
}

export function sum(amounts: Money[], currency: Currency): Money {
  return amounts.reduce((acc, m) => add(acc, m), zero(currency))
}

export function negate(a: Money): Money {
  return { minor: -a.minor, currency: a.currency }
}

export function isZero(a: Money): boolean {
  return a.minor === 0
}

export function isPositive(a: Money): boolean {
  return a.minor > 0
}

export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b)
  return a.minor - b.minor
}

export function minOf(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b
}

export function maxOf(a: Money, b: Money): Money {
  return compare(a, b) >= 0 ? a : b
}

/** Multiply by a whole count, e.g. nightly rate x 4 nights. */
export function multiply(a: Money, factor: number): Money {
  if (!Number.isInteger(factor)) {
    throw new Error('multiply() takes a whole number. For rates use applyBasisPoints().')
  }
  return { minor: a.minor * factor, currency: a.currency }
}

/**
 * Percentages are expressed in basis points so they stay integers.
 * 1000 bp = 10%. Rounds half away from zero, matching how an invoice is read.
 */
export function applyBasisPoints(a: Money, basisPoints: number): Money {
  const raw = (a.minor * basisPoints) / 10_000
  const rounded = raw < 0 ? -Math.round(-raw) : Math.round(raw)
  return { minor: rounded, currency: a.currency }
}

/**
 * Split an amount into n parts without losing a minor unit to rounding.
 * The remainder is distributed one unit at a time across the earliest parts,
 * so the parts always sum exactly back to the original.
 */
export function allocateEvenly(a: Money, parts: number): Money[] {
  if (parts <= 0) throw new Error('Cannot allocate into zero parts')
  const base = Math.trunc(a.minor / parts)
  let remainder = a.minor - base * parts
  const step = remainder < 0 ? -1 : 1
  remainder = Math.abs(remainder)

  return Array.from({ length: parts }, (_, i) => {
    const extra = i < remainder ? step : 0
    return { minor: base + extra, currency: a.currency }
  })
}

/**
 * Convert using an explicit rate. The rate must be the one captured at the
 * time the entry was posted, never today's rate applied to old history.
 */
export function convert(a: Money, to: Currency, rate: number): Money {
  if (a.currency === to) return a
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid exchange rate ${rate} for ${a.currency} to ${to}`)
  }
  return { minor: Math.round(a.minor * rate), currency: to }
}

const SYMBOLS: Record<Currency, string> = { GHS: '₵', USD: '$' }

export function formatMoney(
  a: Money,
  options: { showCurrencyCode?: boolean; compact?: boolean } = {}
): string {
  const major = toMajor(a.minor, a.currency)
  const formatted = new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: options.compact && Number.isInteger(major) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(major))

  const sign = a.minor < 0 ? '-' : ''
  const body = `${sign}${SYMBOLS[a.currency]}${formatted}`
  return options.showCurrencyCode ? `${body} ${a.currency}` : body
}

/** Convenience for rendering a raw column pair straight out of Prisma. */
export function formatMinor(
  minor: number,
  currency: Currency,
  options?: { showCurrencyCode?: boolean; compact?: boolean }
): string {
  return formatMoney({ minor, currency }, options)
}

/**
 * Parse operator input. Accepts "1,200.50", currency symbols, plain numbers.
 * Returns null rather than throwing, so forms can show a field error.
 */
export function parseMoneyInput(input: string, currency: Currency): Money | null {
  const cleaned = input.replace(/[^\d.-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null
  return { minor: toMinor(value, currency), currency }
}

export function basisPointsToPercent(bp: number): string {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`
}
