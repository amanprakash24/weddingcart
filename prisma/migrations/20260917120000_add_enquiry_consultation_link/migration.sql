-- AlterTable
ALTER TABLE "enquiries" ADD COLUMN     "consultationId" TEXT;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "enquiries_consultationId_idx" ON "enquiries"("consultationId");
