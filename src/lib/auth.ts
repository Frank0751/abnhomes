/**
 * Authentication.
 *
 * Two ways in, because the people using this system do not all have email:
 *
 *   - Staff sign in with email and password.
 *   - Tenants, owners, vendors and returning guests sign in with their phone
 *     number and a one-time code. In Ghana the phone number is the identity;
 *     asking a tenant to remember a password for a rent portal they open four
 *     times a year is asking them not to use it.
 *
 * Sessions are JWT so that the property scope travels with the token and a
 * page render does not need a database round trip to know what may be shown.
 */

import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'
import { db } from '@/lib/db'
import { normalisePhone, phoneVariants } from '@/lib/core/phone'
import { authConfig } from '@/lib/auth.config'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      partyId: string | null
      propertyIds: string[]
    } & DefaultSession['user']
  }

  interface User {
    role: Role
    partyId: string | null
    propertyIds: string[]
  }
}

const OTP_TTL_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: 'staff',
      name: 'Staff sign in',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').toLowerCase().trim()
        const password = String(credentials?.password ?? '')
        if (!email || !password) return null

        const user = await db.user.findUnique({
          where: { email },
          include: { propertyAccess: true },
        })
        if (!user?.passwordHash || !user.active) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          partyId: user.partyId,
          propertyIds: user.propertyAccess.map((a) => a.propertyId),
        }
      },
    }),

    Credentials({
      id: 'otp',
      name: 'Phone sign in',
      credentials: {
        phone: { label: 'Phone', type: 'tel' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(credentials) {
        const phone = normalisePhone(String(credentials?.phone ?? ''))
        const code = String(credentials?.code ?? '').trim()
        if (!phone || code.length !== 6) return null

        const record = await db.oneTimeCode.findFirst({
          where: {
            identifier: phone,
            purpose: 'LOGIN',
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        })
        if (!record) return null

        if (record.attempts >= OTP_MAX_ATTEMPTS) return null

        const valid = await bcrypt.compare(code, record.codeHash)
        if (!valid) {
          await db.oneTimeCode.update({
            where: { id: record.id },
            data: { attempts: { increment: 1 } },
          })
          return null
        }

        await db.oneTimeCode.update({
          where: { id: record.id },
          data: { consumedAt: new Date() },
        })

        const user = await db.user.findFirst({
          where: { phone: { in: phoneVariants(phone) } },
          include: { propertyAccess: true },
        })
        if (!user || !user.active) return null

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), phoneVerified: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          partyId: user.partyId,
          propertyIds: user.propertyAccess.map((a) => a.propertyId),
        }
      },
    }),

    Credentials({
      id: 'portal',
      name: 'Booking code sign in',
      credentials: {
        identifier: { label: 'Email or phone', type: 'text' },
        code: { label: 'Portal code', type: 'text' },
      },
      async authorize(credentials) {
        const raw = String(credentials?.identifier ?? '').trim()
        const code = String(credentials?.code ?? '').trim().toUpperCase()
        if (!raw || !code) return null

        // The code only opens the booking it was issued for, and only when the
        // email or phone the guest supplies matches that booking. Either half
        // alone is useless.
        const reservation = await db.reservation.findUnique({
          where: { portalCode: code },
          select: {
            id: true,
            status: true,
            guest: { select: { id: true, email: true, phone: true } },
          },
        })
        if (
          !reservation ||
          !['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'].includes(reservation.status)
        ) {
          return null
        }

        const guest = reservation.guest
        const phone = normalisePhone(raw)
        const matches =
          (guest.email && guest.email.toLowerCase() === raw.toLowerCase()) ||
          Boolean(guest.phone && phone && phoneVariants(guest.phone).includes(phone))
        if (!matches) return null

        // Created when the code was issued; the backfill keeps older bookings covered.
        const user = await db.user.findUnique({
          where: { partyId: guest.id },
          include: { propertyAccess: true },
        })
        if (!user || !user.active) return null

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          partyId: user.partyId,
          propertyIds: user.propertyAccess.map((a) => a.propertyId),
        }
      },
    }),
  ],
})

/**
 * Issue a login code. Returns the code only when no SMS provider is
 * configured, so local development does not need a gateway — never in
 * production, where it is delivered by SMS and nowhere else.
 */
export async function issueLoginCode(
  rawPhone: string
): Promise<{ ok: boolean; devCode?: string; reason?: string }> {
  const phone = normalisePhone(rawPhone)
  if (!phone) return { ok: false, reason: 'That does not look like a valid phone number.' }

  const user = await db.user.findFirst({ where: { phone: { in: phoneVariants(phone) } } })

  // Do not reveal whether the number is registered.
  if (!user || !user.active) return { ok: true }

  const { otpCode } = await import('@/lib/core/ids')
  const code = otpCode()
  const codeHash = await bcrypt.hash(code, 10)

  await db.oneTimeCode.create({
    data: {
      identifier: phone,
      codeHash,
      purpose: 'LOGIN',
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
    },
  })

  const { sendSms } = await import('@/lib/messaging')
  await sendSms({
    to: phone,
    body: `${code} is your ABN Homes sign-in code. It expires in ${OTP_TTL_MINUTES} minutes.`,
    template: 'login_otp',
  })

  const isSimulated = !process.env.SMS_API_KEY
  return { ok: true, ...(isSimulated ? { devCode: code } : {}) }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}
