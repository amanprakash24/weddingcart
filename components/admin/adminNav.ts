import { Briefcase, CalendarDays, Handshake, Database, FileText, Heart, LayoutDashboard, ListChecks, Receipt, Sparkles, Tag, Users, UsersRound } from 'lucide-react';

// The one admin navigation. Product structure: Today / Leads & Quotes / Weddings / Vendors / Invoices, with everything
// else under More. Every /admin page renders inside this shell (app/admin/layout.tsx), so the same sidebar (desktop) or
// bottom bar (phone) is always there.
//
// Screens that predate Vivah OS (Bookings, Enquiries, Consultations, Leads, …) still live in components/AdminClient.tsx and
// are reached with /admin?tab=<id>. They are listed under More → "Old screens" only until they are retired; the primary
// experience never asks anyone to know how the workflow is stored.

export type NavItem = { key: string; label: string; href: string; icon: typeof Heart; isActive: (ctx: ActiveContext) => boolean };
export type ActiveContext = { pathname: string; tab: string | null; section: string | null };

const onTab = (id: string) => ({ pathname, tab }: ActiveContext) => pathname === '/admin' && tab === id;
// Weddings = the Command Center scrolled to its "Upcoming weddings" list (a query param, not a #fragment: Next's router
// mishandles repeated hash-only navigation).
export const UPCOMING_SECTION = 'upcoming';

export const PRIMARY: NavItem[] = [
  {
    key: 'today',
    label: 'Today',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    isActive: ({ pathname, section }) => pathname === '/admin/dashboard' && section !== UPCOMING_SECTION,
  },
  {
    key: 'leads',
    label: 'Leads & Quotes',
    href: '/admin/crm',
    icon: UsersRound,
    isActive: ({ pathname }) => pathname.startsWith('/admin/crm'),
  },
  {
    // V1: the Command Center's "Upcoming weddings" list. A dedicated list comes later, once real usage says what it needs.
    key: 'weddings',
    label: 'Weddings',
    href: `/admin/dashboard?section=${UPCOMING_SECTION}`,
    icon: Heart,
    isActive: ({ pathname, section }) => pathname.startsWith('/admin/weddings') || (pathname === '/admin/dashboard' && section === UPCOMING_SECTION),
  },
  {
    key: 'vendors',
    label: 'Vendors',
    href: '/admin/vendors',
    icon: Briefcase,
    isActive: ({ pathname }) => pathname.startsWith('/admin/vendors'),
  },
  { key: 'invoices', label: 'Invoices', href: '/admin?tab=invoices', icon: Receipt, isActive: onTab('invoices') },
];

export const MORE: NavItem[] = [
  { key: 'applications', label: 'Vendor applications', href: '/admin?tab=outside-vendors', icon: Users, isActive: onTab('outside-vendors') },
  {
    key: 'vendor-prospects',
    label: 'Vendor prospects',
    href: '/admin/vendor-prospects',
    icon: ListChecks,
    isActive: ({ pathname }) => pathname.startsWith('/admin/vendor-prospects'),
  },
  {
    key: 'growth-partners',
    label: 'Growth partners',
    href: '/admin/growth-partners',
    icon: Handshake,
    isActive: ({ pathname }) => pathname.startsWith('/admin/growth-partners'),
  },
  { key: 'events', label: 'Public events', href: '/admin/events', icon: CalendarDays, isActive: ({ pathname }) => pathname.startsWith('/admin/events') },
  { key: 'blog', label: 'Blog', href: '/admin/blogs', icon: FileText, isActive: ({ pathname }) => pathname.startsWith('/admin/blogs') },
  {
    key: 'categories',
    label: 'Categories',
    href: '/admin?tab=categories',
    icon: Tag,
    isActive: (ctx) => onTab('categories')(ctx) || ctx.pathname.startsWith('/admin/categories'),
  },
  { key: 'special-services', label: 'Special services', href: '/admin?tab=special-services', icon: Sparkles, isActive: onTab('special-services') },
  { key: 'special-vendors', label: 'Special vendors', href: '/admin?tab=special-vendors', icon: Briefcase, isActive: onTab('special-vendors') },
];

// Development / setup only — shown to super admins.
export const SETUP: NavItem = { key: 'setup', label: 'Setup & seed data', href: '/admin?tab=dashboard', icon: Database, isActive: onTab('dashboard') };

// Only Bookings remains (cart bookings are not in the CRM). The old Enquiries / Consultations / Leads screens were removed on
// 4 Oct 2026: they edited a second, legacy status the CRM never saw (MASTER-GAP-ANALYSIS §2.4.2). Their URLs go to the CRM
// (OLD_TAB_REDIRECTS, app/admin/page.tsx).
export const OLD_SCREENS: NavItem[] = [
  { key: 'old-bookings', label: 'Bookings', href: '/admin?tab=bookings', icon: Receipt, isActive: onTab('bookings') },
];

export const OLD_TAB_REDIRECTS: Record<string, string> = { enquiries: '/admin/crm', consultations: '/admin/crm', leads: '/admin/crm' };

// The bottom bar on a phone: the four daily screens, then a More sheet with the rest.
export const PHONE_BAR = PRIMARY.filter((item) => item.key !== 'invoices');

