-- At most one OPEN quotation per source: a quotation that is ready to share is still open.
DROP INDEX IF EXISTS "quotations_one_open_per_source_key";
CREATE UNIQUE INDEX "quotations_one_open_per_source_key"
  ON "quotations" (COALESCE("leadId", "enquiryId", "consultationId"))
  WHERE "status" IN ('DRAFT', 'READY_TO_SHARE', 'SENT');
