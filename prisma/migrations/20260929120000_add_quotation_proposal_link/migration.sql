-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'QUOTATION_CHANGES_REQUESTED';
ALTER TYPE "ActivityType" ADD VALUE 'PROPOSAL_VIEWED';

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "changesRequestNote" TEXT,
ADD COLUMN     "changesRequestedAt" TIMESTAMP(3),
ADD COLUMN     "customerTokenCreatedAt" TIMESTAMP(3),
ADD COLUMN     "customerTokenHash" TEXT,
ADD COLUMN     "customerViewedAt" TIMESTAMP(3),
ADD COLUMN     "exclusions" TEXT,
ADD COLUMN     "inclusions" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "quotations_customerTokenHash_key" ON "quotations"("customerTokenHash");

