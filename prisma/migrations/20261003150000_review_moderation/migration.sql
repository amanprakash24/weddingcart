-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'REVIEW_SUBMITTED';

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedById" TEXT,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "vendorBookingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reviews_vendorBookingId_key" ON "reviews"("vendorBookingId");

-- CreateIndex
CREATE INDEX "reviews_vendorId_status_idx" ON "reviews"("vendorId", "status");

-- CreateIndex
CREATE INDEX "reviews_weddingId_idx" ON "reviews"("weddingId");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_vendorBookingId_fkey" FOREIGN KEY ("vendorBookingId") REFERENCES "vendor_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

