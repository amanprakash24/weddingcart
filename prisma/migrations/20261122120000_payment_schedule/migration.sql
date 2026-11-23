-- Payment schedule (22 Nov 2026): the agreement's balance split into dated instalments set by staff. Additive only.
-- AlterTable
ALTER TABLE "commercial_agreements" ADD COLUMN     "scheduleVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payment_instalments" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_instalments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_instalments_agreementId_sortOrder_key" ON "payment_instalments"("agreementId", "sortOrder");

-- AddForeignKey
ALTER TABLE "payment_instalments" ADD CONSTRAINT "payment_instalments_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "commercial_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- An instalment is always a positive whole-rupee amount (the service also checks the instalments add up to the balance exactly).
ALTER TABLE "payment_instalments" ADD CONSTRAINT "payment_instalments_amount_positive" CHECK ("amount" > 0);
