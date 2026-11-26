-- Credit notes and invoice void for the couple's invoices (money design v1, PR 7, 25 Nov 2026). Additive: a table, columns with
-- defaults and rules. No existing row changes (creditedAmount starts at 0 for every invoice; nothing is voided).

ALTER TABLE "invoices" ADD COLUMN "creditedAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "voidedById" TEXT;
ALTER TABLE "invoices" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credited_range" CHECK ("creditedAmount" >= 0 AND "creditedAmount" <= "total");

CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "gstAmount" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_notes_amount" CHECK ("amount" > 0 AND "gstAmount" >= 0 AND "gstAmount" <= "amount"),
    CONSTRAINT "credit_notes_reason" CHECK (length(btrim("reason")) >= 3)
);
CREATE UNIQUE INDEX "credit_notes_number_key" ON "credit_notes"("number");
CREATE INDEX "credit_notes_invoiceId_idx" ON "credit_notes"("invoiceId");
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A credit note is never changed.
CREATE FUNCTION credit_note_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'A credit note cannot be changed: issue another one instead';
END;
$$;
CREATE TRIGGER credit_note_frozen BEFORE UPDATE ON "credit_notes" FOR EACH ROW EXECUTE FUNCTION credit_note_frozen();

-- Only on a couple's issued, not voided invoice; all credits never above its total. Then the invoice's creditedAmount follows.
CREATE FUNCTION credit_note_rules() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT * INTO inv FROM "invoices" WHERE "id" = NEW."invoiceId" FOR UPDATE;
  IF inv."weddingId" IS NULL THEN RAISE EXCEPTION 'Credit notes are only for a wedding''s invoices'; END IF;
  IF inv."voidedAt" IS NOT NULL THEN RAISE EXCEPTION 'Invoice % is cancelled: it cannot be credited', inv."invoiceNumber"; END IF;
  IF inv."status" = 'DRAFT' AND inv."issuedAt" IS NULL THEN RAISE EXCEPTION 'Invoice % is not issued yet: change it instead of crediting it', inv."invoiceNumber"; END IF;
  IF inv."creditedAmount" + NEW."amount" > inv."total" THEN
    RAISE EXCEPTION 'Credits on invoice % would be % — more than its total %', inv."invoiceNumber", inv."creditedAmount" + NEW."amount", inv."total";
  END IF;
  UPDATE "invoices" SET "creditedAmount" = inv."creditedAmount" + NEW."amount", "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."invoiceId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER credit_note_rules BEFORE INSERT ON "credit_notes" FOR EACH ROW EXECUTE FUNCTION credit_note_rules();

-- creditedAmount is only moved by a credit note (above); a void only on an unpaid, uncredited invoice; a voided invoice is frozen.
CREATE FUNCTION invoice_credit_void_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."voidedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Invoice % is cancelled: it cannot be changed', OLD."invoiceNumber";
  END IF;
  IF NEW."creditedAmount" <> OLD."creditedAmount" AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'The credited amount changes only through a credit note';
  END IF;
  IF NEW."voidedAt" IS NOT NULL THEN
    IF NEW."voidReason" IS NULL OR length(btrim(NEW."voidReason")) < 3 THEN RAISE EXCEPTION 'Say why the invoice is cancelled'; END IF;
    IF OLD."creditedAmount" > 0 THEN RAISE EXCEPTION 'Invoice % has credit notes: it cannot be cancelled', OLD."invoiceNumber"; END IF;
    IF EXISTS (SELECT 1 FROM "payments" p WHERE p."invoiceId" = OLD."id" AND p."status" = 'SUCCESS') OR OLD."amountPaid" > 0 THEN
      RAISE EXCEPTION 'Invoice % has payments: it cannot be cancelled — issue a credit note instead', OLD."invoiceNumber";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invoice_credit_void_guard BEFORE UPDATE ON "invoices" FOR EACH ROW EXECUTE FUNCTION invoice_credit_void_guard();

-- No new payment on a cancelled invoice.
CREATE FUNCTION payment_not_on_void_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."invoiceId" IS NOT NULL AND EXISTS (SELECT 1 FROM "invoices" i WHERE i."id" = NEW."invoiceId" AND i."voidedAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'This invoice is cancelled: it cannot take a payment';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_not_on_void_invoice BEFORE INSERT ON "payments" FOR EACH ROW EXECUTE FUNCTION payment_not_on_void_invoice();

CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "credit_notes" FOR EACH ROW EXECUTE FUNCTION finance_audit();
