-- CreateEnum
CREATE TYPE "VendorEnquiryStatus" AS ENUM ('PENDING', 'AVAILABLE', 'AVAILABLE_WITH_CONDITIONS', 'NOT_AVAILABLE', 'ALTERNATE_DATE', 'QUOTED', 'WITHDRAWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'VENDOR_ENQUIRY_SENT';
ALTER TYPE "ActivityType" ADD VALUE 'VENDOR_ENQUIRY_ANSWERED';

-- CreateTable
CREATE TABLE "vendor_enquiries" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "leadId" TEXT,
    "enquiryId" TEXT,
    "consultationId" TEXT,
    "quotationId" TEXT,
    "services" TEXT NOT NULL,
    "functions" TEXT,
    "eventDate" TEXT,
    "guestCount" INTEGER,
    "city" TEXT,
    "eventType" TEXT,
    "status" "VendorEnquiryStatus" NOT NULL DEFAULT 'PENDING',
    "responseNote" TEXT,
    "suggestedDate" TEXT,
    "quotedAmount" INTEGER,
    "responseChannel" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_enquiries_vendorId_status_idx" ON "vendor_enquiries"("vendorId", "status");

-- CreateIndex
CREATE INDEX "vendor_enquiries_sourceKey_idx" ON "vendor_enquiries"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_enquiries_vendorId_sourceKey_key" ON "vendor_enquiries"("vendorId", "sourceKey");

-- AddForeignKey
ALTER TABLE "vendor_enquiries" ADD CONSTRAINT "vendor_enquiries_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_enquiries" ADD CONSTRAINT "vendor_enquiries_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_enquiries" ADD CONSTRAINT "vendor_enquiries_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_enquiries" ADD CONSTRAINT "vendor_enquiries_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_enquiries" ADD CONSTRAINT "vendor_enquiries_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_enquiries" ADD CONSTRAINT "vendor_enquiries_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

