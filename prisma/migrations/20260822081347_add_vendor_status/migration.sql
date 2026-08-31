-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'PUBLISHED');

-- DropIndex
DROP INDEX "vendors_categoryId_city_rating_idx";

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "status" "VendorStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill: every vendor that existed before this migration is already live
-- on the public site today. Leaving them at the column default (DRAFT)
-- would instantly delist all of them from /api/vendors, public pages, and
-- the sitemap the moment this migration runs — a real traffic-loss outage.
-- New vendors created after this migration still default to DRAFT via the
-- column default above; this UPDATE only affects pre-existing rows.
UPDATE "vendors" SET "status" = 'PUBLISHED';

-- CreateIndex
CREATE INDEX "vendors_categoryId_city_status_rating_idx" ON "vendors"("categoryId", "city", "status", "rating");
