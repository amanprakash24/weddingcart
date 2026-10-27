-- Catering menus (Vivah OS Phase 4, 27 Oct 2026). Additive only: new optional columns, every existing row unchanged.
-- A price-list item of kind CATERING can carry its menu (dishes by course + the extras the business allows) and a food type.
ALTER TABLE "business_offerings" ADD COLUMN "diet" TEXT;
ALTER TABLE "business_offerings" ADD COLUMN "menu" JSONB;

-- What a quotation line includes, frozen when saved (a menu's dish list).
ALTER TABLE "quotation_items" ADD COLUMN "details" TEXT;
