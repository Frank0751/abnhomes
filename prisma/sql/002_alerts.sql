-- Alerts: telling staff and the boss what is happening.
--
-- Written by hand rather than generated, because this project has no migration
-- history and `prisma db push --accept-data-loss` is willing to DROP a column
-- to make the database match the schema. Every statement here only adds, and
-- every one is idempotent, so running it twice is harmless and running it
-- against the live database cannot destroy anything.
--
-- Apply with:  npx prisma db execute --file prisma/sql/002_alerts.sql --schema prisma/schema.prisma

-- ---------------------------------------------------------------- enums ---

DO $$ BEGIN
  CREATE TYPE "AlertLevel" AS ENUM ('NONE', 'IMPORTANT', 'EVERYTHING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AlertUrgency" AS ENUM ('INSTANT', 'DIGEST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------- who hears about what ---

-- NONE by default: adding a member of staff must never silently start
-- messaging them. Someone has to choose to turn it on.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "alertLevel" "AlertLevel" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "alertEmail" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "alertSms"   BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------- the events ---

CREATE TABLE IF NOT EXISTS "AlertLog" (
  "id"         TEXT NOT NULL,
  "event"      TEXT NOT NULL,
  "urgency"    "AlertUrgency" NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT,
  "link"       TEXT,
  "propertyId" TEXT,
  "metadata"   JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "digestedAt" TIMESTAMP(3),

  CONSTRAINT "AlertLog_pkey" PRIMARY KEY ("id")
);

-- The digest sweep reads exactly this: undigested events, oldest first.
CREATE INDEX IF NOT EXISTS "AlertLog_urgency_digestedAt_idx"
  ON "AlertLog" ("urgency", "digestedAt");

CREATE INDEX IF NOT EXISTS "AlertLog_occurredAt_idx"
  ON "AlertLog" ("occurredAt");

CREATE INDEX IF NOT EXISTS "AlertLog_event_idx"
  ON "AlertLog" ("event");

-- SET NULL rather than CASCADE: a building being removed is no reason to lose
-- the record of what happened while it was there.
DO $$ BEGIN
  ALTER TABLE "AlertLog"
    ADD CONSTRAINT "AlertLog_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
