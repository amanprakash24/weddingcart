CREATE TABLE "consultation_vendor_selections" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "categoryId" TEXT,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_vendor_selections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consultation_vendor_selections_consultationId_serviceKey_key"
ON "consultation_vendor_selections"("consultationId", "serviceKey");

CREATE INDEX "consultation_vendor_selections_vendorId_idx"
ON "consultation_vendor_selections"("vendorId");

CREATE INDEX "consultation_vendor_selections_categoryId_idx"
ON "consultation_vendor_selections"("categoryId");

ALTER TABLE "consultation_vendor_selections"
ADD CONSTRAINT "consultation_vendor_selections_consultationId_fkey"
FOREIGN KEY ("consultationId") REFERENCES "consultations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "consultation_vendor_selections"
ADD CONSTRAINT "consultation_vendor_selections_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "consultation_vendor_selections"
ADD CONSTRAINT "consultation_vendor_selections_vendorId_fkey"
FOREIGN KEY ("vendorId") REFERENCES "vendors"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
