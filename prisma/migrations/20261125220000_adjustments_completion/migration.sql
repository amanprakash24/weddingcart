-- Adjustments, completion and the final-payment hold (money design v1, PR 6, 25 Nov 2026). Additive only: an enum, a table, nullable
-- columns and rules. No existing row changes.

CREATE TYPE "AdjustmentKind" AS ENUM ('INCREASE', 'DECREASE', 'EXTRA_WORK', 'CANCELLATION');

CREATE TABLE "work_order_adjustments" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "kind" "AdjustmentKind" NOT NULL,
    "payableDelta" INTEGER NOT NULL,
    "clientPriceDelta" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_adjustments_pkey" PRIMARY KEY ("id"),
    -- the sign follows the kind: increases and extra work add, decreases and cancellations take away
    CONSTRAINT "work_order_adjustments_sign" CHECK (
      ("kind" IN ('INCREASE', 'EXTRA_WORK') AND "payableDelta" > 0) OR ("kind" IN ('DECREASE', 'CANCELLATION') AND "payableDelta" < 0)
    ),
    CONSTRAINT "work_order_adjustments_reason" CHECK (length(btrim("reason")) >= 3)
);
CREATE INDEX "work_order_adjustments_workOrderId_idx" ON "work_order_adjustments"("workOrderId");
ALTER TABLE "work_order_adjustments" ADD CONSTRAINT "work_order_adjustments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "vendor_work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only: an adjustment is never changed (a wrong one is answered by another adjustment).
CREATE FUNCTION work_order_adjustment_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'An adjustment cannot be changed: add another adjustment instead';
END;
$$;
CREATE TRIGGER work_order_adjustment_frozen BEFORE UPDATE ON "work_order_adjustments" FOR EACH ROW EXECUTE FUNCTION work_order_adjustment_frozen();

-- Only on an ISSUED work order, and never below what the vendor was already paid (payments not voided + an older payout marked PAID).
CREATE FUNCTION work_order_adjustment_floor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  wo RECORD;
  payable_after INTEGER;
  paid INTEGER;
BEGIN
  SELECT * INTO wo FROM "vendor_work_orders" WHERE "id" = NEW."workOrderId";
  IF wo."status" <> 'ISSUED' THEN
    RAISE EXCEPTION 'Work order % is cancelled: it cannot be adjusted', wo."number";
  END IF;
  SELECT wo."vendorPayable" + coalesce(sum(a."payableDelta"), 0) + NEW."payableDelta" INTO payable_after
    FROM "work_order_adjustments" a WHERE a."workOrderId" = NEW."workOrderId";
  SELECT coalesce((SELECT sum(p."amount") FROM "vendor_payments" p WHERE p."vendorBookingId" = wo."vendorBookingId" AND p."voidedAt" IS NULL), 0)
       + coalesce((SELECT sum(o."netAmount") FROM "payouts" o WHERE o."vendorBookingId" = wo."vendorBookingId" AND o."status" = 'PAID'), 0)
    INTO paid;
  IF payable_after < paid THEN
    RAISE EXCEPTION 'This adjustment would take the vendor amount (%) below what was already paid (%)', payable_after, paid;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER work_order_adjustment_floor BEFORE INSERT ON "work_order_adjustments" FOR EACH ROW EXECUTE FUNCTION work_order_adjustment_floor();

CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "work_order_adjustments" FOR EACH ROW EXECUTE FUNCTION finance_audit();

ALTER TABLE "vendor_bookings" ADD COLUMN "vendorDoneAt" TIMESTAMP(3);
ALTER TABLE "vendor_bookings" ADD COLUMN "vendorDoneNote" TEXT;
ALTER TABLE "vendor_bookings" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "vendor_bookings" ADD COLUMN "verifiedById" TEXT;

ALTER TABLE "vendor_payments" ADD COLUMN "finalOverrideReason" TEXT;
ALTER TABLE "vendor_payments" ADD COLUMN "finalOverrideById" TEXT;
