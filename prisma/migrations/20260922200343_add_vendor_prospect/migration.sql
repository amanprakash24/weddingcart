-- CreateEnum
CREATE TYPE "VendorProspectStatus" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'ONBOARDING', 'ONBOARDED', 'DECLINED', 'ALREADY_LISTED');

-- Prisma's auto-generated diff also proposed DROP INDEX "approval_requests_weddingEventId_idx" and
-- "approval_requests_weddingId_idx" — the same pre-existing drift already flagged and excluded in
-- 20260922114814_add_vendor_capability/migration.sql (schema.prisma has no @@index on those
-- ApprovalRequest fields, but migration 20260825000000_add_client_approvals created them). Unrelated to
-- this change, excluded again for the same reason: stay scoped, don't silently drop indexes in flight.

-- CreateTable
CREATE TABLE "vendor_prospects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "fullAddress" TEXT,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "contactPerson" TEXT,
    "seatingCapacity" INTEGER,
    "maxCapacity" INTEGER,
    "priceVegPerPlate" INTEGER,
    "priceNonVegPerPlate" INTEGER,
    "venueType" TEXT,
    "status" "VendorProspectStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_prospects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_prospects_status_idx" ON "vendor_prospects"("status");

-- CreateIndex
CREATE INDEX "vendor_prospects_phone_idx" ON "vendor_prospects"("phone");
