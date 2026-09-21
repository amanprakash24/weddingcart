// Terms & Conditions for a new quotation. A venue keeps ONE default set (Vendor.defaultTerms); when a quotation is created the
// venue's text is COPIED into it. After that the quotation owns its terms: editing the venue's defaults later never reaches an
// existing quotation, booking or invoice, and a revision copies the previous quotation's terms, not the venue's current ones.
// Pure and free of server imports.
export interface TermsVendor {
  id: string;
  defaultTerms: string | null;
  categoryName: string;
}

// A "venue" is decided by its category, not by a name typed into code: banquet halls, lawns, resorts, farmhouses.
const VENUE_CATEGORY = /venue|banquet|hall|lawn|resort|farm/i;

export function isVenueCategory(categoryName: string): boolean {
  return VENUE_CATEGORY.test(categoryName);
}

// The default terms to start a quotation with: taken from the first line (in the order the lines are written) whose vendor is a
// venue that has default terms. Null when there is none — the quotation then simply starts with no terms.
export function pickVenueTerms(items: { vendorId?: string | null }[], vendors: TermsVendor[]): string | null {
  const byId = new Map(vendors.map((v) => [v.id, v]));
  for (const item of items) {
    const vendor = item.vendorId ? byId.get(item.vendorId) : undefined;
    const terms = vendor?.defaultTerms?.trim();
    if (vendor && terms && isVenueCategory(vendor.categoryName)) return terms;
  }
  return null;
}
