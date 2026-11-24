-- Reviews of Shaadi Shopping itself (24 Nov 2026). Additive only: one new table.
-- CreateTable
CREATE TABLE "platform_reviews" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "phone" TEXT,
    "weddingNumber" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "moderatedAt" TIMESTAMP(3),
    "moderatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_reviews_status_createdAt_idx" ON "platform_reviews"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "platform_reviews" ADD CONSTRAINT "platform_reviews_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

