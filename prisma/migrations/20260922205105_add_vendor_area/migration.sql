-- Prisma's auto-generated diff also proposed DROP INDEX "approval_requests_weddingEventId_idx" and
-- "approval_requests_weddingId_idx" — the same pre-existing drift already flagged and excluded in
-- 20260922114814_add_vendor_capability and 20260922200343_add_vendor_prospect (schema.prisma has no
-- @@index on those ApprovalRequest fields, but migration 20260825000000_add_client_approvals created
-- them). Excluded again for the same reason — this is now the third time; worth fixing as its own
-- explicit decision rather than re-excluding a fourth time.

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "area" TEXT;
