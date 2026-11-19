-- Client OS guest management (approved 19 Nov 2026). Additive only: new optional columns, no data changes.
CREATE TYPE "GuestSide" AS ENUM ('BRIDE', 'GROOM', 'BOTH');

ALTER TABLE "guests"
  ADD COLUMN "side" "GuestSide",
  ADD COLUMN "familyGroup" TEXT,
  ADD COLUMN "relation" TEXT,
  ADD COLUMN "isVip" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pairedGuestId" TEXT;

CREATE UNIQUE INDEX "guests_pairedGuestId_key" ON "guests"("pairedGuestId");
CREATE INDEX "guests_weddingId_side_idx" ON "guests"("weddingId", "side");

ALTER TABLE "guests" ADD CONSTRAINT "guests_pairedGuestId_fkey"
  FOREIGN KEY ("pairedGuestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
