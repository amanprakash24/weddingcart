CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED');
CREATE TYPE "EventPassTypeStatus" AS ENUM ('ACTIVE', 'HIDDEN');
CREATE TYPE "EventOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');
CREATE TYPE "EventTicketStatus" AS ENUM ('ACTIVE', 'CHECKED_IN', 'CANCELLED');

CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "venueName" TEXT NOT NULL,
    "venueAddress" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_pass_types" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "peopleIncluded" INTEGER NOT NULL DEFAULT 1,
    "foodIncluded" BOOLEAN NOT NULL DEFAULT false,
    "salesLimit" INTEGER,
    "status" "EventPassTypeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "event_pass_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_orders" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "EventOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentProvider" TEXT,
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "event_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_tickets" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "passTypeId" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "attendeeName" TEXT,
    "attendeePhone" TEXT,
    "checkInStatus" "EventTicketStatus" NOT NULL DEFAULT 'ACTIVE',
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");
CREATE UNIQUE INDEX "event_pass_types_eventId_name_key" ON "event_pass_types"("eventId", "name");
CREATE UNIQUE INDEX "event_tickets_ticketCode_key" ON "event_tickets"("ticketCode");
CREATE UNIQUE INDEX "event_tickets_qrCode_key" ON "event_tickets"("qrCode");

ALTER TABLE "event_pass_types"
    ADD CONSTRAINT "event_pass_types_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_orders"
    ADD CONSTRAINT "event_orders_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_tickets"
    ADD CONSTRAINT "event_tickets_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_tickets"
    ADD CONSTRAINT "event_tickets_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "event_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_tickets"
    ADD CONSTRAINT "event_tickets_passTypeId_fkey"
    FOREIGN KEY ("passTypeId") REFERENCES "event_pass_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
