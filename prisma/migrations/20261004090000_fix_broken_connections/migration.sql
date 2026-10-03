-- AlterTable
ALTER TABLE "weddings" ADD COLUMN     "customerPhone" TEXT;

-- AlterTable
ALTER TABLE "partner_referrals" ADD COLUMN     "consultationId" TEXT,
ADD COLUMN     "vendorProspectId" TEXT;

-- CreateIndex
CREATE INDEX "weddings_customerPhone_idx" ON "weddings"("customerPhone");

-- CreateIndex
CREATE UNIQUE INDEX "partner_referrals_consultationId_key" ON "partner_referrals"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_referrals_vendorProspectId_key" ON "partner_referrals"("vendorProspectId");

-- AddForeignKey
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_vendorProspectId_fkey" FOREIGN KEY ("vendorProspectId") REFERENCES "vendor_prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

