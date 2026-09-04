// Moved verbatim from services/vendorApplication.service.ts — that file's
// slugify() now imports from here instead of defining its own copy.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

// Readable, SEO-relevant slug ("sharma-photography-patna") for a
// human-curated Add Vendor form — unlike vendorApplication.service.ts's
// timestamp-suffixed slugs (fine for an auto-approval flow where
// uniqueness-by-timestamp is good enough), collisions here only append a
// numeric suffix when the clean slug is actually taken.
export async function generateUniqueVendorSlug(
  name: string,
  city: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugify(`${name}-${city}`);
  let candidate = base;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${n}`;
    n++;
  }
  return candidate;
}
