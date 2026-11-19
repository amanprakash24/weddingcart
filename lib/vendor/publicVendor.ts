// What the public may see of a vendor. The owner's own name, phone and email are private: couples contact
// Shaadi Shopping, never the venue directly (contact rule), and the public venue API used to send them to anyone
// (found in the 19 Nov 2026 test round). Admins still get them, for the admin vendor form.
export const OWNER_CONTACT_FIELDS = ['ownerName', 'ownerPhone', 'ownerEmail'] as const;
type OwnerContact = (typeof OWNER_CONTACT_FIELDS)[number];

export function withoutOwnerContact<T extends object>(vendor: T): Omit<T, OwnerContact> {
  const copy = { ...vendor } as Record<string, unknown>;
  for (const field of OWNER_CONTACT_FIELDS) delete copy[field];
  return copy as Omit<T, OwnerContact>;
}
