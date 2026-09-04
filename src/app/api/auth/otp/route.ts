/**
 * Request a one-time sign-in code.
 *
 * Always answers "we have sent a code if that number is registered", whether
 * or not it is. Telling an anonymous caller which phone numbers belong to
 * tenants would hand over a customer list.
 */

import { NextResponse } from 'next/server'
import { issueLoginCode } from '@/lib/auth'
import { normalisePhone } from '@/lib/core/phone'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string }
  const phone = normalisePhone(body.phone ?? '')

  if (!phone) {
    return NextResponse.json(
      { ok: false, message: 'Enter a valid phone number, for example 024 170 4048.' },
      { status: 400 }
    )
  }

  const result = await issueLoginCode(phone)

  return NextResponse.json({
    ok: true,
    message: 'If that number is registered, a sign-in code is on its way.',
    // Present only when no SMS gateway is configured, so local development
    // and demos work without one.
    ...(result.devCode ? { devCode: result.devCode } : {}),
  })
}
