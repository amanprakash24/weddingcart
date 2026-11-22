-- Couple-controlled functions (22 Nov 2026): additive only. Existing functions stay CONFIRMED, not added by a couple.
-- CreateEnum
CREATE TYPE "FunctionConfirmation" AS ENUM ('CONFIRMED', 'WAITING', 'NOT_POSSIBLE');

-- AlterTable
ALTER TABLE "wedding_events" ADD COLUMN     "addedByCouple" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "atBookedVenue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "confirmation" "FunctionConfirmation" NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "confirmationNote" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedById" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "venueSpaceId" TEXT;

-- AddForeignKey
ALTER TABLE "wedding_events" ADD CONSTRAINT "wedding_events_venueSpaceId_fkey" FOREIGN KEY ("venueSpaceId") REFERENCES "venue_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

