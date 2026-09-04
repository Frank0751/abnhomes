# Architecture

The decisions that would be expensive to reverse, and why they were made that way.

---

## 1. One spine, two letting modes

Nightly guests and yearly tenants look like two businesses, and most property software makes you
pick one. ABN runs both, so `lettingMode` is a column on `Unit` — `SHORT_STAY`, `LONG_LET` or
`BOTH` — rather than a fork in the codebase.

The two modes differ only in **how occupancy and revenue are created**:

```
Reservation ──┐                        ┌── Lease
RatePlan   ───┤                        ├── RecurringCharge
CalendarBlock ┤                        ├── (rent run)
              │                        │
              └──►  Charge ──► LedgerEntry ◄──┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
              Owner statement  Arrears     Party balance
```

Everything below `Charge` is shared. A reservation and a lease both do the same thing to the
ledger: create charges against a unit for a period of time. Build that once and both modes get
statements, arrears, maintenance recharges and audit for free.

This is why the split is safe rather than expensive.

---

## 2. Money is append-only

**No table stores a balance.** A balance is `sum(debits) − sum(credits)` over `LedgerEntry`,
computed on read.

### Why

The system has to work for a manager standing in a building with no signal. She records
GHS 2,400 in cash. Meanwhile the accountant, online, applies a credit note to the same tenant. An
hour later her phone reconnects.

If either side stored a *balance*, one of those two facts would silently disappear — and it would
be the cash, because the later write wins. Because entries only ever append, two devices cannot
overwrite each other's money. They can only both add to the same ledger, which is what actually
happened.

### The rules

1. `LedgerEntry` rows are never updated and never deleted.
2. A correction is a `REVERSAL` entry pointing at the original. Both stay visible.
3. Every ledger write happens in a transaction with the `Charge`, `Payment` or `Allocation` it
   belongs to.
4. Amounts are integer minor units plus an explicit currency. No floats.

### Enforced, not merely intended

`prisma/sql/001_constraints.sql` installs:

```sql
CREATE TRIGGER ledger_no_mutation
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_is_append_only();
```

Application discipline decays. A future feature written in a hurry will eventually call
`ledgerEntry.update()`. With the trigger, that fails loudly in development instead of quietly
corrupting the one thing the whole system rests on.

The same file adds `CHECK ("amountMinor" > 0)` — direction carries the sign, so a negative debit
and a positive credit cannot both exist to mean the same thing — and a trigger preventing a payment
from being allocated beyond its own value.

### Sign convention

From the perspective of the party's account with ABN:

- `DEBIT` increases what they owe (rent charge, late fee)
- `CREDIT` reduces it (payment, waiver)

`balance > 0` → they owe ABN. `balance < 0` → ABN owes them, or they are in credit.

This works for owners too: revenue collected on their behalf is a credit, the management fee is a
debit, and a negative balance means a payout is due.

---

## 3. Advance rent

The local rule that shapes the whole long-let module.

Ghanaian tenancies are commonly paid a year or more up front. That money is **not revenue on the
day it arrives** — it is a liability earned month by month. Treating it as income would tell an
owner they had a spectacular January and eleven empty months, and would overstate tax.

The treatment:

1. The tenant pays. That is a `PAYMENT` credit and nothing more. Their balance goes deep into
   credit.
2. The rent run raises **one charge per month** for the life of the lease.
3. `applyCreditsToOpenCharges` settles each new charge from that credit, oldest first.
4. Owner statements recognise revenue from **charges raised**, never payments received.

So the unearned balance is simply the tenant's unapplied credit. It unwinds correctly on its own,
and there is no parallel amortisation schedule to drift out of step with the ledger.

`unearnedRent()` and `monthsPaidAhead()` derive it; nothing stores it.

---

## 4. Double bookings

Defended twice, deliberately.

**In the application** (`lib/short-stay/availability.ts`) for a readable error: *"Those dates are
not available: booking ABN-2K4F7Q for Michael Osei runs 12 to 16 March."*

**In Postgres** for correctness under concurrency:

```sql
EXCLUDE USING gist (
  "unitId" WITH =,
  daterange("checkIn"::date, "checkOut"::date, '[)') WITH &&
) WHERE (status::text IN ('PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT'))
```

Two clerks confirming the same dates in the same second both pass the application check. The second
`INSERT` fails at the database.

Note the `'[)'` — half-open. A stay ending on the 14th does not collide with one starting on the
14th. Treating the range as closed loses one sellable night per booking, which on a small portfolio
is real money every year.

---

## 5. Multi-currency

Short stays are priced in USD and long lets in GHS, often in the same building in the same month.

Every `LedgerEntry` stores `fxRateToBase` — **the rate at the moment it was posted**. Reporting
converts using that stored rate, never today's rate applied to old history. Without this, every
owner statement from last year would silently change value every time the cedi moved.

Statements are produced in the reporting base currency (`BASE_CURRENCY`, default GHS).

---

## 6. Access control

Two independent questions, and conflating them is how property software leaks data:

1. **What may this role do?** → `ROLE_PERMISSIONS` in `lib/rbac.ts`
2. **Which buildings may they do it to?** → `UserPropertyAccess`

A property manager has `money:record` in the abstract, but only for their assigned buildings. Both
checks must pass. `assertCanOnProperty(actor, permission, propertyId)` is the normal call at the
top of a mutation.

`SUPER_ADMIN` and `FINANCE` are unscoped **by policy, not by data** — `isUnscoped()` — so nobody
has to remember to grant them every new building.

Scope is applied in the query layer via `propertyWhere()` and `unitScopeWhere()`, not in the
interface. Hiding a button is decoration; the check that matters is the server one, and every
server action re-runs it.

---

## 7. Offline

Scoped to staff, who genuinely need it. Guests, tenants, owners and vendors get a fast online app.

- **Client-generated ids.** `LedgerEntry.id` has no database default — it is a UUIDv7 minted on the
  device, so a phone with no signal can create an id that will never collide and still sorts by
  time when it syncs.
- **Idempotency keys.** `Payment.idempotencyKey`, `Reservation.idempotencyKey`,
  `Ticket.idempotencyKey` are unique. Replaying a queue eleven times produces one effect.
- **Visible sync state.** `SyncState` is `SYNCED`, `PENDING` or `CONFLICT` and is never hidden in
  the interface. A receipt issued offline prints "pending confirmation". Staff must never be unsure
  whether a payment landed.

### Why not PowerSync or ElectricSQL

They replicate Postgres to the device properly and they are good. They also add cost, a second
system to operate, and a much harder failure mode to debug. Because the money model is append-only,
a plain outbox queue buys the same safety for this workload at a fraction of the complexity.

If ABN later needs many devices editing the same records live, that is the upgrade path — and the
append-only ledger is exactly what makes the upgrade cheap.

---

## 8. Payments

Everything goes through `lib/payments/gateway.ts` so the ledger never learns which provider was
used. Adding a rail means writing one adapter and touching no money code.

Paystack denominates in the currency's lowest unit — pesewas, cents — which is how this system
stores money. That is not a coincidence; it is why.

**Never trust a redirect.** A callback landing on the success page proves the payer reached that
page and nothing else. `settleFromProvider` re-verifies with Paystack server-side before a pesewa
touches the ledger, and is idempotent on the provider reference because a webhook and a callback
will both arrive, sometimes twice, sometimes at once.

Webhook signatures are verified against the **raw request body** with a timing-safe comparison.
Re-serialising parsed JSON changes the bytes and the signature will never match.

**PayPal is present and switched off.** `supportedChannels()` reports it as unavailable with the
reason, rather than hiding it, so nobody wonders whether it was forgotten.

---

## 9. Route structure

```
src/app/
  (site)/          Marketing site — nav, footer, floating contact
    book/          Public availability search and direct booking
  admin/           Staff operations, own shell, no marketing chrome
  portal/          Tenant, owner and vendor self-service
  signin/
  api/
```

The root layout is deliberately bare. Marketing chrome lives in `(site)/layout.tsx` so the admin
and the portals are not wrapped in a public navigation bar and a footer full of sales links.

---

## 10. Where to be careful

| If you are changing… | Read first |
| --- | --- |
| Anything in `lib/core/ledger.ts` | This document, sections 2 and 3 |
| Availability or reservation dates | Section 4, and `lib/core/dates.ts` on half-open intervals |
| The rent run | It must stay idempotent. Every charge needs a `runKey` |
| Permissions | Section 6. Add to `Permission`, then to every role that should have it |
| A Prisma migration | Re-run `npm run db:constraints` afterwards — `db push` does not preserve them |
