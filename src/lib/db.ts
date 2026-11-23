/**
 * The database client — one import for the whole app, two runtimes behind it.
 *
 * Every module does `import { db } from '@/lib/db'` and calls `db.user...`.
 * That stays true everywhere. What sits behind `db` depends on where the code
 * is running:
 *
 *   NODE (Vercel, `next dev`, scripts)
 *     One PrismaClient for the process, on Prisma's native engine — exactly
 *     what ran before Cloudflare was introduced. Set PRISMA_DRIVER=pg to run
 *     the Node path on the pg driver adapter instead, which is how the Workers
 *     data path can be exercised locally against the real database.
 *
 *   CLOUDFLARE WORKERS
 *     One PrismaClient PER REQUEST, on the pg driver adapter. This is not a
 *     preference. Workers forbid a socket opened during one request from being
 *     used by another, so a single module-level client works for the first
 *     request and hangs the next. A WeakMap keyed on the request's
 *     ExecutionContext gives each request its own client, and lets it be
 *     collected when the request is done.
 *
 * `db` is a Proxy that resolves the right client on every property access, so
 * none of the 386 call sites had to change. The one rule this imposes: never
 * capture `db.something` at module scope. A captured delegate would pin the
 * client of whichever request first touched it.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getCloudflareContext } from '@opennextjs/cloudflare'

type LogLevel = 'query' | 'warn' | 'error'

// Query logging is deafening once the ledger is busy. Warnings and errors are
// what matter; set PRISMA_LOG_QUERIES=1 when you need the firehose.
const LOG: LogLevel[] = process.env.PRISMA_LOG_QUERIES ? ['query', 'warn', 'error'] : ['warn', 'error']

/** True inside workerd. Node 21+ also has `navigator`, with a different agent. */
const ON_WORKERS =
  typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'

/**
 * Prepare a connection string for node-postgres.
 *
 * DATABASE_URL was written for Prisma's own engine, and two of its parameters
 * mean something else — or nothing — to pg:
 *
 *   pgbouncer, connection_limit   Prisma engine settings. pg ignores them at
 *                                 best; they are removed so they cannot reach
 *                                 the server as startup parameters.
 *   sslmode=require               To the Prisma engine and to libpq this means
 *                                 "encrypt, but do not verify the certificate".
 *                                 Recent pg reads it as full verification, and
 *                                 Supabase signs its certificate with its own
 *                                 root CA, which no default trust store holds —
 *                                 so the connection would be refused. Passing
 *                                 the libpq meaning explicitly keeps the exact
 *                                 behaviour the engine had: encrypted, not
 *                                 authenticated. Pinning Supabase's CA would be
 *                                 stronger, and is a separate change.
 */
function forPg(url: string): { connectionString: string; ssl?: { rejectUnauthorized: false } } {
  const parsed = new URL(url)
  const sslmode = parsed.searchParams.get('sslmode')
  for (const key of ['pgbouncer', 'connection_limit', 'sslmode']) parsed.searchParams.delete(key)
  return {
    connectionString: parsed.toString(),
    ...(sslmode && sslmode !== 'disable' ? { ssl: { rejectUnauthorized: false as const } } : {}),
  }
}

function adapterClient(url: string, pool: { max?: number; maxUses?: number }): PrismaClient {
  const adapter = new PrismaPg({ ...forPg(url), ...pool })
  return new PrismaClient({ adapter, log: LOG })
}

// ---------------------------------------------------------------- Node path

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function nodeClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma =
      process.env.PRISMA_DRIVER === 'pg'
        ? // A handful of connections per process: enough for the parallel
          // reads a page makes, few enough that many serverless instances do
          // not exhaust the pooler.
          adapterClient(requiredUrl(), { max: 5 })
        : new PrismaClient({ log: LOG })
  }
  return globalForPrisma.prisma
}

// ------------------------------------------------------------- Workers path

type HyperdriveBinding = { connectionString: string }

const perRequest = new WeakMap<object, PrismaClient>()

function workersClient(): PrismaClient {
  let context: ReturnType<typeof getCloudflareContext>
  try {
    context = getCloudflareContext()
  } catch {
    // Reaching the database outside a request on Workers would mean sharing a
    // socket across requests — the one thing the runtime forbids. Better a
    // clear error here than a request that hangs somewhere else.
    throw new Error(
      'The database was used outside a request on Cloudflare Workers. ' +
        'Move the call inside a request, route handler, server action or scheduled handler.'
    )
  }

  const key = context.ctx as object
  const existing = perRequest.get(key)
  if (existing) return existing

  // Hyperdrive, when bound, keeps warm pooled connections next to the
  // database; without it every request would pay a TLS handshake to Ireland.
  const hyperdrive = (context.env as { HYPERDRIVE?: HyperdriveBinding }).HYPERDRIVE
  const client = adapterClient(hyperdrive?.connectionString ?? requiredUrl(), {
    // Belt and braces: even if a client ever outlived its request, a
    // connection is used once and closed, so no socket can cross requests.
    maxUses: 1,
  })
  perRequest.set(key, client)
  return client
}

function requiredUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set.')
  return url
}

function current(): PrismaClient {
  return ON_WORKERS ? workersClient() : nodeClient()
}

// ------------------------------------------------------------------- export

export const db: PrismaClient = new Proxy(Object.create(PrismaClient.prototype) as PrismaClient, {
  get(_target, prop) {
    const client = current()
    const value = Reflect.get(client, prop, client)
    // Methods such as $transaction and $queryRaw read `this`; bind them to
    // the real client, not to the proxy. Model delegates (db.user) are
    // objects and already carry their client.
    return typeof value === 'function' ? value.bind(client) : value
  },
  has(_target, prop) {
    return Reflect.has(current(), prop)
  },
})

/**
 * Options for interactive transactions that do real work. The 5-second
 * default assumes a database in the same room: over the Supabase pooler from
 * another region, a booking transaction alone can brush past it, and a
 * timeout mid-checkout is exactly the failure a ledger must never have.
 * 20s is still far below any request deadline; maxWait keeps a congested
 * pooler from hanging the request silently.
 */
export const TX_OPTS = { timeout: 20_000, maxWait: 10_000 } as const
