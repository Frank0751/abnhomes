/**
 * Tests for the arithmetic that would be expensive to get wrong.
 *
 * These cover the pure functions only — no database. They are deliberately
 * concentrated on the four places where a subtle error costs real money:
 * rounding, half-open date intervals, rent escalation, and payment splitting.
 *
 *     npm test
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  add,
  allocateEvenly,
  applyBasisPoints,
  convert,
  formatMinor,
  multiply,
  parseMoneyInput,
  subtract,
  toMajor,
  toMinor,
} from '../src/lib/core/money'

import {
  ageBucket,
  dueDateInMonth,
  eachNight,
  nightsBetween,
  rangesOverlap,
} from '../src/lib/core/dates'

import {
  detectMomoNetwork,
  formatPhone,
  isValidGhanaCard,
  normalisePhone,
  phoneVariants,
} from '../src/lib/core/phone'

import { planForNight, quoteFromUnit } from '../src/lib/short-stay/pricing'
import { rentAtDate } from '../src/lib/long-let/leases'

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)

// ---------------------------------------------------------------------------

describe('money', () => {
  it('converts between major and minor units without drift', () => {
    assert.equal(toMinor(45.5, 'GHS'), 4550)
    assert.equal(toMinor(0.1, 'GHS'), 10)
    assert.equal(toMajor(4550, 'GHS'), 45.5)
  })

  it('rounds half away from zero rather than truncating', () => {
    assert.equal(toMinor(0.005, 'GHS'), 1)
    assert.equal(toMinor(10.994, 'USD'), 1099)
    assert.equal(toMinor(10.995, 'USD'), 1100)
  })

  it('does not accumulate floating point error', () => {
    // The canonical failure: 0.1 + 0.2 !== 0.3 in floating point.
    const a = { minor: toMinor(0.1, 'GHS'), currency: 'GHS' as const }
    const b = { minor: toMinor(0.2, 'GHS'), currency: 'GHS' as const }
    assert.equal(add(a, b).minor, 30)
    assert.equal(toMajor(add(a, b).minor, 'GHS'), 0.3)
  })

  it('refuses to add different currencies', () => {
    assert.throws(
      () => add({ minor: 100, currency: 'GHS' }, { minor: 100, currency: 'USD' }),
      /Cannot combine GHS with USD/
    )
  })

  it('rejects fractional minor units outright', () => {
    assert.throws(
      () => multiply({ minor: 100, currency: 'GHS' }, 1.5),
      /whole number/
    )
  })

  it('applies basis points as a percentage', () => {
    // 15% management fee on GHS 1,000.00
    assert.equal(applyBasisPoints({ minor: 100_000, currency: 'GHS' }, 1500).minor, 15_000)
    // 10% escalation on GHS 3,200.00
    assert.equal(applyBasisPoints({ minor: 320_000, currency: 'GHS' }, 1000).minor, 32_000)
    assert.equal(applyBasisPoints({ minor: 100, currency: 'GHS' }, 0).minor, 0)
  })

  it('splits an amount without losing or inventing a pesewa', () => {
    // GHS 100.00 across 3 parts cannot divide evenly.
    const parts = allocateEvenly({ minor: 10_000, currency: 'GHS' }, 3)
    assert.deepEqual(
      parts.map((p) => p.minor),
      [3334, 3333, 3333]
    )
    assert.equal(
      parts.reduce((s, p) => s + p.minor, 0),
      10_000
    )
  })

  it('splits negative amounts back to exactly the original', () => {
    const parts = allocateEvenly({ minor: -10_000, currency: 'GHS' }, 3)
    assert.equal(
      parts.reduce((s, p) => s + p.minor, 0),
      -10_000
    )
  })

  it('converts currency using an explicit rate only', () => {
    // USD 70.00 at 12.5 -> GHS 875.00
    assert.equal(convert({ minor: 7000, currency: 'USD' }, 'GHS', 12.5).minor, 87_500)
    // Same currency is a no-op regardless of the rate passed.
    assert.equal(convert({ minor: 7000, currency: 'USD' }, 'USD', 999).minor, 7000)
    assert.throws(() => convert({ minor: 100, currency: 'USD' }, 'GHS', 0), /Invalid exchange rate/)
  })

  it('parses what an operator would actually type', () => {
    assert.equal(parseMoneyInput('1,200.50', 'GHS')?.minor, 120_050)
    assert.equal(parseMoneyInput('₵1200', 'GHS')?.minor, 120_000)
    assert.equal(parseMoneyInput('', 'GHS'), null)
    assert.equal(parseMoneyInput('abc', 'GHS'), null)
  })

  it('formats with the right symbol and a minus sign for credit', () => {
    assert.equal(formatMinor(87_500, 'GHS'), '₵875.00')
    assert.equal(formatMinor(7000, 'USD'), '$70.00')
    assert.equal(formatMinor(-4550, 'GHS'), '-₵45.50')
  })

  it('keeps subtraction exact', () => {
    const owed = { minor: 320_000, currency: 'GHS' as const }
    const paid = { minor: 150_000, currency: 'GHS' as const }
    assert.equal(subtract(owed, paid).minor, 170_000)
  })
})

// ---------------------------------------------------------------------------

describe('dates and stays', () => {
  it('counts nights, not days', () => {
    // Arrive the 10th, leave the 14th: four nights slept.
    assert.equal(nightsBetween(utc('2026-03-10'), utc('2026-03-14')), 4)
    assert.equal(nightsBetween(utc('2026-03-10'), utc('2026-03-11')), 1)
    assert.equal(nightsBetween(utc('2026-03-10'), utc('2026-03-10')), 0)
  })

  it('excludes the departure day from the nights slept', () => {
    const nights = eachNight(utc('2026-03-10'), utc('2026-03-13'))
    assert.equal(nights.length, 3)
    assert.equal(nights.at(-1)?.getUTCDate(), 12)
  })

  it('treats a changeover day as free — the money-losing bug', () => {
    // One guest leaves on the 14th, the next arrives on the 14th.
    // These must NOT collide, or a sellable night is lost on every booking.
    assert.equal(
      rangesOverlap(utc('2026-03-10'), utc('2026-03-14'), utc('2026-03-14'), utc('2026-03-18')),
      false
    )
  })

  it('detects a genuine overlap', () => {
    assert.equal(
      rangesOverlap(utc('2026-03-10'), utc('2026-03-14'), utc('2026-03-13'), utc('2026-03-18')),
      true
    )
    // Fully contained.
    assert.equal(
      rangesOverlap(utc('2026-03-10'), utc('2026-03-20'), utc('2026-03-12'), utc('2026-03-14')),
      true
    )
    // Identical.
    assert.equal(
      rangesOverlap(utc('2026-03-10'), utc('2026-03-14'), utc('2026-03-10'), utc('2026-03-14')),
      true
    )
  })

  it('clamps a rent due day so February always works', () => {
    // A lease with a due day of 31 must not silently roll into March.
    assert.equal(dueDateInMonth(2026, 1, 31).getUTCDate(), 28) // Feb 2026
    assert.equal(dueDateInMonth(2028, 1, 31).getUTCDate(), 29) // Feb 2028, leap
    assert.equal(dueDateInMonth(2026, 0, 15).getUTCDate(), 15)
  })

  it('buckets arrears by age', () => {
    const asOf = utc('2026-06-30')
    assert.equal(ageBucket(utc('2026-07-15'), asOf), 'current')
    assert.equal(ageBucket(utc('2026-06-15'), asOf), '1-30')
    assert.equal(ageBucket(utc('2026-05-15'), asOf), '31-60')
    assert.equal(ageBucket(utc('2026-01-15'), asOf), '90+')
  })
})

// ---------------------------------------------------------------------------

describe('Ghanaian phone numbers', () => {
  it('resolves every way the same number gets typed', () => {
    const expected = '+233541704048'
    for (const input of [
      '054 170 4048',
      '0541704048',
      '541704048',
      '233541704048',
      '+233 54 170 4048',
      '+233541704048',
      '00233541704048',
    ]) {
      assert.equal(normalisePhone(input), expected, `failed on "${input}"`)
    }
  })

  it('keeps a foreign number a guest books with from abroad', () => {
    assert.equal(normalisePhone('+44 7700 900123'), '+447700900123')
    assert.equal(normalisePhone('+1 415 555 0142'), '+14155550142')
  })

  it('rejects what is not a number', () => {
    assert.equal(normalisePhone(''), null)
    assert.equal(normalisePhone('hello'), null)
    assert.equal(normalisePhone(null), null)
  })

  it('offers every stored variant for matching an inbound payment', () => {
    const variants = phoneVariants('0541704048')
    assert.ok(variants.includes('+233541704048'))
    assert.ok(variants.includes('0541704048'))
    assert.ok(variants.includes('541704048'))
  })

  it('displays Ghanaian numbers the local way', () => {
    assert.equal(formatPhone('+233541704048'), '054 170 4048')
    assert.equal(formatPhone('+447700900123'), '+447700900123')
  })

  it('picks the right mobile money network from the prefix', () => {
    assert.equal(detectMomoNetwork('0541704048'), 'MOMO_MTN')
    assert.equal(detectMomoNetwork('0201234567'), 'MOMO_TELECEL')
    assert.equal(detectMomoNetwork('0271234567'), 'MOMO_AIRTELTIGO')
  })

  it('validates a Ghana Card', () => {
    assert.equal(isValidGhanaCard('GHA-123456789-0'), true)
    assert.equal(isValidGhanaCard('GHA-12345-0'), false)
    assert.equal(isValidGhanaCard(null), false)
  })
})

// ---------------------------------------------------------------------------

const basePlan = {
  id: 'p1',
  unitId: 'u1',
  name: 'Standard',
  currency: 'USD' as const,
  nightlyMinor: 7000,
  weeklyMinor: null,
  monthlyMinor: null,
  cleaningFeeMinor: 1500,
  minNights: 2,
  maxNights: null,
  startDate: null,
  endDate: null,
  priority: 0,
  active: true,
  createdAt: utc('2026-01-01'),
  updatedAt: utc('2026-01-01'),
}

const peakPlan = {
  ...basePlan,
  id: 'p2',
  name: 'December peak',
  nightlyMinor: 9800,
  minNights: 3,
  startDate: utc('2026-12-15'),
  endDate: utc('2027-01-06'),
  priority: 10,
}

const unit = {
  id: 'u1',
  name: 'Tantra Hill Penthouse',
  currency: 'USD' as const,
  baseNightlyMinor: 7000,
  maxGuests: 4,
  ratePlans: [basePlan, peakPlan],
}

describe('nightly pricing', () => {
  it('picks the higher-priority plan inside its window', () => {
    assert.equal(planForNight([basePlan, peakPlan], utc('2026-12-20'))?.name, 'December peak')
    assert.equal(planForNight([basePlan, peakPlan], utc('2026-06-20'))?.name, 'Standard')
  })

  it('treats the plan end date as exclusive', () => {
    // The peak ends 6 Jan, so 6 Jan itself is back on the standard rate.
    assert.equal(planForNight([basePlan, peakPlan], utc('2027-01-05'))?.name, 'December peak')
    assert.equal(planForNight([basePlan, peakPlan], utc('2027-01-06'))?.name, 'Standard')
  })

  it('prices a stay that crosses a season boundary night by night', () => {
    // 13 Dec to 17 Dec: two standard nights (13, 14) then two peak (15, 16).
    const quote = quoteFromUnit(unit, {
      checkIn: utc('2026-12-13'),
      checkOut: utc('2026-12-17'),
      guests: 2,
    })

    assert.equal(quote.nights, 4)
    assert.equal(quote.accommodationMinor, 7000 + 7000 + 9800 + 9800)
    assert.equal(quote.nightLines[0].planName, 'Standard')
    assert.equal(quote.nightLines[2].planName, 'December peak')
  })

  it('adds the cleaning fee once, not per night', () => {
    const quote = quoteFromUnit(unit, {
      checkIn: utc('2026-06-10'),
      checkOut: utc('2026-06-15'),
      guests: 2,
    })
    assert.equal(quote.nights, 5)
    assert.equal(quote.accommodationMinor, 35_000)
    assert.equal(quote.cleaningFeeMinor, 1500)
    assert.equal(quote.totalMinor, 36_500)
  })

  it('flags a stay below the minimum without refusing to price it', () => {
    const quote = quoteFromUnit(unit, {
      checkIn: utc('2026-06-10'),
      checkOut: utc('2026-06-11'),
      guests: 2,
    })
    assert.equal(quote.nights, 1)
    assert.ok(quote.violations.some((v) => v.includes('2-night minimum')))
  })

  it('flags too many guests for the unit', () => {
    const quote = quoteFromUnit(unit, {
      checkIn: utc('2026-06-10'),
      checkOut: utc('2026-06-13'),
      guests: 9,
    })
    assert.ok(quote.violations.some((v) => v.includes('sleeps 4')))
  })

  it('applies a weekly rate only when it beats the nightly total', () => {
    const weekly = {
      ...unit,
      ratePlans: [{ ...basePlan, weeklyMinor: 42_000 }], // 7 nights for the price of 6
    }
    const quote = quoteFromUnit(weekly, {
      checkIn: utc('2026-06-01'),
      checkOut: utc('2026-06-08'),
      guests: 2,
    })
    assert.equal(quote.nights, 7)
    assert.equal(quote.accommodationMinor, 42_000) // not 49,000
  })
})

// ---------------------------------------------------------------------------

describe('rent escalation', () => {
  const lease = {
    startDate: utc('2026-01-01'),
    rentMinor: 320_000, // GHS 3,200.00
    currency: 'GHS' as const,
    escalationBasisPoints: 1000, // 10% a year
  }

  it('leaves rent alone in the first year', () => {
    assert.equal(rentAtDate(lease, utc('2026-06-01')), 320_000)
    assert.equal(rentAtDate(lease, utc('2026-12-31')), 320_000)
  })

  it('escalates on the anniversary', () => {
    assert.equal(rentAtDate(lease, utc('2027-01-01')), 352_000) // +10%
  })

  it('compounds rather than adding — the easy mistake', () => {
    // Year three is 21% above year one, not 30%.
    assert.equal(rentAtDate(lease, utc('2028-01-01')), 387_200)
    assert.equal(rentAtDate(lease, utc('2029-01-01')), 425_920)
  })

  it('does not escalate a day early', () => {
    assert.equal(rentAtDate(lease, utc('2026-12-31')), 320_000)
    assert.equal(rentAtDate(lease, utc('2027-01-01')), 352_000)
  })

  it('leaves rent flat when no escalation is agreed', () => {
    const flat = { ...lease, escalationBasisPoints: 0 }
    assert.equal(rentAtDate(flat, utc('2030-01-01')), 320_000)
  })
})
