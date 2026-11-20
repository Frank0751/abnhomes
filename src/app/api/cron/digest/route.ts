import { NextRequest, NextResponse } from 'next/server'
import { sendDailyDigest } from '@/lib/alerts/digest'

export const maxDuration = 60

/**
 * The morning digest: one message gathering everything that happened
 * yesterday but was not urgent enough to interrupt anybody.
 *
 * Runs once a day, at 07:00. Ghana keeps GMT all year, so the cron's UTC time
 * is also Accra time and there is no hour to drift twice a year.
 *
 * Separate from the 15-minute outbox sweeper on purpose: that one drains a
 * queue and is safe to run constantly, while this one composes a message and
 * must run exactly once a day. It is still idempotent — the events it sends
 * are marked as digested, and each recipient's message carries a dedupe key
 * of the date and their id — so a retried or duplicated trigger cannot send
 * the same morning twice.
 *
 * Protected by the CRON_SECRET bearer header.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const digest = await sendDailyDigest()
  return NextResponse.json({ ok: true, digest })
}
