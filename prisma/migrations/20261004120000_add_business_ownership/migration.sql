-- CreateEnum
CREATE TYPE "BusinessKind" AS ENUM ('PLATFORM', 'VENDOR');

-- CreateEnum
CREATE TYPE "CommercialStatus" AS ENUM ('COMMISSION_PARTNER', 'SAAS', 'BOTH', 'MARKETPLACE_ONLY', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BusinessRole" AS ENUM ('OWNER', 'STAFF');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'shaadi-shopping';

-- AlterTable
ALTER TABLE "enquiries" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'shaadi-shopping';

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'shaadi-shopping';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'shaadi-shopping';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'shaadi-shopping';

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'shaadi-shopping';

-- AlterTable
ALTER TABLE "weddings" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'shaadi-shopping';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'shaadi-shopping';

-- AlterTable
ALTER TABLE "commercial_agreements" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'shaadi-shopping';

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "BusinessKind" NOT NULL,
    "commercialStatus" "CommercialStatus",
    "vendorId" TEXT,
    "numberPrefix" TEXT,
    "upiId" TEXT,
    "upiName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_members" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BusinessRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_vendorId_key" ON "businesses"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_numberPrefix_key" ON "businesses"("numberPrefix");

-- CreateIndex
CREATE INDEX "business_members_userId_idx" ON "business_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "business_members_businessId_userId_key" ON "business_members"("businessId", "userId");

-- CreateIndex
CREATE INDEX "leads_businessId_idx" ON "leads"("businessId");

-- CreateIndex
CREATE INDEX "enquiries_businessId_idx" ON "enquiries"("businessId");

-- CreateIndex
CREATE INDEX "consultations_businessId_idx" ON "consultations"("businessId");

-- CreateIndex
CREATE INDEX "bookings_businessId_idx" ON "bookings"("businessId");

-- CreateIndex
CREATE INDEX "invoices_businessId_idx" ON "invoices"("businessId");

-- CreateIndex
CREATE INDEX "quotations_businessId_idx" ON "quotations"("businessId");

-- CreateIndex
CREATE INDEX "weddings_businessId_idx" ON "weddings"("businessId");

-- CreateIndex
CREATE INDEX "payments_businessId_idx" ON "payments"("businessId");

-- CreateIndex
CREATE INDEX "commercial_agreements_businessId_idx" ON "commercial_agreements"("businessId");

-- The platform business: Shaadi Shopping (BusinessKind PLATFORM). It must exist before the foreign keys below; every existing
-- row already points at it through the column default added above (Phase A, docs/wedding-os/15-record-ownership.md).
INSERT INTO "businesses" ("id", "name", "kind", "updatedAt") VALUES ('shaadi-shopping', 'Shaadi Shopping', 'PLATFORM', CURRENT_TIMESTAMP);

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weddings" ADD CONSTRAINT "weddings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_agreements" ADD CONSTRAINT "commercial_agreements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

