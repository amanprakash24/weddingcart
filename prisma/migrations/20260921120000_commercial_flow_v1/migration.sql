-- Commercial flow V1 (docs/wedding-os/09-wedding-v1-model.md + the commercial-flow report). Tracked migration — never apply by hand.
--
--  * PipelineStage.ACCEPTED   — "Accepted / booking pending" (WON now reads "Booked").
--  * InvoiceStatus.PARTIALLY_PAID — some, not all, of the total received.
--  * Invoice.kind / quotationId / bookingId / issuedAt — an invoice belongs to the accepted agreement it came from.
--  * Vendor.defaultTerms      — a venue's default Terms & Conditions (copied into a quotation; never referenced live).
--
-- Additive only: no column is dropped or made stricter, so it is safe on a database that already has rows.

-- AlterEnum (Postgres cannot USE a new enum value in the transaction that adds it, so no backfill below uses either.)
ALTER TYPE "PipelineStage" ADD VALUE 'ACCEPTED';

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_PAID';

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('ADVANCE', 'BALANCE', 'OTHER');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "kind" "InvoiceKind" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "quotationId" TEXT,
ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "issuedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "defaultTerms" TEXT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "invoices_quotationId_idx" ON "invoices"("quotationId");

-- CreateIndex
CREATE INDEX "invoices_bookingId_idx" ON "invoices"("bookingId");

-- At most one ADVANCE and one BALANCE invoice per quotation. (NULL quotationId — every manual invoice — never clashes.)
CREATE UNIQUE INDEX "invoices_quotationId_kind_key" ON "invoices"("quotationId", "kind");

-- Backfill 1: the automatic advance invoices already created from an accepted quotation now say so.
UPDATE "invoices" AS i
SET "quotationId" = q."id",
    "kind" = 'ADVANCE',
    "bookingId" = (SELECT b."id" FROM "bookings" b WHERE b."quotationId" = q."id" LIMIT 1)
FROM "quotations" q
WHERE q."advanceInvoiceId" = i."id";

-- Backfill 2: an invoice that already has a payment link or a payment was, in effect, issued — it was stuck on DRAFT only
-- because nothing ever moved it. (PARTIALLY_PAID cannot be assigned here — see the note at the top — so partly-paid ones
-- become SENT and are corrected the next time a payment is recorded.)
UPDATE "invoices" AS i
SET "status" = 'SENT',
    "issuedAt" = COALESCE(
      (SELECT MIN(l."createdAt") FROM "payment_links" l WHERE l."invoiceId" = i."id"),
      (SELECT MIN(p."paidAt") FROM "payments" p WHERE p."invoiceId" = i."id"),
      i."updatedAt")
WHERE i."status" = 'DRAFT'
  AND (EXISTS (SELECT 1 FROM "payment_links" l WHERE l."invoiceId" = i."id")
    OR EXISTS (SELECT 1 FROM "payments" p WHERE p."invoiceId" = i."id"));

-- Backfill 3: invoices that were already SENT or PAID get an issue date.
UPDATE "invoices" SET "issuedAt" = "updatedAt" WHERE "status" IN ('SENT', 'PAID') AND "issuedAt" IS NULL;
