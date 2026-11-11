import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logging is deafening once the ledger is busy. Warnings and errors
    // are what matter; set PRISMA_LOG_QUERIES=1 when you need the firehose.
    log: process.env.PRISMA_LOG_QUERIES ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Options for interactive transactions that do real work. The 5-second
 * default assumes a database in the same room: over the Supabase pooler from
 * another region, a booking transaction alone can brush past it, and a
 * timeout mid-checkout is exactly the failure a ledger must never have.
 * 20s is still far below any request deadline; maxWait keeps a congested
 * pooler from hanging the request silently.
 */
export const TX_OPTS = { timeout: 20_000, maxWait: 10_000 } as const
