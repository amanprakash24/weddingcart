-- A quotation whose client link exists and WhatsApp was opened, waiting for staff to confirm it was sent.
-- Kept in its own migration: Postgres cannot use a new enum value in the same transaction that adds it.
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'READY_TO_SHARE' AFTER 'DRAFT';
