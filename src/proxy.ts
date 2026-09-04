// Next 16 renamed this convention from "middleware" to "proxy".
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

export default NextAuth(authConfig).auth

export const config = {
  matcher: [
    /**
     * Guard the application surfaces. The marketing site, the auth endpoints
     * and static assets stay public — a guest browsing apartments must never
     * meet a login wall.
     */
    '/admin/:path*',
    '/portal/:path*',
    '/api/admin/:path*',
  ],
}
