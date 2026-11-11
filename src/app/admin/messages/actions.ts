'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { queueMessage, deliverMessage } from '@/lib/notify'

export type MessageActionResult = { ok: true; message: string } | { ok: false; error: string }

/** Re-queue a failed or stale message for immediate delivery. */
export async function resendMessageAction(formData: FormData): Promise<void> {
  await requirePermission('settings:write')
  const id = String(formData.get('id') ?? '')
  const row = await db.messageLog.findUnique({ where: { id } })
  if (!row) return

  await db.messageLog.update({
    where: { id },
    data: { status: 'QUEUED', attempts: 0, error: null, nextAttemptAt: null, scheduledFor: new Date() },
  })
  await deliverMessage(id)
  await logAudit({
    action: 'message.resent',
    entityType: 'MessageLog',
    entityId: id,
    after: { template: row.template, to: row.toAddress },
  })
  revalidatePath('/admin/messages')
}

const testSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP']),
  to: z.string().min(3, 'Where should this go?'),
  subject: z.string().max(200).optional(),
  body: z.string().min(2, 'Write a short message body.'),
})

/** Send a test message through the real outbox, exactly as production would. */
export async function sendTestMessageAction(formData: FormData): Promise<MessageActionResult> {
  await requirePermission('settings:write')
  const parsed = testSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }

  const id = await queueMessage({
    channel: parsed.data.channel,
    to: parsed.data.to,
    subject: parsed.data.subject,
    body: parsed.data.body,
    template: 'test',
    metadata: { source: 'admin-test' },
  })
  if (id) await deliverMessage(id)
  await logAudit({
    action: 'message.test_sent',
    entityType: 'MessageLog',
    entityId: id ?? 'n/a',
    after: { channel: parsed.data.channel, to: parsed.data.to },
  })
  revalidatePath('/admin/messages')
  return { ok: true, message: `Test ${parsed.data.channel.toLowerCase()} sent — check the outbox below.` }
}
