/**
 * The nightly rent run.
 *
 * Raises rent and service charges that have fallen due, sweeps advance rent
 * against them, applies late fees, and sends reminders. Safe to run as often
 * as you like — every charge carries a run key, so a second run in the same
 * month changes nothing.
 *
 * Scheduled in vercel.json. Protected by CRON_SECRET, because an endpoint that
 * bills tenants should not be reachable by anyone who guesses the URL.
 */

import { NextResponse } from 'next/server'
import { applyLateFees, runRentCycle, sendRentReminders } from '@/lib/long-let/rent-run'
import { logAudit } from '@/lib/audit'

export const maxDuration = 60

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, message: 'Unauthorised' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const skipReminders = url.searchParams.get('reminders') === '0'

  const started = Date.now()

  const charges = await runRentCycle({ dryRun })
  const lateFees = await applyLateFees({ dryRun })
  const reminders = skipReminders
    ? { sent: 0, skipped: 0 }
    : await sendRentReminders({ dryRun })

  const summary = {
    dryRun,
    chargesRaised: charges.chargedCount,
    chargesSkipped: charges.skippedCount,
    totals: charges.totalByCurrency,
    lateFeesApplied: lateFees.applied,
    remindersSent: reminders.sent,
    remindersSkipped: reminders.skipped,
    durationMs: Date.now() - started,
  }

  if (!dryRun) {
    await logAudit({
      action: 'rentrun.executed',
      entityType: 'System',
      entityId: 'rent-run',
      actorLabel: 'Scheduled job',
      after: summary,
    })
  }

  return NextResponse.json({ ok: true, ...summary })
}
