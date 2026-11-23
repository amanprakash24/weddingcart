// Family access (23 Nov 2026, Client OS) — who may do what on a couple's wedding. Pure; the server checks it on every couple route
// (lib/customer/coupleEntry.ts: asCoupleWedding) and strips what a role may not see before anything leaves the server
// (services/clientPortal.service.ts). The screens use the same answers only to hide buttons.

export type CoupleRole = 'OWNER' | 'FULL' | 'PLANNING' | 'VIEW';
export type CouplePermission = 'view' | 'plan' | 'money' | 'family';

// view   — see the wedding (functions, guests, vendors)
// plan   — change functions, guests, vendors, ask for quotes
// money  — see payments, receipts, invoices, the quotation; send "I have paid"; answer approvals
// family — add or remove family members (the couple only)
const ALLOWED: Record<CouplePermission, CoupleRole[]> = {
  view: ['OWNER', 'FULL', 'PLANNING', 'VIEW'],
  plan: ['OWNER', 'FULL', 'PLANNING'],
  money: ['OWNER', 'FULL'],
  family: ['OWNER'],
};

export function can(role: CoupleRole, permission: CouplePermission): boolean {
  return ALLOWED[permission].includes(role);
}

export const FAMILY_ROLES = ['FULL', 'PLANNING', 'VIEW'] as const;
export type FamilyRole = (typeof FAMILY_ROLES)[number];

export const FAMILY_ROLE_WORDS: Record<FamilyRole, { label: string; explains: string }> = {
  FULL: { label: 'Full access', explains: 'Sees and does everything you do, including payments. Cannot add or remove family.' },
  PLANNING: { label: 'Helps with planning', explains: 'Functions, guests and vendors. Does not see payments or prices.' },
  VIEW: { label: 'Can see the plan', explains: 'Sees functions, guests and vendors. Changes nothing; does not see payments.' },
};

export const MAX_FAMILY_MEMBERS = 15;

export interface FamilyMemberInput {
  name: string;
  mobile: string;
  relation?: string | null;
  role: string;
}

// The first thing wrong with a family member the couple is adding, or null. `mobile` must already be normalised (10 digits) or null.
export function familyMemberProblem(input: FamilyMemberInput, mobile: string | null): string | null {
  const name = input.name?.trim() ?? '';
  if (!name) return 'Add their name';
  if (name.length > 80) return 'Keep the name under 80 characters';
  if (!mobile) return 'Their mobile should be a 10-digit number';
  if (input.relation && input.relation.trim().length > 60) return 'Keep the relation under 60 characters';
  if (!(FAMILY_ROLES as readonly string[]).includes(input.role)) return 'Choose what they can do';
  return null;
}

// A guest as a family member who can only see the plan gets them: no phone, email or private RSVP link (the link lets anyone answer
// for that guest). Used on the server — the page data and the guest list API.
export function guestForViewer<G extends { phone: string | null; email: string | null; rsvpToken: string }>(g: G): G {
  return { ...g, phone: null, email: null, rsvpToken: '' };
}
