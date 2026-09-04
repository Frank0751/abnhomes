/**
 * The audit trail.
 *
 * Once five kinds of user can change the same records, "who changed this and
 * when" stops being a nice-to-have. Audit writes never block the caller: a
 * failed audit insert is logged, not thrown, because losing the trail is bad
 * but failing a rent payment because of it is worse.
 */

import { db } from '@/lib/db'
import type { Actor } from '@/lib/rbac'

export type AuditInput = {
  actor?: Actor | null
  actorLabel?: string | null
  action: string
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
  ip?: string | null
  userAgent?: string | null
  deviceId?: string | null
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actorUserId: input.actor?.id ?? null,
        actorLabel: input.actorLabel ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: (input.before ?? undefined) as never,
        after: (input.after ?? undefined) as never,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        deviceId: input.deviceId ?? null,
      },
    })
  } catch (error) {
    console.error('[audit] failed to record event', input.action, input.entityId, error)
  }
}

/**
 * Only the fields that actually changed, so the trail stays readable and a
 * one-field edit does not store two copies of an entire record.
 */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>
): { before: Partial<T>; after: Partial<T> } {
  const changedBefore: Partial<T> = {}
  const changedAfter: Partial<T> = {}

  for (const key of Object.keys(after) as Array<keyof T>) {
    const a = before[key]
    const b = after[key]
    const same =
      a instanceof Date && b instanceof Date
        ? a.getTime() === b.getTime()
        : JSON.stringify(a) === JSON.stringify(b)

    if (!same) {
      changedBefore[key] = a
      changedAfter[key] = b as T[keyof T]
    }
  }

  return { before: changedBefore, after: changedAfter }
}

/** Request metadata for the trail, from a route handler. */
export function requestMeta(request: Request): Pick<AuditInput, 'ip' | 'userAgent' | 'deviceId'> {
  return {
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
    deviceId: request.headers.get('x-device-id'),
  }
}
