'use server'

import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { findInvite, MIN_PASSWORD_LENGTH } from '@/lib/staff-invites'

export type SetPasswordResult = { ok: true; email: string } | { ok: false; error: string }

export async function setPasswordAction(
  token: string,
  _prev: SetPasswordResult | null,
  formData: FormData
): Promise<SetPasswordResult> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` }
  }
  if (password.length > 200) return { ok: false, error: 'That password is too long.' }
  if (password !== confirm) return { ok: false, error: 'The two passwords do not match.' }

  const invite = await findInvite(token)
  if (!invite) {
    return { ok: false, error: 'This link has expired or has already been used. Ask an administrator for a new one.' }
  }
  const { code, user } = invite
  if (user.email && password.toLowerCase().includes(user.email.split('@')[0].toLowerCase())) {
    return { ok: false, error: 'Choose a password that does not contain your email address.' }
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Use the link up in the same step as setting the password, and only if
  // nobody else has just used it: two tabs submitting at once get one winner.
  const done = await db.$transaction(async (tx) => {
    const claimed = await tx.oneTimeCode.updateMany({
      where: { id: code.id, consumedAt: null },
      data: { consumedAt: new Date() },
    })
    if (claimed.count !== 1) return false
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, emailVerified: new Date() },
    })
    return true
  })
  if (!done) {
    return { ok: false, error: 'This link has already been used. Ask an administrator for a new one.' }
  }

  await logAudit({
    actor: { id: user.id, role: user.role, propertyIds: [] },
    action: user.passwordHash ? 'user.password_reset' : 'user.password_set',
    entityType: 'User',
    entityId: user.id,
  })

  return { ok: true, email: user.email! }
}
