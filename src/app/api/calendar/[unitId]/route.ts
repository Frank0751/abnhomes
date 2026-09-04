/**
 * Public availability feed for one unit.
 *
 * This is the URL you paste into Airbnb or Booking.com so they block the dates
 * ABN has already sold. It exposes only that a unit is unavailable — never who
 * is staying, what they paid, or how to contact them.
 *
 *     https://abnhomes.com.gh/api/calendar/<unitId>.ics
 */

import { NextResponse } from 'next/server'
import { exportUnitCalendar } from '@/lib/short-stay/ical'
import { db } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const { unitId: raw } = await params
  // The .ics suffix is cosmetic; some platforms insist on seeing it.
  const unitId = raw.replace(/\.ics$/i, '')

  const unit = await db.unit.findUnique({ where: { id: unitId }, select: { id: true } })
  if (!unit) {
    return new NextResponse('Unit not found', { status: 404 })
  }

  const calendar = await exportUnitCalendar(unitId)

  return new NextResponse(calendar, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="abn-${unitId}.ics"`,
      // The platforms poll on their own schedule; a short cache keeps us
      // responsive without inviting a hammering.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
