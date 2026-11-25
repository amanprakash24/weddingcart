-- The couple's checklist (25 Nov 2026): remember when the couple chose an item's date themselves, so a ready-made item's date
-- follows the wedding day when it moves, but never overrides a date the couple set. Additive only: one column with a default.
ALTER TABLE "couple_checklist_items" ADD COLUMN "customDate" BOOLEAN NOT NULL DEFAULT false;
