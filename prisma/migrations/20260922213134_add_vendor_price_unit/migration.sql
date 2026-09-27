-- CreateEnum
CREATE TYPE "VendorPriceUnit" AS ENUM ('PER_PLATE', 'PACKAGE');

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "priceUnit" "VendorPriceUnit";
