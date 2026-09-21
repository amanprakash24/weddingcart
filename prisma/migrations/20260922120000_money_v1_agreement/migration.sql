-- Money v1 (25% confirmation rule). Tracked migration — never apply by hand.
--
--  * commercial_agreements — the frozen commercial terms of an accepted quotation (total, the rule it was made under, the exact
--    confirmation amount, accepted items / terms, and the hold window). No money that moves is stored here.
--  * payments.reference / recordedById / receiptId / idempotencyKey — who recorded a payment, its UTR, the split of one receipt across
--    invoices, and a unique key so a double-submitted form is a no-op.
--
-- Additive only: no column is dropped or made stricter, and nothing existing is rewritten (no backfill — historical records keep the
-- behaviour they were made with).

-- CreateTable
CREATE TABLE "commercial_agreements" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "quotationRevision" INTEGER NOT NULL,
    "bookingId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "agreementTotal" INTEGER NOT NULL,
    "confirmationPercent" INTEGER NOT NULL,
    "confirmationAmount" INTEGER NOT NULL,
    "confirmationRounding" TEXT NOT NULL,
    "holdWindowDays" INTEGER NOT NULL,
    "termsSnapshot" TEXT,
    "itemsSnapshot" JSONB NOT NULL,
    "functionLabels" JSONB NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "holdStartedAt" TIMESTAMP(3),
    "holdExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commercial_agreements_quotationId_key" ON "commercial_agreements"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_agreements_bookingId_key" ON "commercial_agreements"("bookingId");

-- AddForeignKey
ALTER TABLE "commercial_agreements" ADD CONSTRAINT "commercial_agreements_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_agreements" ADD CONSTRAINT "commercial_agreements_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "reference" TEXT,
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "receiptId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_receiptId_idx" ON "payments"("receiptId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
