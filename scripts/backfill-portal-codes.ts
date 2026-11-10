/**
 * One-off: issue portal codes for confirmed bookings that predate the portal
 * feature, and make sure each of those guests has an account behind their
 * code. Safe to run repeatedly — ensurePortalAccess mints nothing that
 * already exists.
 */

import { PrismaClient } from '@prisma/client'
import { ensurePortalAccess } from '../src/lib/short-stay/reservations'

const db = new PrismaClient()

async function main() {
  const pending = await db.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      portalCode: null,
    },
    select: {
      id: true,
      code: true,
      guest: { select: { name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Confirmed bookings without a portal code: ${pending.length}\n`)

  for (const r of pending) {
    const contact = r.guest.email ?? r.guest.phone ?? 'no contact on file'
    const portalCode = await ensurePortalAccess(r.id)
    console.log(`${r.code} — ${r.guest.name} (${contact}): ${portalCode ?? 'NOT ISSUED'}`)
  }

  const withCode = await db.reservation.count({
    where: { status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] }, NOT: { portalCode: null } },
  })
  console.log(`\nDone. Confirmed bookings now holding a portal code: ${withCode}`)
  await db.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
