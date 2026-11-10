-- A record of every time a couple's My Wedding login code is set, and who did it (10 Nov 2026). Additive only: one new enum and
-- one new, empty table. Nothing existing is changed. Codes set before today have no record.
CREATE TYPE "LoginCodeEventKind" AS ENUM ('GIVEN', 'REPLACED', 'RESET_ON_WHATSAPP', 'CHANGED_BY_THEMSELVES');

CREATE TABLE "login_code_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "LoginCodeEventKind" NOT NULL,
    "byUserId" TEXT,
    "via" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_code_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_code_events_userId_createdAt_idx" ON "login_code_events"("userId", "createdAt");

ALTER TABLE "login_code_events" ADD CONSTRAINT "login_code_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "login_code_events" ADD CONSTRAINT "login_code_events_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
