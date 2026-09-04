CREATE TYPE "GuestRsvpStatus" AS ENUM ('PENDING', 'ATTENDING', 'NOT_ATTENDING', 'MAYBE');

CREATE TABLE "guests" (
  "id" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "category" TEXT,
  "accompanyingGuests" INTEGER NOT NULL DEFAULT 0,
  "rsvpStatus" "GuestRsvpStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "rsvpToken" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guest_function_responses" (
  "id" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "weddingEventId" TEXT NOT NULL,
  "status" "GuestRsvpStatus" NOT NULL DEFAULT 'PENDING',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "guest_function_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guests_rsvpToken_key" ON "guests"("rsvpToken");
CREATE INDEX "guests_weddingId_rsvpStatus_idx" ON "guests"("weddingId", "rsvpStatus");
CREATE UNIQUE INDEX "guest_function_responses_guestId_weddingEventId_key" ON "guest_function_responses"("guestId", "weddingEventId");
CREATE INDEX "guest_function_responses_weddingEventId_status_idx" ON "guest_function_responses"("weddingEventId", "status");

ALTER TABLE "guests" ADD CONSTRAINT "guests_weddingId_fkey"
  FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guest_function_responses" ADD CONSTRAINT "guest_function_responses_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guest_function_responses" ADD CONSTRAINT "guest_function_responses_weddingEventId_fkey"
  FOREIGN KEY ("weddingEventId") REFERENCES "wedding_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
