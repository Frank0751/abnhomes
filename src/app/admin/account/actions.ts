'use server'

import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requireActor } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { MIN_PASSWORD_LENGTH } from '@/lib/staff-invites'

export type PasswordResult = { ok: true; message: string } | { ok: false; error: string }

/**
 * A member of staff changing their own password. The current one is asked
 * for again, so an unlocked computer left on a desk is not enough to take
 * over the account.
 */
export async function changePasswordAction(_prev: PasswordResult | null, formData: FormData): Promise<PasswordResult> {
  try {
    const actor = await requireActor()
    const current = String(formData.get('current') ?? '')
    const next = String(formData.get('next') ?? '')
    const confirm = String(formData.get('confirm') ?? '')

    if (next.length < MIN_PASSWORD_LENGTH) return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` }
    if (next.length > 200) return { ok: false, error: 'That password is too long.' }
    if (next !== confirm) return { ok: false, error: 'The two new passwords do not match.' }
    if (next === current) return { ok: false, error: 'Choose a password different from the current one.' }

    const user = await db.user.findUnique({ where: { id: actor.id }, select: { email: true, passwordHash: true } })
    if (!user?.passwordHash) return { ok: false, error: 'This account does not sign in with a password.' }
    if (!(await bcrypt.compare(current, user.passwordHash))) {
      return { ok: false, error: 'The current password is not right.' }
    }
    if (user.email && next.toLowerCase().includes(user.email.split('@')[0].toLowerCase())) {
      return { ok: false, error: 'Choose a password that does not contain your email address.' }
    }

    await db.user.update({ where: { id: actor.id }, data: { passwordHash: await bcrypt.hash(next, 12) } })
    await logAudit({ actor, action: 'user.password_changed', entityType: 'User', entityId: actor.id })

    return { ok: true, message: 'Your password has been changed. Use the new one next time you sign in.' }
  } catch (error) {
    console.error('[account] password change failed', error)
    return { ok: false, error: 'Could not change the password. Please try again.' }
  }
}
