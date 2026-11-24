-- The couple's checklist and budget (25 Nov 2026). Additive only: three new tables and one nullable column.
-- AlterTable
ALTER TABLE "weddings" ADD COLUMN     "coupleBudget" INTEGER;

-- CreateTable
CREATE TABLE "couple_checklist_items" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" TIMESTAMP(3),
    "weddingEventId" TEXT,
    "templateKey" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couple_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couple_budget_categories" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "planned" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couple_budget_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couple_expenses" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "spentOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couple_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "couple_checklist_items_weddingId_done_idx" ON "couple_checklist_items"("weddingId", "done");

-- CreateIndex
CREATE UNIQUE INDEX "couple_checklist_items_weddingId_templateKey_key" ON "couple_checklist_items"("weddingId", "templateKey");

-- CreateIndex
CREATE UNIQUE INDEX "couple_budget_categories_weddingId_category_key" ON "couple_budget_categories"("weddingId", "category");

-- CreateIndex
CREATE INDEX "couple_expenses_weddingId_idx" ON "couple_expenses"("weddingId");

-- AddForeignKey
ALTER TABLE "couple_checklist_items" ADD CONSTRAINT "couple_checklist_items_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_checklist_items" ADD CONSTRAINT "couple_checklist_items_weddingEventId_fkey" FOREIGN KEY ("weddingEventId") REFERENCES "wedding_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_budget_categories" ADD CONSTRAINT "couple_budget_categories_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couple_expenses" ADD CONSTRAINT "couple_expenses_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

