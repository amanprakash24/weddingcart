-- Finance audit log (money design v1, PR 2, 25 Nov 2026). Additive: one new table, two functions, triggers. No existing row changes.
--
-- Every insert, change or delete on a money table is recorded here BY THE DATABASE, whichever code path makes it, with the row
-- before and after. Who did it comes from the transaction (`app.actor_id`, set by lib/finance/audit.ts); a change made without it
-- is kept with actorId NULL and counted as "unattributed" by the reconciliation report. The log can only grow: an update, delete
-- or truncate of it is refused.

CREATE TABLE "finance_events" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tableName" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "businessId" TEXT,
    "changed" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "before" JSONB,
    "after" JSONB,

    CONSTRAINT "finance_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finance_events_at_idx" ON "finance_events"("at");
CREATE INDEX "finance_events_tableName_rowId_idx" ON "finance_events"("tableName", "rowId");

CREATE FUNCTION finance_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  o jsonb;
  n jsonb;
  ch text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP <> 'INSERT' THEN o := to_jsonb(OLD) - 'updatedAt'; END IF;
  IF TG_OP <> 'DELETE' THEN n := to_jsonb(NEW) - 'updatedAt'; END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT coalesce(array_agg(k ORDER BY k COLLATE "C"), ARRAY[]::text[]) INTO ch FROM jsonb_object_keys(n) AS k WHERE n -> k IS DISTINCT FROM o -> k;
    IF cardinality(ch) = 0 THEN RETURN NULL; END IF; -- only updatedAt moved: nothing to record
  END IF;
  INSERT INTO "finance_events" ("tableName", "rowId", "action", "actorId", "reason", "businessId", "changed", "before", "after")
  VALUES (
    TG_TABLE_NAME,
    coalesce(n ->> 'id', o ->> 'id'),
    TG_OP,
    nullif(current_setting('app.actor_id', true), ''),
    nullif(current_setting('app.finance_reason', true), ''),
    coalesce(n ->> 'businessId', o ->> 'businessId'),
    ch,
    o,
    n
  );
  RETURN NULL;
END;
$$;

CREATE FUNCTION finance_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'finance_events is append-only: % refused', TG_OP;
END;
$$;

CREATE TRIGGER finance_events_no_update BEFORE UPDATE OR DELETE ON "finance_events" FOR EACH ROW EXECUTE FUNCTION finance_events_append_only();
CREATE TRIGGER finance_events_no_truncate BEFORE TRUNCATE ON "finance_events" FOR EACH STATEMENT EXECUTE FUNCTION finance_events_append_only();

CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "invoices" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "invoice_items" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "payments" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "payment_links" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "payment_submissions" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "commercial_agreements" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "payment_instalments" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "quotations" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "quotation_items" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "bookings" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "vendor_bookings" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "vendor_payments" FOR EACH ROW EXECUTE FUNCTION finance_audit();
CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE OR DELETE ON "payouts" FOR EACH ROW EXECUTE FUNCTION finance_audit();
