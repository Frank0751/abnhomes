/**
 * Edge-safe half of the auth configuration.
 *
 * Middleware runs on the edge runtime, where Prisma and bcrypt cannot go.
 * This file holds only the callbacks and route rules, so middleware can decide
 * whether someone is signed in without dragging the database in with it.
 */

import type { NextAuthConfig } from 'next-auth'
import type { Role } from '@prisma/client'

/** Route prefixes and the roles allowed to reach them. */
const ROUTE_RULES: Array<{ prefix: string; roles: Role[] }> = [
  {
    prefix: '/admin',
    roles: ['SUPER_ADMIN', 'PROPERTY_MANAGER', 'FRONT_DESK', 'FINANCE', 'HOUSEKEEPING'],
  },
  { prefix: '/portal/owner', roles: ['OWNER', 'SUPER_ADMIN', 'FINANCE'] },
  { prefix: '/portal/tenant', roles: ['TENANT', 'SUPER_ADMIN'] },
  { prefix: '/portal/vendor', roles: ['VENDOR', 'SUPER_ADMIN'] },
]

export function ruleForPath(pathname: string) {
  return ROUTE_RULES.find((rule) => pathname.startsWith(rule.prefix))
}

export const authConfig = {
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 30,
  },
  trustHost: true,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.partyId = user.partyId
        token.propertyIds = user.propertyIds
      }
      // Lets a property assignment change take effect without a fresh login.
      if (trigger === 'update' && session?.propertyIds) {
        token.propertyIds = session.propertyIds
      }
      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.partyId = (token.partyId as string | null) ?? null
        session.user.propertyIds = (token.propertyIds as string[]) ?? []
      }
      return session
    },

    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      const rule = ruleForPath(pathname)
      if (!rule) return true

      const role = auth?.user?.role as Role | undefined
      if (!role) return false
      return rule.roles.includes(role)
    },
  },
  providers: [],
} satisfies NextAuthConfig
