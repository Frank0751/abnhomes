/** Cancel the leftover demo hold through the application's own cancel path
 * (raw DELETE is blocked by the append-only ledger trigger, by design).
 *   DATABASE_URL=... npx tsx scripts/cancel_demo_hold.ts ABN-FT4TXH
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const code = process.argv[2]
if (!code) {
  console.error('usage: tsx scripts/cancel_demo_hold.ts <ABN-XXXXXX>')
  process.exit(1)
}

async function main() {
  const { cancelReservation } = await import('@/lib/short-stay/reservations')
  const reservation = await db.reservation.findUnique({ where: { code } })
  if (!reservation) throw new Error(`no reservation ${code}`)
  if (reservation.status !== 'PENDING') throw new Error(`status is ${reservation.status}, refusing`)
  await cancelReservation(reservation.id, {
    reason: 'Demo capture artifact — dates released',
  })
  console.log(`cancelled ${code}`)
  await db.$disconnect()
}
main()
