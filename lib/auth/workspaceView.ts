import type { Permission } from '@/lib/auth/permissions';

// What a person SEES of Vendor OS in the workspace they chose (7 Oct 2026). This is about the menu only — every route still
// decides for itself on the server (lib/ownership/venueEntry.ts); hiding a link here protects nothing and is not meant to.
//
// Two things decide it:
//   - their permissions in that business (a manager has no Settings);
//   - whether this business is the vendor they OWN through the older owner link. Today, Weddings, Services, Availability and
//     Payments — what Shaadi Shopping shares with a vendor — are still read through that link (docs/wedding-os/15 §8.4), so in
//     any other business they would show the WRONG business's records. There they are not offered at all.
export interface WorkspaceView {
  permissions: Permission[];
  ownsVendor: boolean;
}

// Vendor OS screens that are read through the owner link, by their key in components/vendor/vendorNav.ts.
export const OWNER_LINK_SCREENS = ['today', 'weddings', 'services', 'availability', 'payments'] as const;

// The permission each of the other screens needs to be worth showing.
const NEEDS: Record<string, Permission> = { enquiries: 'enquiries', offerings: 'catalog', settings: 'settings' };

const PATHS: Record<string, string> = {
  today: '/vendor/today',
  enquiries: '/vendor/enquiries',
  weddings: '/vendor/weddings',
  services: '/vendor/services',
  availability: '/vendor/availability',
  payments: '/vendor/payments',
  offerings: '/vendor/offerings',
  settings: '/vendor/settings',
};

export function canSeeScreen(key: string, view: WorkspaceView): boolean {
  if ((OWNER_LINK_SCREENS as readonly string[]).includes(key)) return view.ownsVendor;
  const need = NEEDS[key];
  return need ? view.permissions.includes(need) : true;
}

// Where this workspace opens: Today for the vendor's owner, otherwise the first screen they can use; the business profile (any
// member may read it) when there is none.
export function vendorHome(view: WorkspaceView): string {
  const first = Object.keys(PATHS).find((key) => canSeeScreen(key, view));
  return first ? PATHS[first] : '/vendor/profile';
}

// The screen a path belongs to, or null (the profile, the chooser — open to every member).
export function screenOf(pathname: string): string | null {
  return Object.keys(PATHS).find((key) => pathname === PATHS[key] || pathname.startsWith(`${PATHS[key]}/`)) ?? null;
}
