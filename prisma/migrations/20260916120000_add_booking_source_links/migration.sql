-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "enquiryId" TEXT,
ADD COLUMN     "consultationId" TEXT;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "bookings_enquiryId_idx" ON "bookings"("enquiryId");

-- CreateIndex
CREATE INDEX "bookings_consultationId_idx" ON "bookings"("consultationId");
