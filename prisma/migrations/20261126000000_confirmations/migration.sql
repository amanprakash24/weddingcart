-- Confirmations of chosen services (money design v1, PR 8a, 26 Nov 2026). Additive: two tables, nullable columns and rules.
-- Two "one per quotation" rules (agreement; advance/balance invoice) become "one per confirmation", and stay "one per quotation" for
-- records with no confirmation — every existing row has none, so for them nothing changes. No existing value is changed.

CREATE TYPE "ConfirmationStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

CREATE TABLE "confirmations" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "quotationRevision" INTEGER NOT NULL,
    "status" "ConfirmationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "channel" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" TEXT,
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL,
    "taxable" INTEGER NOT NULL,
    "gst" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "confirmationPercent" INTEGER NOT NULL,
    "advance" INTEGER NOT NULL,
    "weddingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" TEXT NOT NULL DEFAULT 'shaadi-shopping',

    CONSTRAINT "confirmations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "confirmations_money" CHECK (
      "subtotal" >= 0 AND "discount" >= 0 AND "gst" >= 0 AND "taxable" = "subtotal" - "discount" AND "total" > 0
      AND "advance" > 0 AND "advance" <= "total"
    )
);
CREATE UNIQUE INDEX "confirmations_number_key" ON "confirmations"("number");
CREATE INDEX "confirmations_quotationId_idx" ON "confirmations"("quotationId");
CREATE INDEX "confirmations_businessId_idx" ON "confirmations"("businessId");
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "confirmation_lines" (
    "id" TEXT NOT NULL,
    "confirmationId" TEXT NOT NULL,
    "quotationItemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "functionLabel" TEXT,
    "vendorId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "discountShare" INTEGER NOT NULL,
    "taxable" INTEGER NOT NULL,
    "gstRateBp" INTEGER,
    "gst" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "live" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "confirmation_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "confirmation_lines_money" CHECK ("amount" = "quantity" * "unitPrice" AND "taxable" = "amount" - "discountShare" AND "total" = "taxable" + "gst")
);
CREATE INDEX "confirmation_lines_confirmationId_idx" ON "confirmation_lines"("confirmationId");
-- A quotation line is in at most one live confirmation: it can never be confirmed (and billed) twice.
CREATE UNIQUE INDEX "confirmation_lines_one_live_per_item" ON "confirmation_lines"("quotationItemId") WHERE "live";
ALTER TABLE "confirmation_lines" ADD CONSTRAINT "confirmation_lines_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "confirmations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Frozen: a confirmation only moves CONFIRMED → CANCELLED and gains its wedding once; a line only stops being live.
CREATE FUNCTION confirmation_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."number", NEW."quotationId", NEW."quotationRevision", NEW."channel", NEW."confirmedAt", NEW."confirmedById", NEW."subtotal", NEW."discount",
      NEW."taxable", NEW."gst", NEW."total", NEW."confirmationPercent", NEW."advance", NEW."businessId")
     IS DISTINCT FROM
     (OLD."number", OLD."quotationId", OLD."quotationRevision", OLD."channel", OLD."confirmedAt", OLD."confirmedById", OLD."subtotal", OLD."discount",
      OLD."taxable", OLD."gst", OLD."total", OLD."confirmationPercent", OLD."advance", OLD."businessId") THEN
    RAISE EXCEPTION 'Confirmation % is frozen: its figures cannot be changed', OLD."number";
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (OLD."status" = 'CONFIRMED' AND NEW."status" = 'CANCELLED') THEN
    RAISE EXCEPTION 'Confirmation % cannot go from % to %', OLD."number", OLD."status", NEW."status";
  END IF;
  IF OLD."weddingId" IS NOT NULL AND NEW."weddingId" IS DISTINCT FROM OLD."weddingId" THEN
    RAISE EXCEPTION 'Confirmation % already belongs to a wedding', OLD."number";
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER confirmation_frozen BEFORE UPDATE ON "confirmations" FOR EACH ROW EXECUTE FUNCTION confirmation_frozen();

CREATE FUNCTION confirmation_line_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'live') IS DISTINCT FROM (to_jsonb(OLD) - 'live') OR (NEW."live" AND NOT OLD."live") THEN
    RAISE EXCEPTION 'A confirmed line is frozen';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER confirmation_line_frozen BEFORE UPDATE ON "confirmation_lines" FOR EACH ROW EXECUTE FUNCTION confirmation_line_frozen();

-- Agreements: one per confirmation; one per quotation for an agreement with no confirmation (every existing one).
ALTER TABLE "commercial_agreements" ADD COLUMN "confirmationId" TEXT;
DROP INDEX "commercial_agreements_quotationId_key";
CREATE INDEX "commercial_agreements_quotationId_idx" ON "commercial_agreements"("quotationId");
CREATE UNIQUE INDEX "commercial_agreements_confirmationId_key" ON "commercial_agreements"("confirmationId");
CREATE UNIQUE INDEX "commercial_agreements_one_whole_per_quotation" ON "commercial_agreements"("quotationId") WHERE "confirmationId" IS NULL;
ALTER TABLE "commercial_agreements" ADD CONSTRAINT "commercial_agreements_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "confirmations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invoices: one advance and one balance per confirmation; per quotation for invoices with no confirmation (every existing one).
ALTER TABLE "invoices" ADD COLUMN "confirmationId" TEXT;
DROP INDEX "invoices_quotationId_kind_key";
CREATE INDEX "invoices_quotationId_kind_idx" ON "invoices"("quotationId", "kind");
CREATE UNIQUE INDEX "invoices_one_kind_per_quotation" ON "invoices"("quotationId", "kind") WHERE "confirmationId" IS NULL;
CREATE UNIQUE INDEX "invoices_one_kind_per_confirmation" ON "invoices"("confirmationId", "kind") WHERE "confirmationId" IS NOT NULL;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "confirmations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An agreement or invoice of a confirmation belongs to the same quotation as the confirmation.
CREATE FUNCTION confirmation_same_quotation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."confirmationId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "confirmations" c WHERE c."id" = NEW."confirmationId" AND c."quotationId" IS NOT DISTINCT FROM NEW."quotationId"
  ) THEN
    RAISE EXCEPTION 'This record and its confirmation belong to different quotations';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER confirmation_same_quotation BEFORE INSERT OR UPDATE OF "confirmationId", "quotationId" ON "commercial_agreements" FOR EACH ROW EXECUTE FUNCTION confirmation_same_quotation();
CREATE TRIGGER confirmation_same_quotation BEFORE INSERT OR UPDATE OF "confirmationId", "quotationId" ON "invoices" FOR EACH ROW EXECUTE FUNCTION confirmation_same_quotation();

CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "confirmations" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "confirmation_lines" FOR EACH ROW EXECUTE FUNCTION finance_audit();
