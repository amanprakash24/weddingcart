-- PR A (26 Nov 2026): every quotation line knows its function and day; each wedding service keeps what it is.
-- Additive only: new nullable columns, no data changes. Older rows stay null and screens fall back to what they showed before.
ALTER TABLE "quotation_items" ADD COLUMN "eventDate" TIMESTAMP(3);

ALTER TABLE "booking_items" ADD COLUMN "quotationItemId" TEXT;

ALTER TABLE "vendor_bookings"
  ADD COLUMN "quotationItemId" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "serviceCategory" TEXT,
  ADD COLUMN "serviceDate" TIMESTAMP(3),
  ADD COLUMN "quotedPrice" INTEGER,
  ADD COLUMN "discountShare" INTEGER;
