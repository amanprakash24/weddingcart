import type { Permission } from '@/lib/auth/permissions';

// What a person SEES of Vendor OS in the workspace they chose (7 Oct 2026). This is about the menu only — every route still
// decides for itself on the server (lib/ownership/venueEntry.ts, lib/auth/workingVendor.ts); hiding a link here protects nothing
// and is not meant to.
//
// Their permissions in that business decide it (a manager has no Settings). Until 13 Oct 2026 Today, Weddings, Services and
// Payments — what Shaadi Shopping shares with a vendor — were offered only to the vendor's own linked owner, because they were
// read through that link; they are read through the membership now, like everything else.
export interface WorkspaceView {
  permissions: Permission[];
}

// The permission each screen needs to be worth showing (any one of a list). A screen that is not here is open to every member:
// Today, which shows each of its parts by that part's own permission. Availability reads the business's own bookings, so it is
// offered to whoever may see its enquiries or weddings. Payments is money, whoever it comes from.
const NEEDS: Record<string, Permission | readonly Permission[]> = {
  enquiries: 'enquiries',
  weddings: 'weddings',
  services: 'weddings',
  availability: ['enquiries', 'weddings'],
  payments: 'view_financials',
  offerings: 'catalog',
  settings: 'settings',
  team: 'team',
};

const PATHS: Record<string, string> = {
  today: '/vendor/today',
  enquiries: '/vendor/enquiries',
  weddings: '/vendor/weddings',
  services: '/vendor/services',
  availability: '/vendor/availability',
  payments: '/vendor/payments',
  offerings: '/vendor/offerings',
  settings: '/vendor/settings',
  team: '/vendor/team',
};

export function canSeeScreen(key: string, view: WorkspaceView): boolean {
  const need = NEEDS[key];
  if (!need) return true;
  return (typeof need === 'string' ? [need] : need).some((p) => view.permissions.includes(p));
}

// Where this workspace opens: the first screen they can use — Today, which every member has.
export function vendorHome(view: WorkspaceView): string {
  const first = Object.keys(PATHS).find((key) => canSeeScreen(key, view));
  return first ? PATHS[first] : '/vendor/profile';
}

// The screen a path belongs to, or null (the profile, the chooser — open to every member).
export function screenOf(pathname: string): string | null {
  return Object.keys(PATHS).find((key) => pathname === PATHS[key] || pathname.startsWith(`${PATHS[key]}/`)) ?? null;
}
