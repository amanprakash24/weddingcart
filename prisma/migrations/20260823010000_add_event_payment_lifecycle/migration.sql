ALTER TYPE "EventOrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_SUCCESS';
ALTER TYPE "EventOrderStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';

ALTER TABLE "event_orders"
    ADD COLUMN "passTypeId" TEXT,
    ADD COLUMN "quantity" INTEGER,
    ADD COLUMN "razorpayPaymentLinkId" TEXT,
    ADD COLUMN "razorpayPaymentId" TEXT,
    ADD COLUMN "paidAt" TIMESTAMP(3),
    ADD COLUMN "confirmedAt" TIMESTAMP(3);

UPDATE "event_orders"
SET "passTypeId" = (
      SELECT "passTypeId" FROM "event_tickets"
      WHERE "event_tickets"."orderId" = "event_orders"."id"
      ORDER BY "event_tickets"."createdAt" ASC
      LIMIT 1
    ),
    "quantity" = (
      SELECT COUNT(*)::INTEGER FROM "event_tickets"
      WHERE "event_tickets"."orderId" = "event_orders"."id"
    )
WHERE "passTypeId" IS NULL;

ALTER TABLE "event_orders"
    ALTER COLUMN "passTypeId" SET NOT NULL,
    ALTER COLUMN "quantity" SET NOT NULL;

ALTER TABLE "event_orders"
    ADD CONSTRAINT "event_orders_passTypeId_fkey"
    FOREIGN KEY ("passTypeId") REFERENCES "event_pass_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "event_orders_razorpayPaymentLinkId_key" ON "event_orders"("razorpayPaymentLinkId");
CREATE UNIQUE INDEX "event_orders_razorpayPaymentId_key" ON "event_orders"("razorpayPaymentId");

CREATE TABLE "event_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_webhook_events_eventId_key" ON "event_webhook_events"("eventId");
