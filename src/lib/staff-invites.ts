/**
 * Invitations for staff: a link that lets a new person choose their own
 * password, so nobody ever has to be told one.
 *
 * The link carries 32 random bytes. Only a SHA-256 of it is stored, so a copy
 * of the database is not a set of working links. SHA-256 rather than bcrypt
 * because the token is already unguessable (bcrypt exists to slow down
 * guessing a short code) and a plain hash can be looked up directly.
 *
 * Stored as a RESET_PASSWORD one-time code against the person's email. The
 * same link and page will serve "forgot my password" when that is built.
 */

import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { emailHtml, sendEmail } from '@/lib/notify'
import { siteUrl } from '@/lib/site-url'
import { ROLE_LABELS } from '@/lib/rbac'
import type { Role } from '@prisma/client'

export const INVITE_DAYS = 7
export const MIN_PASSWORD_LENGTH = 10

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export type IssuedInvite = {
  link: string
  /** False when the email could not be sent; the link still works and can be shared another way. */
  emailed: boolean
  emailError?: string
}

/**
 * Make a fresh link for this person and email it. Any earlier link they were
 * sent stops working, so only the newest one is ever live.
 */
export async function issueInvite(args: {
  user: { id: string; name: string; email: string; role: Role }
  invitedBy: string
}): Promise<IssuedInvite> {
  const identifier = args.user.email.toLowerCase()
  const token = randomBytes(32).toString('base64url')
  const now = new Date()

  await db.$transaction([
    db.oneTimeCode.updateMany({
      where: { identifier, purpose: 'RESET_PASSWORD', consumedAt: null },
      data: { consumedAt: now },
    }),
    db.oneTimeCode.create({
      data: {
        identifier,
        purpose: 'RESET_PASSWORD',
        codeHash: hashToken(token),
        expiresAt: new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  const link = `${siteUrl()}/set-password/${token}`
  const firstName = args.user.name.split(' ')[0] || args.user.name

  try {
    await sendEmail(
      args.user.email,
      'You have been invited to ABN Homes operations',
      emailHtml({
        heading: `Welcome, ${escapeHtml(firstName)}`,
        lines: [
          `${escapeHtml(args.invitedBy)} has given you access to the ABN Homes operations console as <strong>${ROLE_LABELS[args.user.role]}</strong>.`,
          `Choose your password with the button below. The link works once and expires in ${INVITE_DAYS} days.`,
          `You will sign in with this email address: <strong>${escapeHtml(args.user.email)}</strong>.`,
        ],
        cta: { label: 'Choose my password', url: link },
        footer: 'If you were not expecting this, ignore it and nothing will happen. Questions? Call the office on 054 170 4048.',
      })
    )
    return { link, emailed: true }
  } catch (error) {
    console.error('[invite] email failed', error)
    return {
      link,
      emailed: false,
      emailError: error instanceof Error ? error.message : String(error),
    }
  }
}

/** The person a link belongs to, if it is still valid. Does not use it up. */
export async function findInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null

  const code = await db.oneTimeCode.findFirst({
    where: {
      codeHash: hashToken(token),
      purpose: 'RESET_PASSWORD',
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  if (!code) return null

  const user = await db.user.findUnique({
    where: { email: code.identifier },
    select: { id: true, name: true, email: true, role: true, active: true, suspendedAt: true, passwordHash: true },
  })
  if (!user || !user.active || user.suspendedAt) return null

  return { code, user }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
