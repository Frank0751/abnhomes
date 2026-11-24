/**
 * "Forgot my password": a one-hour, single-use link sent to a member of
 * staff's own email. It lands on the same page an invitation does
 * (/set-password/<token>), which already says "Choose a new password" to
 * someone who has one.
 *
 * Two rules that matter more than the code:
 *   - the answer to "send me a link" is the same whether or not the address
 *     belongs to anyone, so the form cannot be used to find out who works here;
 *   - at most one link every five minutes per address, so it cannot be used
 *     to flood somebody's inbox.
 */

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { emailHtml, sendEmail } from '@/lib/notify'
import { siteUrl } from '@/lib/site-url'
import { STAFF_ROLES } from '@/lib/rbac'
import { hashToken } from '@/lib/staff-invites'

const RESET_MINUTES = 60
const THROTTLE_MINUTES = 5

export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase()
  if (!email || email.length > 200) return

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, role: true, active: true, suspendedAt: true, passwordHash: true },
  })
  // Staff with a password only. Someone invited but not yet set up should
  // use their invitation; a guest has no password to reset.
  if (!user || !user.active || user.suspendedAt || !user.passwordHash || !STAFF_ROLES.includes(user.role)) return

  const recent = await db.oneTimeCode.findFirst({
    where: {
      identifier: email,
      purpose: 'RESET_PASSWORD',
      createdAt: { gt: new Date(Date.now() - THROTTLE_MINUTES * 60_000) },
    },
    select: { id: true },
  })
  if (recent) return

  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  await db.$transaction([
    db.oneTimeCode.updateMany({
      where: { identifier: email, purpose: 'RESET_PASSWORD', consumedAt: null },
      data: { consumedAt: now },
    }),
    db.oneTimeCode.create({
      data: {
        identifier: email,
        purpose: 'RESET_PASSWORD',
        codeHash: hashToken(token),
        expiresAt: new Date(now.getTime() + RESET_MINUTES * 60_000),
      },
    }),
  ])

  const link = `${siteUrl()}/set-password/${token}`
  try {
    await sendEmail(
      email,
      'Reset your ABN Homes password',
      emailHtml({
        heading: 'Choose a new password',
        lines: [
          'Someone asked to reset the password for this ABN Homes operations account.',
          `The button below works once and expires in ${RESET_MINUTES} minutes.`,
          'If that was not you, ignore this email: your password has not changed.',
        ],
        cta: { label: 'Choose a new password', url: link },
        footer: 'Trouble signing in? Call the office on 054 170 4048.',
      })
    )
  } catch (error) {
    console.error('[password-reset] email failed', error)
  }
}
