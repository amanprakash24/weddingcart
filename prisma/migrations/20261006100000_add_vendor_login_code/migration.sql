-- AlterTable: the vendor login code (hash only) and when it was last set. Additive; existing rows stay NULL (no code yet).
ALTER TABLE "vendor_profiles" ADD COLUMN     "loginCodeHash" TEXT,
ADD COLUMN     "loginCodeSetAt" TIMESTAMP(3);
