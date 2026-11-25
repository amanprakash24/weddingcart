-- Pricing model per vendor assignment and frozen vendor work orders (money design v1, PR 4, 25 Nov 2026). Additive only: two enums,
-- two nullable columns, one table and rules. No existing row changes (existing assignments keep a NULL model = commission, as before).

CREATE TYPE "VendorPricingModel" AS ENUM ('COMMISSION', 'FIXED');
CREATE TYPE "WorkOrderStatus" AS ENUM ('ISSUED', 'CANCELLED');

ALTER TABLE "vendor_bookings" ADD COLUMN "pricingModel" "VendorPricingModel";
ALTER TABLE "vendor_bookings" ADD COLUMN "vendorPrice" INTEGER;
-- Never mix the two methods: a fixed price only with the FIXED model, and the FIXED model always with one.
ALTER TABLE "vendor_bookings" ADD CONSTRAINT "vendor_bookings_pricing_consistent" CHECK (
  -- coalesce: with a NULL model the check must still decide (a NULL result would let the row through)
  CASE WHEN coalesce("pricingModel"::text, '') = 'FIXED' THEN "vendorPrice" IS NOT NULL AND "vendorPrice" >= 0 ELSE "vendorPrice" IS NULL END
);

CREATE TABLE "vendor_work_orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "vendorBookingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "pricingModel" "VendorPricingModel" NOT NULL,
    "vendorPayable" INTEGER NOT NULL,
    "clientPrice" INTEGER NOT NULL,
    "commissionRate" DOUBLE PRECISION,
    "commissionAmount" INTEGER,
    "margin" INTEGER NOT NULL,
    "scope" JSONB NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'ISSUED',
    "historical" BOOLEAN NOT NULL DEFAULT false,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "vendor_work_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vendor_work_orders_payable_nonnegative" CHECK ("vendorPayable" >= 0),
    -- the arithmetic of each model, so a wrong figure can never be stored
    CONSTRAINT "vendor_work_orders_model_figures" CHECK (
      ("pricingModel" = 'COMMISSION' AND "commissionRate" IS NOT NULL AND "commissionAmount" IS NOT NULL AND "vendorPayable" = "clientPrice" - "commissionAmount")
      OR ("pricingModel" = 'FIXED' AND "commissionRate" IS NULL AND "commissionAmount" IS NULL)
    ),
    CONSTRAINT "vendor_work_orders_margin" CHECK ("margin" = "clientPrice" - "vendorPayable"),
    CONSTRAINT "vendor_work_orders_cancel_fields" CHECK (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL AND "cancelReason" IS NOT NULL))
);

CREATE UNIQUE INDEX "vendor_work_orders_number_key" ON "vendor_work_orders"("number");
CREATE UNIQUE INDEX "vendor_work_orders_vendorBookingId_key" ON "vendor_work_orders"("vendorBookingId");
CREATE INDEX "vendor_work_orders_vendorId_idx" ON "vendor_work_orders"("vendorId");

ALTER TABLE "vendor_work_orders" ADD CONSTRAINT "vendor_work_orders_vendorBookingId_fkey" FOREIGN KEY ("vendorBookingId") REFERENCES "vendor_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendor_work_orders" ADD CONSTRAINT "vendor_work_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An issued work order is frozen: only ISSUED -> CANCELLED (with who and why) is allowed.
CREATE FUNCTION work_order_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."number" IS DISTINCT FROM OLD."number" OR NEW."vendorBookingId" IS DISTINCT FROM OLD."vendorBookingId"
     OR NEW."vendorId" IS DISTINCT FROM OLD."vendorId" OR NEW."pricingModel" IS DISTINCT FROM OLD."pricingModel"
     OR NEW."vendorPayable" IS DISTINCT FROM OLD."vendorPayable" OR NEW."clientPrice" IS DISTINCT FROM OLD."clientPrice"
     OR NEW."commissionRate" IS DISTINCT FROM OLD."commissionRate" OR NEW."commissionAmount" IS DISTINCT FROM OLD."commissionAmount"
     OR NEW."margin" IS DISTINCT FROM OLD."margin" OR NEW."scope" IS DISTINCT FROM OLD."scope"
     OR NEW."historical" IS DISTINCT FROM OLD."historical" OR NEW."issuedAt" IS DISTINCT FROM OLD."issuedAt"
     OR NEW."issuedById" IS DISTINCT FROM OLD."issuedById" THEN
    RAISE EXCEPTION 'An issued work order cannot be changed (%): use an adjustment or cancel it', OLD."number";
  END IF;
  IF OLD."status" = 'CANCELLED' THEN
    RAISE EXCEPTION 'Work order % is cancelled and cannot change', OLD."number";
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER work_order_frozen BEFORE UPDATE ON "vendor_work_orders" FOR EACH ROW EXECUTE FUNCTION work_order_frozen();

-- While an assignment has an ISSUED work order, its price, model and vendor price are locked (changes come as adjustments).
CREATE FUNCTION vendor_booking_price_locked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."agreedPrice" IS DISTINCT FROM OLD."agreedPrice" OR NEW."pricingModel" IS DISTINCT FROM OLD."pricingModel" OR NEW."vendorPrice" IS DISTINCT FROM OLD."vendorPrice")
     AND EXISTS (SELECT 1 FROM "vendor_work_orders" w WHERE w."vendorBookingId" = NEW."id" AND w."status" = 'ISSUED') THEN
    RAISE EXCEPTION 'This work has an issued work order: its price is locked';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER vendor_booking_price_locked BEFORE UPDATE ON "vendor_bookings" FOR EACH ROW EXECUTE FUNCTION vendor_booking_price_locked();

-- Every work-order change goes into the finance audit log too.
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "vendor_work_orders" FOR EACH ROW EXECUTE FUNCTION finance_audit();
