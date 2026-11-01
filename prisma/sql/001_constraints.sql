-- ABN Homes — invariants Prisma cannot express.
--
-- Run after `prisma db push` or `prisma migrate deploy`:
--     npm run db:constraints
--
-- These are not belt-and-braces. Each one enforces something the application
-- also checks, but only the database can guarantee under concurrency.

-- ---------------------------------------------------------------------------
-- 1. No double bookings. Ever.
-- ---------------------------------------------------------------------------
-- The application checks availability before inserting, but two clerks
-- confirming the same dates in the same second would both pass that check.
-- An exclusion constraint makes the overlap physically impossible: the second
-- INSERT fails, loudly, instead of a guest arriving to an occupied room.
--
-- The range is '[)' — half-open — so a stay ending on the 14th does not
-- collide with one starting on the 14th. Changeover days stay sellable.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS reservation_no_overlap;

ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist (
    "unitId" WITH =,
    daterange("checkIn"::date, "checkOut"::date, '[)') WITH &&
  )
  WHERE (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'));

-- ---------------------------------------------------------------------------
-- 2. The ledger is append-only, enforced by the database.
-- ---------------------------------------------------------------------------
-- Every claim this system makes about financial integrity rests on ledger rows
-- never changing. Application discipline is not enough: one careless
-- `prisma.ledgerEntry.update()` in a future feature would quietly break it.
-- Here, that call raises an error instead.
--
-- To correct an entry, post a REVERSAL that points at it.

CREATE OR REPLACE FUNCTION ledger_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'LedgerEntry is append-only: % is not permitted. Post a reversing entry instead.',
    TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_no_mutation ON "LedgerEntry";

CREATE TRIGGER ledger_no_mutation
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_is_append_only();

-- ---------------------------------------------------------------------------
-- 3. Money is always positive; direction carries the sign.
-- ---------------------------------------------------------------------------
-- A negative debit and a positive credit are the same thing written two ways.
-- Allowing both means every report has to handle both, and one of them will
-- eventually be forgotten.

ALTER TABLE "LedgerEntry" DROP CONSTRAINT IF EXISTS ledger_amount_positive;
ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT ledger_amount_positive CHECK ("amountMinor" > 0);

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS payment_amount_positive;
ALTER TABLE "Payment"
  ADD CONSTRAINT payment_amount_positive CHECK ("amountMinor" > 0);

ALTER TABLE "Charge" DROP CONSTRAINT IF EXISTS charge_amount_positive;
ALTER TABLE "Charge"
  ADD CONSTRAINT charge_amount_positive CHECK ("amountMinor" > 0);

ALTER TABLE "Allocation" DROP CONSTRAINT IF EXISTS allocation_amount_positive;
ALTER TABLE "Allocation"
  ADD CONSTRAINT allocation_amount_positive CHECK ("amountMinor" > 0);

-- ---------------------------------------------------------------------------
-- 4. A stay must have at least one night.
-- ---------------------------------------------------------------------------

ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS reservation_dates_ordered;
ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_dates_ordered CHECK ("checkOut" > "checkIn");

ALTER TABLE "CalendarBlock" DROP CONSTRAINT IF EXISTS block_dates_ordered;
ALTER TABLE "CalendarBlock"
  ADD CONSTRAINT block_dates_ordered CHECK ("endDate" > "startDate");

ALTER TABLE "Lease" DROP CONSTRAINT IF EXISTS lease_dates_ordered;
ALTER TABLE "Lease"
  ADD CONSTRAINT lease_dates_ordered CHECK ("endDate" > "startDate");

-- ---------------------------------------------------------------------------
-- 5. A payment cannot be allocated beyond its own value.
-- ---------------------------------------------------------------------------
-- Enforced as a trigger because it spans rows. Without it, a bug in the
-- allocation sweep could settle more debt than money actually arrived.

CREATE OR REPLACE FUNCTION allocation_within_payment() RETURNS trigger AS $$
DECLARE
  payment_total  integer;
  allocated_total integer;
BEGIN
  SELECT "amountMinor" INTO payment_total
    FROM "Payment" WHERE id = NEW."paymentId";

  SELECT COALESCE(SUM("amountMinor"), 0) INTO allocated_total
    FROM "Allocation"
    WHERE "paymentId" = NEW."paymentId" AND id <> NEW.id;

  IF allocated_total + NEW."amountMinor" > payment_total THEN
    RAISE EXCEPTION
      'Allocation would exceed payment %: % already allocated of %, tried to add %',
      NEW."paymentId", allocated_total, payment_total, NEW."amountMinor";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS allocation_bounds ON "Allocation";

CREATE TRIGGER allocation_bounds
  BEFORE INSERT OR UPDATE ON "Allocation"
  FOR EACH ROW EXECUTE FUNCTION allocation_within_payment();
