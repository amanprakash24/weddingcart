-- Family access (23 Nov 2026): additive only (one new table, one enum).
-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('FULL', 'PLANNING', 'VIEW');

-- CreateTable
CREATE TABLE "wedding_members" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT,
    "role" "FamilyRole" NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wedding_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wedding_members_userId_idx" ON "wedding_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wedding_members_weddingId_userId_key" ON "wedding_members"("weddingId", "userId");

-- AddForeignKey
ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

