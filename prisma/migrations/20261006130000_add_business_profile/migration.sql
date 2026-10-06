-- The business profile a vendor completes on first sign-in. Additive only: four nullable columns, one new table, one new enum.

-- CreateEnum
CREATE TYPE "BusinessPhotoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "videoUrl" TEXT,
ADD COLUMN     "videoStatus" "BusinessPhotoStatus";

-- CreateTable
CREATE TABLE "business_photos" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "BusinessPhotoStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_photos_businessId_createdAt_idx" ON "business_photos"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "business_photos_status_createdAt_idx" ON "business_photos"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "business_photos" ADD CONSTRAINT "business_photos_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
