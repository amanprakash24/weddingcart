-- CreateEnum
CREATE TYPE "InsightGeneratedBy" AS ENUM ('AI', 'HUMAN');

-- CreateTable
CREATE TABLE "lead_insights" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "enquiryId" TEXT,
    "consultationId" TEXT,
    "generatedBy" "InsightGeneratedBy" NOT NULL,
    "summary" TEXT NOT NULL,
    "nextAction" TEXT,
    "sentiment" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_insights_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lead_insights" ADD CONSTRAINT "lead_insights_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_insights" ADD CONSTRAINT "lead_insights_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_insights" ADD CONSTRAINT "lead_insights_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
