/*
  Warnings:

  - The `lostReason` column on the `consultations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `lostReason` column on the `enquiries` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `lostReason` column on the `leads` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('BUDGET_ISSUE', 'DATE_UNAVAILABLE', 'CHOSE_COMPETITOR', 'NO_RESPONSE', 'OTHER');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'ASSIGNED';

-- AlterEnum
ALTER TYPE "PipelineStage" ADD VALUE 'ON_HOLD';

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "holdReason" TEXT,
ADD COLUMN     "lostReasonDetail" TEXT,
DROP COLUMN "lostReason",
ADD COLUMN     "lostReason" "LostReason";

-- AlterTable
ALTER TABLE "enquiries" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "holdReason" TEXT,
ADD COLUMN     "lostReasonDetail" TEXT,
DROP COLUMN "lostReason",
ADD COLUMN     "lostReason" "LostReason";

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "holdReason" TEXT,
ADD COLUMN     "lostReasonDetail" TEXT,
DROP COLUMN "lostReason",
ADD COLUMN     "lostReason" "LostReason";

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
