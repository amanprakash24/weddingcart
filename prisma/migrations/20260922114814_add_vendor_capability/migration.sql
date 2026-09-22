-- VendorCapability (docs/wedding-os/11-vivah-os-ux-architecture.md §16) — additive only. Which wedding
-- functions a vendor can serve, captured at onboarding (VendorApplication.capabilities) and copied onto
-- real VendorCapability rows on approval. No matching/quotation/assignment logic reads this yet.
--
-- Prisma's auto-generated diff also proposed DROP INDEX "approval_requests_weddingEventId_idx" and
-- "approval_requests_weddingId_idx" — pre-existing drift between schema.prisma (no @@index on those
-- ApprovalRequest fields today) and migration 20260825000000_add_client_approvals (which created them),
-- unrelated to this change and predating this session. Deliberately excluded from this migration so it
-- stays scoped to VendorCapability only; flagged separately for a decision, not silently dropped or fixed.

-- AlterTable
ALTER TABLE "vendor_applications" ADD COLUMN     "capabilities" "WeddingEventType"[] DEFAULT ARRAY[]::"WeddingEventType"[];

-- CreateTable
CREATE TABLE "vendor_capabilities" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "function" "WeddingEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_capabilities_vendorId_function_key" ON "vendor_capabilities"("vendorId", "function");

-- AddForeignKey
ALTER TABLE "vendor_capabilities" ADD CONSTRAINT "vendor_capabilities_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
