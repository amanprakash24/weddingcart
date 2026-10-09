-- The business's price list becomes one catalog sorted by kind (7 Oct 2026). Additive: every existing row keeps its function, name
-- and price. A per-plate row is food; anything else waits under "Other" until the business sorts it.

-- CreateEnum
CREATE TYPE "OfferingKind" AS ENUM ('RENTAL', 'CATERING', 'DECORATION', 'SERVICE', 'PACKAGE', 'OTHER');

-- AlterTable
ALTER TABLE "business_offerings" ADD COLUMN     "kind" "OfferingKind" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sourcePackageId" TEXT,
ALTER COLUMN "function" DROP NOT NULL;

-- Existing rows: priced per plate = food.
UPDATE "business_offerings" SET "kind" = 'CATERING' WHERE "perPlate" = true;

-- CreateIndex
CREATE INDEX "business_offerings_businessId_kind_idx" ON "business_offerings"("businessId", "kind");

-- AddForeignKey
ALTER TABLE "business_offerings" ADD CONSTRAINT "business_offerings_sourcePackageId_fkey" FOREIGN KEY ("sourcePackageId") REFERENCES "vendor_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
