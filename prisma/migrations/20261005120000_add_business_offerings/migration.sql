-- CreateTable
CREATE TABLE "business_offerings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "function" "WeddingEventType" NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "perPlate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_offerings_businessId_function_idx" ON "business_offerings"("businessId", "function");

-- AddForeignKey
ALTER TABLE "business_offerings" ADD CONSTRAINT "business_offerings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
