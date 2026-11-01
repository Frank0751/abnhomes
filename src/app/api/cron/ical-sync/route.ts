/**
 * Pull every booking-site calendar.
 *
 * Should run as often as the host allows, because the gap between an Airbnb
 * booking and our knowing about it is exactly the window in which a double
 * booking happens. Vercel's Hobby plan only permits daily crons; to restore
 * an hourly cadence, either upgrade to Pro or point an external scheduler
 * (cron-job.org, GitHub Actions, any pinger) at this URL with the
 * CRON_SECRET bearer header — it accepts any caller holding the secret.
 */

import { NextResponse } from 'next/server'
import { syncAllFeeds } from '@/lib/short-stay/ical'

export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: 'Unauthorised' }, { status: 401 })
  }

  const results = await syncAllFeeds()
  const failed = results.filter((r) => !r.ok)

  if (failed.length > 0) {
    console.error(
      '[ical] feeds failed to sync:',
      failed.map((f) => `${f.label}: ${f.error}`).join('; ')
    )
  }

  return NextResponse.json({
    ok: true,
    feeds: results.length,
    imported: results.reduce((s, r) => s + r.imported, 0),
    failed: failed.length,
    results,
  })
}
