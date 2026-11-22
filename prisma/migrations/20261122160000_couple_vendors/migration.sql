-- Couple vendors and quote requests (22 Nov 2026, Client OS): additive only (two new tables, one enum).
-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('REQUESTED', 'QUOTED', 'NOT_AVAILABLE', 'BOOKED', 'CLOSED');

-- CreateTable
CREATE TABLE "couple_vendors" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "weddingEventId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "phone" TEXT,
    "price" INTEGER,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couple_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_quote_requests" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "weddingEventId" TEXT,
    "note" TEXT,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "staffNote" TEXT,
    "requestedById" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "couple_vendors_weddingId_idx" ON "couple_vendors"("weddingId");

-- CreateIndex
CREATE INDEX "vendor_quote_requests_status_idx" ON "vendor_quote_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_quote_requests_weddingId_vendorId_key" ON "vendor_quote_requests"("weddingId", "vendorId");

-- AddForeignKey
ALTER TABLE "couple_vendors" ADD CONSTRAINT "couple_vendors_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_vendors" ADD CONSTRAINT "couple_vendors_weddingEventId_fkey" FOREIGN KEY ("weddingEventId") REFERENCES "wedding_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quote_requests" ADD CONSTRAINT "vendor_quote_requests_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quote_requests" ADD CONSTRAINT "vendor_quote_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quote_requests" ADD CONSTRAINT "vendor_quote_requests_weddingEventId_fkey" FOREIGN KEY ("weddingEventId") REFERENCES "wedding_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

