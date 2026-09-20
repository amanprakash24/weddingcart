-- Quotation workflow (docs/wedding-os/08-quotation.md). Tracked migration — never apply by hand.
--
-- Safety guard: `quotations` was empty in every environment when this was written
-- (0 rows in staging and production on 20 Sep 2026). The new NOT NULL columns without
-- defaults (quotationNumber, subtotal, total) would fail on existing rows, so fail loudly
-- and early instead of half-applying.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "quotations") THEN
    RAISE EXCEPTION 'quotations is not empty — migrate existing rows before applying add_quotation_workflow';
  END IF;
END $$;
-- AlterEnum
ALTER TYPE "QuotationStatus" ADD VALUE 'SUPERSEDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'QUOTATION_SENT';
ALTER TYPE "ActivityType" ADD VALUE 'QUOTATION_ACCEPTED';
ALTER TYPE "ActivityType" ADD VALUE 'QUOTATION_REJECTED';
ALTER TYPE "ActivityType" ADD VALUE 'QUOTATION_REVISED';
ALTER TYPE "ActivityType" ADD VALUE 'INVOICE_CREATED';

-- DropForeignKey
ALTER TABLE "quotations" DROP CONSTRAINT "quotations_leadId_fkey";

-- DropForeignKey
ALTER TABLE "quotations" DROP CONSTRAINT "quotations_enquiryId_fkey";

-- DropForeignKey
ALTER TABLE "quotations" DROP CONSTRAINT "quotations_consultationId_fkey";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "quotationId" TEXT;

-- AlterTable
ALTER TABLE "quotations" DROP COLUMN "amount",
ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "acceptedById" TEXT,
ADD COLUMN     "acceptedChannel" TEXT,
ADD COLUMN     "acceptedNote" TEXT,
ADD COLUMN     "advanceAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "advanceInvoiceId" TEXT,
ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gstAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gstEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "quotationNumber" TEXT NOT NULL,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "subtotal" INTEGER NOT NULL,
ADD COLUMN     "supersedesId" TEXT,
ADD COLUMN     "terms" TEXT,
ADD COLUMN     "total" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "functionLabel" TEXT,
    "vendorId" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_items_vendorId_idx" ON "quotation_items"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_quotationId_key" ON "bookings"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotationNumber_key" ON "quotations"("quotationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_supersedesId_key" ON "quotations"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_advanceInvoiceId_key" ON "quotations"("advanceInvoiceId");

-- CreateIndex
CREATE INDEX "quotations_leadId_idx" ON "quotations"("leadId");

-- CreateIndex
CREATE INDEX "quotations_enquiryId_idx" ON "quotations"("enquiryId");

-- CreateIndex
CREATE INDEX "quotations_consultationId_idx" ON "quotations"("consultationId");

-- CreateIndex
CREATE INDEX "quotations_status_validUntil_idx" ON "quotations"("status", "validUntil");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_advanceInvoiceId_fkey" FOREIGN KEY ("advanceInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written database guarantees (Prisma cannot express these).
-- ---------------------------------------------------------------------------

-- A quotation belongs to exactly one source (Lead, Enquiry or Consultation).
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_exactly_one_source_chk"
  CHECK (num_nonnulls("leadId", "enquiryId", "consultationId") = 1);

-- At most one OPEN (DRAFT or SENT) quotation per source.
CREATE UNIQUE INDEX "quotations_one_open_per_source_key"
  ON "quotations" (COALESCE("leadId", "enquiryId", "consultationId"))
  WHERE "status" IN ('DRAFT', 'SENT');

-- At most one ACCEPTED quotation per source.
CREATE UNIQUE INDEX "quotations_one_accepted_per_source_key"
  ON "quotations" (COALESCE("leadId", "enquiryId", "consultationId"))
  WHERE "status" = 'ACCEPTED';

-- Money integrity backs up the server-side calculation: the stored total must
-- equal subtotal − discount + gstAmount, and the advance can never exceed it.
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_money_chk"
  CHECK (
    "subtotal" >= 0 AND "discount" >= 0 AND "discount" <= "subtotal"
    AND "gstAmount" >= 0
    AND "total" = "subtotal" - "discount" + "gstAmount"
    AND "advanceAmount" >= 0 AND "advanceAmount" <= "total"
  );

ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_amounts_chk"
  CHECK ("unitPrice" >= 0 AND "quantity" >= 1);
