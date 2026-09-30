-- CreateEnum
CREATE TYPE "GrowthPartnerStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PartnerReferralType" AS ENUM ('VENUE', 'VENDOR', 'CLIENT', 'EVENT');

-- CreateEnum
CREATE TYPE "PartnerReferralStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'CONTACTED', 'IN_DISCUSSION', 'CONVERTED', 'COMPLETED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "PartnerPayoutStatus" AS ENUM ('NOT_DUE', 'DUE', 'PAID');

-- CreateTable
CREATE TABLE "growth_partners" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "city" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "referralTypes" TEXT[],
    "networkNote" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" "GrowthPartnerStatus" NOT NULL DEFAULT 'NEW',
    "staffNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_referrals" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "type" "PartnerReferralType" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "requirement" TEXT,
    "notes" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" "PartnerReferralStatus" NOT NULL DEFAULT 'SUBMITTED',
    "assignedToId" TEXT,
    "completedAt" TIMESTAMP(3),
    "payoutStatus" "PartnerPayoutStatus" NOT NULL DEFAULT 'NOT_DUE',
    "payoutAmount" INTEGER,
    "paidAt" TIMESTAMP(3),
    "staffNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "growth_partners_code_key" ON "growth_partners"("code");

-- CreateIndex
CREATE UNIQUE INDEX "growth_partners_phone_key" ON "growth_partners"("phone");

-- CreateIndex
CREATE INDEX "growth_partners_status_idx" ON "growth_partners"("status");

-- CreateIndex
CREATE INDEX "growth_partners_city_idx" ON "growth_partners"("city");

-- CreateIndex
CREATE INDEX "partner_referrals_partnerId_idx" ON "partner_referrals"("partnerId");

-- CreateIndex
CREATE INDEX "partner_referrals_status_idx" ON "partner_referrals"("status");

-- CreateIndex
CREATE INDEX "partner_referrals_type_idx" ON "partner_referrals"("type");

-- AddForeignKey
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "growth_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

