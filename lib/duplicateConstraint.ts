// Turns a database "duplicate" (unique-constraint) failure into words a person can act on.
//
// With the pg driver adapter Prisma does not fill `meta.target`; the violated constraint is instead in
// `meta.driverAdapterError.cause.constraint` (either `{ index: "<name>" }` or `{ fields: [...] }`). Until now that was
// thrown away and every duplicate read "<Model> already exists with this field", which hid WHICH rule was hit. Pure and
// free of Prisma/Next imports so it can be unit-tested.

export interface ConstraintInfo {
  index: string | null; // the database's own name for the rule, e.g. "quotations_supersedesId_key"
  fields: string[];
}

export function constraintFromMeta(meta: unknown): ConstraintInfo {
  const m = (meta ?? {}) as {
    target?: unknown;
    driverAdapterError?: { cause?: { constraint?: { index?: unknown; fields?: unknown } } };
  };
  const target = Array.isArray(m.target) ? m.target.filter((t): t is string => typeof t === 'string') : typeof m.target === 'string' ? [m.target] : [];
  const constraint = m.driverAdapterError?.cause?.constraint;
  const index = typeof constraint?.index === 'string' ? constraint.index : null;
  const fields = Array.isArray(constraint?.fields) ? constraint.fields.filter((f): f is string => typeof f === 'string') : target;
  return { index, fields };
}

// "invoices_invoiceNumber_key" → "invoiceNumber". Anything else (expression/partial indexes) → null.
export function columnFromIndex(index: string | null): string | null {
  if (!index) return null;
  // <table>_<column>_key: a one-word table with any column, or a longer table name with a camelCase column. Named partial rules
  // such as "quotations_one_open_per_source_key" have neither shape and correctly give null.
  const m = index.match(/^[a-z]+_([A-Za-z]+)_key$/) ?? index.match(/^[a-z_]+_([a-z]+[A-Z][A-Za-z]*)_key$/);
  return m ? m[1] : null;
}

// The quotation-workflow rules, in the operator's words. A rule not listed here still gets an honest generic sentence that
// names the constraint, so nothing is ever reduced to "this field" again.
const FRIENDLY: Record<string, string> = {
  quotations_one_open_per_source_key: 'This lead already has an open quotation — send it, edit it or discard it first.',
  quotations_one_accepted_per_source_key: 'This lead already has an accepted quotation.',
  quotations_supersedesId_key: 'This quotation already has a revision — refresh the page to see it.',
  quotations_quotationNumber_key: 'Another quotation took that number at the same moment — please try again.',
  quotations_advanceInvoiceId_key: 'An advance invoice was already created for this quotation.',
  bookings_quotationId_key: 'A booking was already created from this quotation.',
};

// Both "one open" and "one accepted" quotation rules are expression indexes on COALESCE(leadId, enquiryId, consultationId); the driver
// reports them by that expression rather than by name.
export function isSourceKeyRule(info: ConstraintInfo): boolean {
  return info.index === 'quotations_one_open_per_source_key' || info.index === 'quotations_one_accepted_per_source_key' || info.fields.some((f) => /^COALESCE\(/i.test(f));
}

export function friendlyDuplicateMessage(entity: string, info: ConstraintInfo): string {
  if (info.index && FRIENDLY[info.index]) return FRIENDLY[info.index];
  if (isSourceKeyRule(info)) return `This ${entity === 'Quotation' ? 'lead' : entity.toLowerCase()} already has an open or accepted quotation.`;
  const field = info.fields[0] ?? columnFromIndex(info.index);
  if (field) return `${entity} already exists with this ${field}`;
  return info.index ? `${entity} already exists (rule: ${info.index})` : `${entity} already exists with this field`;
}
