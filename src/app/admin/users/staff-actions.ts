'use server'

/**
 * Bringing people onto the team and changing what they can reach.
 *
 * Nobody is given a password. An invited person gets a link and chooses
 * their own; until they do, the account exists but cannot be signed into.
 *
 * Guard rails, each of which is a way a real office has locked itself out:
 *   - you cannot change your own role (a slip would demote you mid-session);
 *   - the last active administrator cannot be demoted;
 *   - a role that only sees its own buildings must be given at least one,
 *     or the person signs in to an empty console and assumes it is broken.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/session'
import { AccessError, isUnscoped, STAFF_ROLES } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { normalisePhone } from '@/lib/core/phone'
import { issueInvite } from '@/lib/staff-invites'

export type StaffResult =
  | { ok: true; message: string; link?: string; emailed?: boolean }
  | { ok: false; error: string; values?: Record<string, string | string[]> }

const roleSchema = z.enum(STAFF_ROLES as [Role, ...Role[]], { message: 'Choose a role.' })

function values(formData: FormData): Record<string, string | string[]> {
  return {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    role: String(formData.get('role') ?? ''),
    propertyIds: formData.getAll('propertyIds').map(String),
  }
}

function fail(error: unknown, fallback: string, kept?: Record<string, string | string[]>): StaffResult {
  if (error instanceof AccessError || (error instanceof Error && error.constructor === Error)) {
    return { ok: false, error: error.message, values: kept }
  }
  console.error('[staff] failed', error)
  return { ok: false, error: fallback, values: kept }
}

/** Parse and check the parts shared by invite and edit. */
async function readCommon(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  if (name.length < 2) throw new Error('Enter the person’s full name.')
  if (name.length > 80) throw new Error('That name is too long.')

  const role = roleSchema.safeParse(formData.get('role'))
  if (!role.success) throw new Error('Choose a role.')

  const rawPhone = String(formData.get('phone') ?? '').trim()
  const phone = rawPhone ? normalisePhone(rawPhone) : null
  if (rawPhone && !phone) throw new Error('That phone number does not look right. Use a Ghana number like 024 123 4567.')

  // Unscoped roles see every building by policy; storing rows for them would
  // only mislead whoever reads the list later.
  const requested = [...new Set(formData.getAll('propertyIds').map(String))]
  const propertyIds = isUnscoped(role.data) ? [] : requested
  if (!isUnscoped(role.data) && propertyIds.length === 0) {
    throw new Error('Choose at least one building this person works in.')
  }
  if (propertyIds.length > 0) {
    const found = await db.property.count({ where: { id: { in: propertyIds } } })
    if (found !== propertyIds.length) throw new Error('One of those buildings no longer exists. Reload and try again.')
  }

  return { name, role: role.data, phone, propertyIds }
}

async function assertPhoneFree(phone: string | null, exceptUserId?: string) {
  if (!phone) return
  const taken = await db.user.findFirst({ where: { phone, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) } })
  if (taken) throw new Error('Another account already uses that phone number.')
}

function actorName(actorId: string) {
  return db.user.findUnique({ where: { id: actorId }, select: { name: true } }).then((u) => u?.name ?? 'An administrator')
}

// ------------------------------------------------------------------ invite

export async function inviteStaffAction(_prev: StaffResult | null, formData: FormData): Promise<StaffResult> {
  const kept = values(formData)
  try {
    const actor = await requirePermission('users:manage')
    const { name, role, phone, propertyIds } = await readCommon(formData)

    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    if (!z.string().email().safeParse(email).success) throw new Error('Enter a valid email address.')

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      throw new Error(
        STAFF_ROLES.includes(existing.role)
          ? `${existing.name} already has a staff account with that email.`
          : 'That email already belongs to a guest or portal account. Use a work email instead.'
      )
    }
    await assertPhoneFree(phone)

    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        role,
        active: true,
        propertyAccess: { create: propertyIds.map((propertyId) => ({ propertyId })) },
      },
    })

    await logAudit({
      actor,
      action: 'user.invited',
      entityType: 'User',
      entityId: user.id,
      after: { name, email, phone, role, propertyIds },
    })

    const invite = await issueInvite({ user: { id: user.id, name, email, role }, invitedBy: await actorName(actor.id) })
    revalidatePath('/admin/users')

    return {
      ok: true,
      message: invite.emailed
        ? `Invitation sent to ${email}.`
        : `${name} was added, but the email did not send. Copy the link below and send it to them on WhatsApp.`,
      link: invite.link,
      emailed: invite.emailed,
    }
  } catch (error) {
    return fail(error, 'Could not send that invitation.', kept)
  }
}

// -------------------------------------------------------------------- edit

export async function updateStaffAction(
  userId: string,
  _prev: StaffResult | null,
  formData: FormData
): Promise<StaffResult> {
  const kept = values(formData)
  try {
    const actor = await requirePermission('users:manage')
    const user = await db.user.findUnique({ where: { id: userId }, include: { propertyAccess: true } })
    if (!user || !STAFF_ROLES.includes(user.role)) throw new Error('That staff account no longer exists.')

    const { name, role, phone, propertyIds } = await readCommon(formData)

    if (userId === actor.id && role !== user.role) {
      throw new Error('You cannot change your own role. Ask another administrator.')
    }
    if (user.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      const admins = await db.user.count({
        where: { role: 'SUPER_ADMIN', active: true, suspendedAt: null, id: { not: userId } },
      })
      if (admins === 0) throw new Error('This is the only active administrator. Make someone else an administrator first.')
    }
    await assertPhoneFree(phone, userId)

    const before = {
      name: user.name,
      phone: user.phone,
      role: user.role,
      propertyIds: user.propertyAccess.map((a) => a.propertyId).sort(),
    }

    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { name, phone, role } }),
      db.userPropertyAccess.deleteMany({ where: { userId, propertyId: { notIn: propertyIds } } }),
      ...propertyIds.map((propertyId) =>
        db.userPropertyAccess.upsert({
          where: { userId_propertyId: { userId, propertyId } },
          create: { userId, propertyId },
          update: {},
        })
      ),
    ])

    await logAudit({
      actor,
      action: 'user.updated',
      entityType: 'User',
      entityId: userId,
      before,
      after: { name, phone, role, propertyIds: [...propertyIds].sort() },
    })

    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${userId}`)
    return { ok: true, message: `${name} saved. The change applies straight away.` }
  } catch (error) {
    return fail(error, 'Could not save those changes.', kept)
  }
}

// ------------------------------------------------------------------ resend

export async function resendInviteAction(userId: string): Promise<StaffResult> {
  try {
    const actor = await requirePermission('users:manage')
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user || !STAFF_ROLES.includes(user.role) || !user.email) throw new Error('That staff account no longer exists.')
    if (user.passwordHash) {
      throw new Error(`${user.name} has already chosen a password.`)
    }
    if (!user.active || user.suspendedAt) throw new Error('Reactivate this account before inviting them again.')

    const invite = await issueInvite({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      invitedBy: await actorName(actor.id),
    })
    await logAudit({ actor, action: 'user.invite_resent', entityType: 'User', entityId: userId })

    return {
      ok: true,
      message: invite.emailed
        ? `A new invitation is on its way to ${user.email}. The old link no longer works.`
        : 'The email did not send. Copy the link below and send it on WhatsApp.',
      link: invite.link,
      emailed: invite.emailed,
    }
  } catch (error) {
    return fail(error, 'Could not send a new invitation.')
  }
}
