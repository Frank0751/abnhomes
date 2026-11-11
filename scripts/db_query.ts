/** Ad-hoc read query against DATABASE_URL. Usage: tsx scripts/db_query.ts "SELECT ..." */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const sql = process.argv[2]
if (!sql) {
  console.error('usage: tsx scripts/db_query.ts "SELECT ..."')
  process.exit(1)
}

async function main() {
  const rows = await db.$queryRawUnsafe(sql)
  console.log(JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 1))
  await db.$disconnect()
}
main()
