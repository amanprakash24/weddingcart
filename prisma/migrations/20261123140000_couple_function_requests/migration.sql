-- Couple function change requests + one vendor enquiry for several functions (23 Nov 2026). Additive; existing links are copied.
-- AlterTable
ALTER TABLE "wedding_events" ADD COLUMN     "pendingChange" JSONB;

-- CreateTable
CREATE TABLE "vendor_quote_functions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "weddingEventId" TEXT NOT NULL,

    CONSTRAINT "vendor_quote_functions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_quote_functions_weddingEventId_idx" ON "vendor_quote_functions"("weddingEventId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_quote_functions_requestId_weddingEventId_key" ON "vendor_quote_functions"("requestId", "weddingEventId");

-- AddForeignKey
ALTER TABLE "vendor_quote_functions" ADD CONSTRAINT "vendor_quote_functions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "vendor_quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quote_functions" ADD CONSTRAINT "vendor_quote_functions_weddingEventId_fkey" FOREIGN KEY ("weddingEventId") REFERENCES "wedding_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Keep every existing enquiry linked to the function it already names.
INSERT INTO "vendor_quote_functions" ("id", "requestId", "weddingEventId")
SELECT gen_random_uuid()::text, "id", "weddingEventId" FROM "vendor_quote_requests" WHERE "weddingEventId" IS NOT NULL;
