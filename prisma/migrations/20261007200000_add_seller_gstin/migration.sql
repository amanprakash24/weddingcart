-- The seller's GST number, frozen on the document (founder, 7 Oct 2026): on a quotation when it is saved, and copied to the invoices
-- made from it. Additive; existing rows stay NULL (no GST number on the document).
ALTER TABLE "quotations" ADD COLUMN     "sellerGstin" TEXT;
ALTER TABLE "invoices" ADD COLUMN     "sellerGstin" TEXT;
