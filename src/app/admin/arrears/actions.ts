'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/session'
import { sendRentReminders } from '@/lib/long-let/rent-run'
import { logAudit } from '@/lib/audit'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/** Rehearsal: works out who would be texted without texting anyone. */
export async function previewRemindersAction() {
  await requirePermission('money:read')
  return sendRentReminders({ dryRun: true })
}

export async function sendRemindersAction(): Promise<ActionResult> {
  try {
    const actor = await requirePermission('money:record')
    const result = await sendRentReminders({ dryRun: false })

    await logAudit({
      actor,
      action: 'arrears.reminders_sent',
      entityType: 'System',
      entityId: 'reminders',
      after: result,
    })

    revalidatePath('/admin/arrears')
    return {
      ok: true,
      message: `${result.sent} reminder${result.sent === 1 ? '' : 's'} sent${
        result.skipped > 0 ? `, ${result.skipped} skipped for want of a phone number` : ''
      }.`,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not send.' }
  }
}
