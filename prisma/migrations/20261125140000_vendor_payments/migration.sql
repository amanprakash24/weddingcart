-- Each payment Shaadi Shopping makes to a vendor for an assigned work (25 Nov 2026). Additive only: one new table; nothing existing
-- is changed. Append-only by rule (services/vendorPayment.service.ts): rows are voided, never updated in amount or deleted.
CREATE TABLE "vendor_payments" (
    "id" TEXT NOT NULL,
    "vendorBookingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "vendor_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vendor_payments_amount_positive" CHECK ("amount" > 0)
);

CREATE INDEX "vendor_payments_vendorBookingId_idx" ON "vendor_payments"("vendorBookingId");
CREATE INDEX "vendor_payments_vendorId_idx" ON "vendor_payments"("vendorId");

ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendorBookingId_fkey" FOREIGN KEY ("vendorBookingId") REFERENCES "vendor_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
