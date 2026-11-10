-- Vivah OS phase 1 (11 Nov 2026): every enquiry, typed once. Additive only — new columns, one new table, then a backfill that only
-- fills the new table and the new column. Nothing existing is changed or removed.

-- A venue's own public enquiry page: /enquire/<enquirySlug>. Null until the team first opens it.
ALTER TABLE "businesses" ADD COLUMN "enquirySlug" TEXT;
CREATE UNIQUE INDEX "businesses_enquirySlug_key" ON "businesses"("enquirySlug");

-- More about each enquiry: how it arrived, which wedding functions, and the client it belongs to.
ALTER TABLE "consultations" ADD COLUMN "clientId" TEXT,
ADD COLUMN "functions" "WeddingEventType"[] DEFAULT ARRAY[]::"WeddingEventType"[],
ADD COLUMN "sourceDetail" TEXT;

-- One client per mobile number per business.
CREATE TABLE "business_clients" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL DEFAULT 'shaadi-shopping',
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_clients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "business_clients_businessId_phone_key" ON "business_clients"("businessId", "phone");
CREATE INDEX "business_clients_businessId_idx" ON "business_clients"("businessId");
CREATE INDEX "consultations_clientId_idx" ON "consultations"("clientId");
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "business_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_clients" ADD CONSTRAINT "business_clients_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: the venues' (VENDOR businesses') existing enquiries get their client — one per business and mobile, named as on the
-- latest enquiry. Shaadi Shopping's own records are left alone (its CRM keeps its capture tables apart). Only well-formed
-- 10-digit mobiles; anything else stays without a client, as before.
INSERT INTO "business_clients" ("id", "businessId", "phone", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."businessId", c."phone", (array_agg(c."name" ORDER BY c."createdAt" DESC))[1], min(c."createdAt"), CURRENT_TIMESTAMP
FROM "consultations" c
JOIN "businesses" b ON b."id" = c."businessId" AND b."kind" = 'VENDOR'
WHERE c."phone" ~ '^[6-9][0-9]{9}$'
GROUP BY c."businessId", c."phone";

UPDATE "consultations" c SET "clientId" = bc."id"
FROM "business_clients" bc
WHERE bc."businessId" = c."businessId" AND bc."phone" = c."phone" AND c."clientId" IS NULL;
