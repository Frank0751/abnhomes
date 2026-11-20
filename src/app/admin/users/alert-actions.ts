'use server'

/**
 * Choosing who hears about what.
 *
 * Deliberately a separate control from the role. A role says what somebody
 * may DO; this says how much they want to be TOLD. ABN's managing director
 * can be set to hear everything without being handed the power to refund a
 * payment or delete a booking, which is what giving them an admin account to
 * get the alerts would have meant.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { AccessError } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

export type AlertResult = { ok: true; message: string } | { ok: false; error: string }

const schema = z.object({
  level: z.enum(['NONE', 'IMPORTANT', 'EVERYTHING']),
  email: z.boolean(),
  sms: z.boolean(),
})

export async function setAlertPreferencesAction(
  userId: string,
  input: { level: 'NONE' | 'IMPORTANT' | 'EVERYTHING'; email: boolean; sms: boolean }
): Promise<AlertResult> {
  try {
    const actor = await requirePermission('users:manage')

    const parsed = schema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: 'Those settings could not be read.' }
    }
    const { level, email, sms } = parsed.data

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true,
        alertLevel: true, alertEmail: true, alertSms: true,
      },
    })
    if (!user) return { ok: false, error: 'That account no longer exists.' }

    // Switching a channel on for someone who has no address on that channel
    // would look like it worked and then quietly send nothing.
    if (level !== 'NONE' && email && !user.email) {
      throw new Error(`${user.name} has no email address on file, so email alerts cannot reach them.`)
    }
    if (level !== 'NONE' && sms && !user.phone) {
      throw new Error(`${user.name} has no phone number on file, so SMS alerts cannot reach them.`)
    }
    if (level !== 'NONE' && !email && !sms) {
      throw new Error(
        'Choose at least one way to reach them, or set them back to console only.'
      )
    }

    await db.user.update({
      where: { id: userId },
      data: { alertLevel: level, alertEmail: email, alertSms: sms },
    })

    await logAudit({
      actor,
      action: 'user.alerts_changed',
      entityType: 'User',
      entityId: userId,
      before: { alertLevel: user.alertLevel, alertEmail: user.alertEmail, alertSms: user.alertSms },
      after: { alertLevel: level, alertEmail: email, alertSms: sms },
    })

    revalidatePath('/admin/users')

    const how = [email && 'email', sms && 'SMS'].filter(Boolean).join(' and ')
    const message =
      level === 'NONE'
        ? `${user.name} now sees alerts in the console only.`
        : level === 'IMPORTANT'
          ? `${user.name} will get bookings and payments by ${how}.`
          : `${user.name} will get everything — urgent items by ${how}, the rest each morning.`

    return { ok: true, message }
  } catch (error) {
    const ours =
      error instanceof AccessError || (error instanceof Error && error.constructor === Error)
    if (ours) return { ok: false, error: (error as Error).message }
    console.error('[alerts] could not save preferences', error)
    return { ok: false, error: 'Could not save those settings.' }
  }
}
