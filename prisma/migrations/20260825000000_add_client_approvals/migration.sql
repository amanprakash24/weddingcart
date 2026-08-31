-- Additive Client Approval Workflow V1 migration.
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'APPROVAL_REQUESTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'APPROVAL_APPROVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'APPROVAL_CHANGES_REQUESTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'APPROVAL_CANCELLED';

ALTER TYPE "ApprovalSubjectType" ADD VALUE IF NOT EXISTS 'SERVICE_SELECTION';
ALTER TYPE "ApprovalSubjectType" ADD VALUE IF NOT EXISTS 'DECORATION';
ALTER TYPE "ApprovalSubjectType" ADD VALUE IF NOT EXISTS 'MENU';
ALTER TYPE "ApprovalSubjectType" ADD VALUE IF NOT EXISTS 'DESIGN';
ALTER TYPE "ApprovalSubjectType" ADD VALUE IF NOT EXISTS 'QUOTATION';
ALTER TYPE "ApprovalSubjectType" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TYPE "ApprovalStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "ApprovalStatus" ADD VALUE IF NOT EXISTS 'PENDING_CLIENT';
ALTER TYPE "ApprovalStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
ALTER TYPE "ApprovalStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "approval_requests"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "amount" INTEGER,
  ADD COLUMN "deadline" TIMESTAMP(3),
  ADD COLUMN "weddingId" TEXT,
  ADD COLUMN "weddingEventId" TEXT,
  ADD COLUMN "clientComment" TEXT;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "approval_requests_weddingEventId_fkey"
    FOREIGN KEY ("weddingEventId") REFERENCES "wedding_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "approval_requests_weddingId_idx" ON "approval_requests"("weddingId");
CREATE INDEX "approval_requests_weddingEventId_idx" ON "approval_requests"("weddingEventId");
