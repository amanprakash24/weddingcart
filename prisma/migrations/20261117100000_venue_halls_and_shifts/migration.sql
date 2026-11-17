-- Halls and shifts (17 Nov 2026). Additive only: one new type and two new tables. Nothing existing is changed or removed.
-- CreateEnum
CREATE TYPE "VenueShift" AS ENUM ('DAY', 'NIGHT', 'FULL_DAY');

-- CreateTable
CREATE TABLE "venue_spaces" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_slots" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" "VenueShift" NOT NULL,
    "consultationId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venue_spaces_businessId_idx" ON "venue_spaces"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "venue_spaces_businessId_name_key" ON "venue_spaces"("businessId", "name");

-- CreateIndex
CREATE INDEX "venue_slots_businessId_date_idx" ON "venue_slots"("businessId", "date");

-- CreateIndex
CREATE INDEX "venue_slots_spaceId_date_idx" ON "venue_slots"("spaceId", "date");

-- CreateIndex
CREATE INDEX "venue_slots_consultationId_idx" ON "venue_slots"("consultationId");

-- AddForeignKey
ALTER TABLE "venue_spaces" ADD CONSTRAINT "venue_spaces_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_slots" ADD CONSTRAINT "venue_slots_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_slots" ADD CONSTRAINT "venue_slots_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "venue_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_slots" ADD CONSTRAINT "venue_slots_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

