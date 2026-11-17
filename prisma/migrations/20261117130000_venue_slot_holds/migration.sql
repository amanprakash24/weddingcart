-- Holds that expire (17 Nov 2026). Additive only: two nullable columns on venue_slots. Nothing existing is changed.
-- AlterTable
ALTER TABLE "venue_slots" ADD COLUMN     "heldById" TEXT,
ADD COLUMN     "holdUntil" TIMESTAMP(3);

