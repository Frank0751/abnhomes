'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { dateOnly } from '@/lib/core/dates'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/**
 * Record a new exchange rate.
 *
 * Rates are dated and never overwritten. Entries already posted keep the rate
 * they were posted at, so adding a rate today cannot rewrite last year's
 * revenue — which is the whole reason the rate is stored on the entry.
 */
export async function setFxRateAction(formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requirePermission('settings:write')

    const rate = Number(String(formData.get('rate') ?? ''))
    const asOfRaw = String(formData.get('asOf') ?? '')

    if (!Number.isFinite(rate) || rate <= 0) {
      return { ok: false, error: 'Enter a rate greater than zero.' }
    }
    if (!asOfRaw) {
      return { ok: false, error: 'Choose the date the rate takes effect.' }
    }

    const asOf = dateOnly(asOfRaw)

    await db.fxRate.upsert({
      where: { from_to_asOf: { from: 'USD', to: 'GHS', asOf } },
      update: { rate, source: 'manual' },
      create: { from: 'USD', to: 'GHS', rate, asOf, source: 'manual' },
    })

    await logAudit({
      actor,
      action: 'settings.fx_rate_set',
      entityType: 'FxRate',
      entityId: `USD-GHS-${asOfRaw}`,
      after: { rate, asOf: asOfRaw },
    })

    revalidatePath('/admin/settings')
    return { ok: true, message: `1 USD = ${rate} GHS from ${asOfRaw}.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save.' }
  }
}
