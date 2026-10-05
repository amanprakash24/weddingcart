import { Briefcase, CalendarClock, Heart, Inbox, LayoutDashboard, type LucideIcon, ListChecks, Receipt, Settings } from 'lucide-react';

// The one Vendor OS navigation — shared by ordinary vendors and venue owners alike. Venue Owner is a
// specialized Vendor OS experience (docs/wedding-os/11-vivah-os-ux-architecture.md §3), not a separate
// role or a separate nav: every label here already reads correctly for a caterer or a banquet hall, so
// nothing here is vendor-category-specific. Every /vendor page renders inside VendorShell
// (app/vendor/layout.tsx), same relationship AdminShell has with adminNav.ts.
//
// Weddings/Services/Availability/Payments routes don't exist yet (explicitly out of scope for this task) —
// their entries below point at the routes they'll live at once built; until then they 404, the same way a
// nav gets built ahead of its screens elsewhere in this codebase.

export type NavItem = { key: string; label: string; href: string; icon: LucideIcon; isActive: (pathname: string) => boolean };

export const PRIMARY: NavItem[] = [
  { key: 'today', label: 'Today', href: '/vendor/today', icon: LayoutDashboard, isActive: (p) => p === '/vendor/today' },
  // Phase C: the venue's own enquiries (+ New Enquiry) and Shaadi Shopping's availability requests, on one screen.
  { key: 'enquiries', label: 'Enquiries', href: '/vendor/enquiries', icon: Inbox, isActive: (p) => p.startsWith('/vendor/enquiries') },
  { key: 'weddings', label: 'Weddings', href: '/vendor/weddings', icon: Heart, isActive: (p) => p.startsWith('/vendor/weddings') },
  { key: 'services', label: 'Services', href: '/vendor/services', icon: Briefcase, isActive: (p) => p.startsWith('/vendor/services') },
  { key: 'availability', label: 'Availability', href: '/vendor/availability', icon: CalendarClock, isActive: (p) => p.startsWith('/vendor/availability') },
  { key: 'payments', label: 'Payments', href: '/vendor/payments', icon: Receipt, isActive: (p) => p.startsWith('/vendor/payments') },
  // Phase C: the venue's own price list, function by function (Haldi: lawn, decoration …).
  { key: 'offerings', label: 'What we offer', href: '/vendor/offerings', icon: ListChecks, isActive: (p) => p.startsWith('/vendor/offerings') },
  // Phase C: the venue's own number and booking rule, for the customers it brings itself.
  { key: 'settings', label: 'Settings', href: '/vendor/settings', icon: Settings, isActive: (p) => p.startsWith('/vendor/settings') },
];

// Phone bottom bar: 4 daily items + a More button for the rest (same shape as adminNav.ts's PHONE_BAR).
export const PHONE_BAR = PRIMARY.filter((item) => ['today', 'enquiries', 'weddings', 'payments'].includes(item.key));
export const PHONE_MORE = PRIMARY.filter((item) => !PHONE_BAR.includes(item));
