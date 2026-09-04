'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireActor } from '@/lib/session'
import { assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { createTicket, resolveTicket } from '@/lib/operations/tickets'
import { toMinor } from '@/lib/core/money'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

const createSchema = z.object({
  propertyId: z.string().min(1, 'Choose a property.'),
  unitId: z.string().optional(),
  title: z.string().min(3, 'Give the fault a short title.'),
  description: z.string().min(5, 'Describe what is wrong.'),
  category: z.string(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']),
})

export async function createTicketAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireActor()
    const parsed = createSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' }
    }

    const input = parsed.data
    assertCanOnProperty(actor, 'maintenance:report', input.propertyId)

    const ticket = await createTicket({
      propertyId: input.propertyId,
      unitId: input.unitId && input.unitId !== 'none' ? input.unitId : null,
      title: input.title,
      description: input.description,
      category: input.category as never,
      priority: input.priority,
      actorUserId: actor.id,
    })

    await logAudit({
      actor,
      action: 'ticket.created',
      entityType: 'Ticket',
      entityId: ticket.id,
      after: { code: ticket.code, priority: ticket.priority },
    })

    revalidatePath('/admin/maintenance')
    revalidatePath('/admin')
    return { ok: true, message: `Ticket ${ticket.code} logged.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not log it.' }
  }
}

export async function resolveTicketAction(
  ticketId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireActor()
    const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    assertCanOnProperty(actor, 'maintenance:manage', ticket.propertyId)

    const resolution = String(formData.get('resolution') ?? '').trim()
    if (!resolution) return { ok: false, error: 'Say what was done.' }

    const costRaw = String(formData.get('cost') ?? '').trim()
    const cost = costRaw ? Number(costRaw) : 0
    if (costRaw && (!Number.isFinite(cost) || cost < 0)) {
      return { ok: false, error: 'That cost is not a number.' }
    }

    const rechargeToTenant = formData.get('recharge') === 'on'

    await resolveTicket(ticketId, {
      resolution,
      costMinor: cost > 0 ? toMinor(cost, 'GHS') : 0,
      currency: 'GHS',
      rechargeToTenant,
      actorUserId: actor.id,
    })

    await logAudit({
      actor,
      action: 'ticket.resolved',
      entityType: 'Ticket',
      entityId: ticketId,
      after: { resolution, cost, rechargeToTenant },
    })

    revalidatePath('/admin/maintenance')
    return {
      ok: true,
      message:
        cost > 0
          ? `Resolved. The cost was posted ${rechargeToTenant ? "to the tenant's account" : 'against the property'}.`
          : 'Resolved.',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not resolve it.' }
  }
}
