/**
 * Refuse to run a data-destroying command against the live database.
 *
 * ABN runs one database for both local development and the live site, so every
 * destructive command a developer types lands on real bookings and a real
 * append-only ledger. `prisma migrate reset` drops everything; `prisma db push
 * --accept-data-loss` will quietly drop a populated column to make the database
 * match the schema, with no prompt at all. Neither asks twice.
 *
 * This asks. It is the only thing standing between a muscle-memory `npm run
 * db:push` and a Saturday spent explaining to guests why their bookings are
 * gone.
 *
 * Usage:  node scripts/db-guard.mjs <destructive|write> "<what is about to run>"
 *
 * It FAILS CLOSED: a database it cannot classify is treated as production.
 * Being wrong in that direction costs an annoyed developer; being wrong in the
 * other direction costs the business its records.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const [, , mode = 'destructive', label = 'this command'] = process.argv

/* ------------------------------------------------------------------ env */

/**
 * Read DATABASE_URL from the real environment, falling back to .env.
 *
 * Deliberately a small hand-rolled parse rather than a dependency: this file
 * has to work even when node_modules is in a bad state, which is exactly when
 * someone reaches for `db:push` to fix things.
 */
function databaseUrl() {
  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL, from: 'the environment' }
  }
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return { url: null, from: null }

  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => /^\s*DATABASE_URL\s*=/.test(l))
  if (!line) return { url: null, from: null }

  let value = line.slice(line.indexOf('=') + 1).trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }
  return { url: value, from: '.env' }
}

/** Explicit beats clever. DATABASE_ENV is how you say "this one is safe". */
function declaredEnv() {
  if (process.env.DATABASE_ENV) return process.env.DATABASE_ENV.toLowerCase()
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return null
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => /^\s*DATABASE_ENV\s*=/.test(l))
  if (!line) return null
  return line
    .slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
}

/* ------------------------------------------------------------- classify */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])

function classify(url) {
  let host
  try {
    host = new URL(url).hostname
  } catch {
    return { kind: 'unknown', host: '(could not be parsed)' }
  }

  // A database on this machine cannot be serving the live site.
  if (LOCAL_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.localhost')) {
    return { kind: 'development', host, why: 'it is on this machine' }
  }

  const declared = declaredEnv()
  if (declared === 'development' || declared === 'dev' || declared === 'test') {
    return { kind: 'development', host, why: `DATABASE_ENV=${declared}` }
  }
  if (declared === 'production' || declared === 'prod') {
    return { kind: 'production', host, why: `DATABASE_ENV=${declared}` }
  }

  // Remote and unlabelled. Assume the worst.
  return {
    kind: 'production',
    host,
    why: 'it is a remote database and nothing says otherwise',
  }
}

/* ---------------------------------------------------------------- speak */

const RED = '\u001b[31m'
const YELLOW = '\u001b[33m'
const DIM = '\u001b[2m'
const BOLD = '\u001b[1m'
const OFF = '\u001b[0m'

const rule = (c) => `${c}${'─'.repeat(68)}${OFF}`

function refuse(lines) {
  console.error('')
  console.error(rule(RED))
  console.error(`${RED}${BOLD}  REFUSED${OFF}`)
  console.error(rule(RED))
  for (const l of lines) console.error(`  ${l}`)
  console.error(rule(RED))
  console.error('')
  process.exit(1)
}

/* ----------------------------------------------------------------- main */

const { url, from } = databaseUrl()

if (!url) {
  refuse([
    'No DATABASE_URL found, in the environment or in .env.',
    '',
    `Rather than guess, ${label} is being stopped. Set DATABASE_URL`,
    'and run it again.',
  ])
}

const db = classify(url)

// A development database is nobody's problem. Get out of the way.
if (db.kind === 'development') {
  console.log(`${DIM}  db-guard: ${db.host} — development (${db.why}). Proceeding.${OFF}`)
  process.exit(0)
}

const override = process.env.ABN_DB_OVERRIDE === 'i-know-this-is-production'

if (mode === 'destructive' && !override) {
  refuse([
    `${BOLD}${label}${OFF} destroys data, and this is the live database.`,
    '',
    `  host     ${db.host}`,
    `  read from ${from}`,
    `  treated as production because ${db.why}`,
    '',
    'Right now one database serves both local development and the live',
    'site, so this would drop real bookings, real tenants and a ledger',
    'that is append-only and cannot be rebuilt.',
    '',
    `${YELLOW}If you genuinely mean it${OFF}, run it with the override:`,
    '',
    `  ${DIM}ABN_DB_OVERRIDE=i-know-this-is-production npm run <script>${OFF}`,
    '',
    'The better answer is a separate development database. Then set',
    'DATABASE_ENV=development in that .env and this guard steps aside.',
  ])
}

if (mode === 'write' && !override && process.env.ALLOW_PRODUCTION_WRITE !== 'yes') {
  refuse([
    `${BOLD}${label}${OFF} writes to the live database.`,
    '',
    `  host     ${db.host}`,
    `  read from ${from}`,
    `  treated as production because ${db.why}`,
    '',
    'This is not destructive — the seed upserts — but it will change',
    'live rooms, rates and staff accounts, and it is the real site.',
    '',
    `${YELLOW}To go ahead${OFF}:`,
    '',
    `  ${DIM}ALLOW_PRODUCTION_WRITE=yes npm run <script>${OFF}`,
  ])
}

console.log('')
console.log(rule(YELLOW))
console.log(`${YELLOW}${BOLD}  Running against the LIVE database${OFF}  ${DIM}${db.host}${OFF}`)
console.log(rule(YELLOW))
console.log('')
