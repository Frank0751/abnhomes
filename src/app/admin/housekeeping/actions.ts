'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireActor } from '@/lib/session'
import { assertCanOnProperty } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/**
 * Marking a turnover done also puts the unit back on sale. Housekeeping is the
 * last gate before a unit is sellable again, so this is where that happens
 * rather than in a separate step someone forgets.
 */
export async function completeTaskAction(taskId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor()
    const task = await db.housekeepingTask.findUniqueOrThrow({
      where: { id: taskId },
      include: { unit: { select: { id: true, propertyId: true, status: true } } },
    })

    assertCanOnProperty(actor, 'housekeeping:complete', task.unit.propertyId)

    await db.$transaction(async (tx) => {
      await tx.housekeepingTask.update({
        where: { id: taskId },
        data: { status: 'DONE', completedAt: new Date(), assigneeUserId: actor.id },
      })

      // Only lift the unit out of maintenance if nothing else is pending on it.
      const stillPending = await tx.housekeepingTask.count({
        where: { unitId: task.unitId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      })

      if (stillPending === 0 && task.unit.status === 'MAINTENANCE') {
        const upcoming = await tx.reservation.findFirst({
          where: {
            unitId: task.unitId,
            status: { in: ['CONFIRMED', 'CHECKED_IN'] },
            checkOut: { gt: new Date() },
          },
        })

        await tx.unit.update({
          where: { id: task.unitId },
          data: {
            status:
              upcoming?.status === 'CHECKED_IN'
                ? 'OCCUPIED'
                : upcoming
                  ? 'RESERVED'
                  : 'AVAILABLE',
          },
        })
      }
    })

    await logAudit({
      actor,
      action: 'housekeeping.completed',
      entityType: 'HousekeepingTask',
      entityId: taskId,
    })

    revalidatePath('/admin/housekeeping')
    revalidatePath('/admin')
    return { ok: true, message: 'Marked done. The unit is back on sale.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not update.' }
  }
}

export async function startTaskAction(taskId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor()
    const task = await db.housekeepingTask.findUniqueOrThrow({
      where: { id: taskId },
      include: { unit: { select: { propertyId: true } } },
    })
    assertCanOnProperty(actor, 'housekeeping:complete', task.unit.propertyId)

    await db.housekeepingTask.update({
      where: { id: taskId },
      data: { status: 'IN_PROGRESS', startedAt: new Date(), assigneeUserId: actor.id },
    })

    revalidatePath('/admin/housekeeping')
    return { ok: true, message: 'Started.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not update.' }
  }
}
