# Running it

Day-to-day operation, and the things that will bite if nobody knows about them.

---

## Going live: the order that matters

1. **Start the Paystack application now.** It needs business registration and settlement bank
   details, and it takes real calendar time. Everything else can proceed in parallel; this cannot
   be hurried at the end.
2. **Provision Postgres** (Neon or Supabase free tier is fine to start). Set `DATABASE_URL`.
3. **`npm run db:setup`** — schema, constraints, seed.
4. **Change every seeded password.** The seed prints them; they are development credentials and
   nothing more.
5. **Set `AUTH_SECRET` and `CRON_SECRET`** to real random values. `openssl rand -base64 32`.
6. **Load the real portfolio.** Delete the demo owner, tenant, guest and vendor the seed created.
7. **Migrate opening balances.** See below — this is the step most likely to be underestimated.
8. **Connect the calendar feeds** from each unit page before taking a single direct booking.
9. **Point the booking sites at ABN's feeds** so they block our sold nights too.

---

## Opening balances

The hardest part of going live, and it is not technical.

Existing tenants arrive with history: paid to a date, owing an amount, some with two years already
banked. That has to land in an append-only ledger correctly, because everything downstream —
arrears aging, owner statements, the rent run — is computed from it.

What is needed from ABN:

- Per tenant: unit, rent, cycle, lease start and end, and **what they have paid to which date**
- Any arrears, with the month each unpaid charge belonged to
- Any advance held, and how many months it covers
- Deposits held, per tenant

Then, per tenant, in one sitting with someone who knows the tenancies:

1. Create the lease with its real start date.
2. Run the rent run — it raises every charge from the lease start to today.
3. Record the payments actually received, dated correctly.
4. Check the resulting balance against what ABN believes. Investigate every discrepancy before
   moving on; a balance that is nearly right is a balance that is wrong.

Do not shortcut this by entering a single opening-balance figure. The point of the ledger is that
it explains itself, and a lump sum explains nothing.

---

## The rent run

Runs at 06:00 daily via Vercel Cron, and can be run by hand from **Leases → Run rent**.

It is **idempotent**. Every charge carries a `runKey` of the form `rent:<leaseId>:<YYYY-MM>`.
Running it twice — by cron, by hand, by a retry after a timeout — cannot bill a tenant twice.

It is **rehearsable**. The dialog always previews first, computed by the same code that does the
work rather than an approximation of it. Nobody should learn what the rent run does by running it
against real tenants.

What it does, in order:

1. Raises rent and service charges for every period that has **started** and fallen due. It does
   not front-load a whole lease — a three-year tenancy does not put three years of debt on a
   tenant's account on day one.
2. Sweeps unapplied credit — advance rent — against the new charges, oldest first.
3. Applies late fees to charges past their grace period. Idempotent per charge, so a charge is
   fined once.
4. Sends one reminder per tenant, not one per charge.

To check what it would do without doing it:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://abnhomes.com.gh/api/cron/rent-run?dryRun=1"
```

---

## Calendar sync

Runs daily at 06:17 UTC on Vercel's Hobby plan, which forbids anything more frequent (a deployment
with an hourly cron is rejected outright). Two directions, and both need doing per unit:

**Publish ours.** Unit page → *Publish this calendar* → copy the URL → paste into Airbnb or
Booking.com. They will block the nights ABN has sold. The feed exposes only that a night is taken —
never the guest, the price, or the booking.

**Import theirs.** Unit page → *Import their calendars* → add feed → paste their iCal URL. Their
bookings then block this calendar.

### The limits, stated plainly

Vercel's Hobby plan runs this once a day. The platforms poll feeds every few hours, so a night sold
on Airbnb can take most of a day to block here, and a direct booking most of a day to block there —
the double-booking window is real. To narrow it, upgrade to Pro, or point a free external scheduler
(cron-job.org is fine) at `/api/cron/ical-sync` hourly with the `Authorization: Bearer $CRON_SECRET`
header. **For a same-day direct booking, still glance at the Airbnb app.**

A failing feed does not silently drop its blocks — existing blocks stay in place and the error
appears on the unit page and in Settings. Check Settings occasionally; a feed that has been failing
for a week is a double booking waiting to happen.

---

## Taking money

| Situation | What to do |
| --- | --- |
| Guest pays by card or mobile money online | Nothing. The gateway confirms and the ledger records it |
| Tenant pays through the portal | Nothing |
| Cash at the desk | Booking → Record a payment. A numbered receipt is issued |
| Bank transfer already received | Record a payment, channel *Bank transfer*, with the reference |
| Cash taken offline | It appears in Money → *Awaiting confirmation* until someone with `money:reconcile` confirms it against the float |

Receipt numbers are sequential per year (`RCT-2026-000042`) and are allocated atomically, so two
clerks taking cash at the same moment cannot be issued the same number.

**Corrections.** Nothing is ever edited. Reverse the entry and post the right one. Both stay
visible, which is the point.

---

## Owner statements

Generate for a closed month from **Owner statements**. Preview first — the dialog shows revenue,
fee, costs and net before anything is written.

Issuing **freezes** the figures and the line detail, and posts two ledger entries: the management
fee ABN earned and the balance now owed to the owner. Reopening a statement from two years ago
shows what the owner was actually sent, not a recalculation against data that has since moved.

Revenue is recognised **when earned**, not when the money arrived. A tenant who paid a year ahead
contributes one month at a time. That is deliberate and it is what makes the figures defensible.

ABN's own buildings have agreements too, at a zero fee, so their statements come out of the same
code path and reconcile the same way.

---

## Access

Roles are in `lib/rbac.ts`. Two things to remember:

- **Scope is per property.** A manager sees their assigned buildings, not the portfolio. Assign
  buildings in the database (`UserPropertyAccess`) — a scoped user with no assignments sees
  nothing, which is the safe default.
- **Finance deliberately cannot change leases or bookings**, and front desk deliberately cannot
  adjust what is owed. If someone needs both, they need two accounts or a role change, not a
  workaround.

---

## Monitoring

Check weekly:

| Where | What you are looking for |
| --- | --- |
| Overview → alerts | SLA breaches, unconfirmed offline payments, failing feeds, arrears |
| Settings → Calendar feeds | Anything marked *Failing* |
| Money → Awaiting confirmation | Cash recorded on a device but never reconciled |
| Settings → Audit trail | Anything you do not recognise |

An unconfirmed payment sitting for days means either a clerk forgot, or cash did not arrive. Both
are worth knowing about quickly.

---

## Backups

Neon and Supabase both take automatic backups; know your retention window and test a restore before
you need one. An untested backup is a hope, not a plan.

Because the ledger is append-only, point-in-time recovery is unusually well-behaved: replaying to a
timestamp gives a coherent financial position rather than a half-applied update.

---

## When something looks wrong

**A balance disagrees with what ABN believes.** Open the party statement. Every line has a date, a
description and a running balance. The discrepancy will be a missing payment, a charge raised
twice (check `runKey`), or an allocation applied to the wrong charge. Do not adjust the balance —
find the entry.

**A tenant shows as in arrears but has paid ahead.** Their credit has not been swept onto the new
charges. Run the rent run, which sweeps as it goes.

**A double booking happened anyway.** Check whether the feed for that unit was failing, and how
long the gap was between the two bookings. If they were minutes apart on the same channel, that is
a bug — the exclusion constraint should have prevented it, so check `npm run db:constraints`
actually ran against this database.

**The rent run raised nothing.** Usually correct: every period due has already been billed. The
preview says so explicitly.
