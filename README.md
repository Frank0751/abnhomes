# ABN Homes — Operations Platform

The system that runs ABN Homes' buildings: nightly guests and long-term tenants, the money behind
both, the repairs, and the owners who need paying.

It is built on top of the existing ABN Homes website rather than beside it. The marketing site is
still there, unchanged in look, and now reads live availability from the same database the front
desk works in — so the website can never offer a night the office has already sold.

---

## What it does

**Two letting models, one system.** ABN runs nightly serviced apartments *and* yearly tenancies.
Letting mode is a property of the unit, not of the software, so a unit can be sold by the night in
December and let for a year in January without anything being re-keyed.

| Short stay | Long let |
| --- | --- |
| Availability calendar, per unit | Leases with term, cycle and escalation |
| Reservations, check-in and check-out | The monthly rent run |
| Seasonal rate plans and minimum stays | Advance rent, earned month by month |
| Housekeeping turnovers, generated automatically | Arrears aging and reminders |
| Booking-site calendar sync | Service charges and late fees |
| Occupancy, nightly rate, revenue per available night | Collection rate |

Both post into the same ledger, appear on the same owner statement, and raise the same maintenance
tickets.

**Multi-owner from the first line of schema.** ABN owns some buildings and manages others. Every
property carries a management agreement — ABN's own at a zero fee — so statements are produced by
one code path and always reconcile.

**Built for how letting actually works in Ghana.** Mobile money as a first-class rail, not a
footnote. Phone-number identity with one-time codes. Cash receipts that work with no signal. Ghana
Card capture. Advance rent treated as a liability that unwinds monthly, which is the single most
important local difference and the one most off-the-shelf software gets wrong.

---

## Getting it running

You need Node 18.17+ and a PostgreSQL database. [Neon](https://neon.tech) and
[Supabase](https://supabase.com) both have a free tier that works.

```bash
npm install
```

Put your connection string in `.env`:

```bash
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
AUTH_SECRET="run: openssl rand -base64 32"
```

Then create the schema, install the database guarantees, and load ABN's real portfolio:

```bash
npm run db:setup
```

That runs three things — `db push`, `db:constraints` and `db:seed`. Start the app:

```bash
npm run dev
```

Sign in at [localhost:3000/signin](http://localhost:3000/signin). The seed prints the accounts it
created; every one uses the password `AbnHomes2026!`.

| Account | Sees |
| --- | --- |
| `admin@abnhomes.com.gh` | Everything |
| `manager@abnhomes.com.gh` | Assigned buildings, no settings |
| `desk@abnhomes.com.gh` | Bookings and taking payment |
| `finance@abnhomes.com.gh` | All money, no leases or bookings |
| `housekeeping@abnhomes.com.gh` | The changeover board |
| `owner@example.com` | The owner portal |
| `tenant@example.com` | The tenant portal |

**Change these before the system holds anything real.**

---

## The parts worth knowing about

### Money is append-only

No table stores a balance. A balance is the sum of `LedgerEntry` rows, computed on read. A
correction is a reversing entry, never an edit, and the original stays visible forever.

This is enforced by the database, not by good intentions — `prisma/sql/001_constraints.sql`
installs a trigger that makes `UPDATE` and `DELETE` on the ledger raise an error. A careless
`prisma.ledgerEntry.update()` in a future feature fails loudly instead of quietly breaking the
guarantee everything else rests on.

Every amount is an integer number of minor units (pesewas, cents) carried with its currency. No
floating-point number touches money anywhere in the stack.

### Double bookings are impossible, not unlikely

Availability is checked in the application for a good error message, and enforced in Postgres with
an exclusion constraint for correctness. Two clerks confirming the same dates in the same second
both pass the application check; the second `INSERT` fails at the database. Stays occupy the
half-open interval `[checkIn, checkOut)`, so a departure morning stays sellable.

### Advance rent is a liability, not income

A tenant paying two years up front has not handed the owner two years of income. The payment sits
as credit; the rent run raises one charge a month and settles it from that credit; owner statements
recognise revenue from charges raised, never payments received. The unearned balance is therefore
derived, not stored, and can never drift from the ledger.

### Offline is scoped to the people who need it

Staff collecting cash in a stairwell need it. Guests, tenants and owners do not. Payments carry a
client-generated idempotency key so replaying a queue eleven times still produces one payment, and
anything captured offline stays visibly `PENDING` until the office confirms it against the float.

---

## Commands

| | |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Tests for the money, date, pricing and escalation arithmetic |
| `npm run db:setup` | Schema, constraints and seed in one go |
| `npm run db:push` | Schema only |
| `npm run db:constraints` | The exclusion constraint and ledger triggers |
| `npm run db:seed` | ABN's portfolio and demo accounts |

---

## Scheduled jobs

Configured in `vercel.json`, protected by `CRON_SECRET`.

| Job | When | What |
| --- | --- | --- |
| `/api/cron/rent-run` | 06:00 daily | Raises rent due, sweeps advance rent against it, applies late fees, sends reminders |
| `/api/cron/ical-sync` | Hourly | Pulls booking-site calendars so their bookings block ours |

The rent run is idempotent — every charge carries a run key, so running it twice cannot bill a
tenant twice. It can also be rehearsed from the interface before it touches anything.

---

## What is not built yet

Stated plainly, because a half-built feature you do not know about is worse than one you do.

- **Offline is designed for, not shipped.** The schema, idempotency keys and sync badges are all
  in place; the service worker and IndexedDB working set are not. Payments recorded in the office
  work today.
- **PayPal is deliberately switched off.** PayPal has historically been send-only for Ghanaian
  accounts. The channel exists in the payment layer and reports itself as unavailable until
  someone confirms with PayPal what ABN can actually receive.
- **Documents upload to nothing yet.** The `Document` model and its restricted-visibility flag
  exist; object storage is not wired up.
- **Opening balances need a migration session.** Existing tenants arrive with history — paid to a
  date, owing an amount, some with years banked. That needs a spreadsheet from ABN and a
  reconciliation sitting, not a guess.
- **Calendar sync is not instant.** The booking sites poll their feeds every few hours. It closes
  most of the double-booking window, not all of it.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the reasoning behind the money model, and
[`docs/OPERATIONS.md`](docs/OPERATIONS.md) for running it day to day.
