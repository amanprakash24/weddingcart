// Growth Partner Program — choices, statuses and their wording (docs/wedding-os/14-growth-partner.md). No imports, so
// browser components can use it; validation and business rules live in ./rules.ts (server side).

export const PARTNER_CATEGORIES = [
  'Event Planner / Coordinator',
  'Wedding Professional',
  'Venue / Hotel / Banquet Staff',
  'Photographer',
  'Decorator',
  'Caterer',
  'Makeup Artist',
  'DJ / Entertainment',
  'Freelancer',
  'Student',
  'Local Networker',
  'Other',
] as const;

// What a partner says they can refer (multi-select on registration).
export const NETWORK_TYPES = ['Venues', 'Vendors', 'Clients', 'Events', 'Multiple categories'] as const;

export type ReferralType = 'VENUE' | 'VENDOR' | 'CLIENT' | 'EVENT';
export const REFERRAL_TYPES: ReferralType[] = ['VENUE', 'VENDOR', 'CLIENT', 'EVENT'];
export const REFERRAL_TYPE_LABEL: Record<ReferralType, string> = { VENUE: 'Venue', VENDOR: 'Vendor', CLIENT: 'Client', EVENT: 'Event' };

export type PartnerStatus = 'NEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
export const PARTNER_STATUSES: PartnerStatus[] = ['NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'INACTIVE'];
export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  NEW: 'New',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  INACTIVE: 'Inactive',
};

export type ReferralStatus = 'SUBMITTED' | 'VERIFIED' | 'CONTACTED' | 'IN_DISCUSSION' | 'CONVERTED' | 'COMPLETED' | 'PAID' | 'REJECTED';
export const REFERRAL_STATUSES: ReferralStatus[] = ['SUBMITTED', 'VERIFIED', 'CONTACTED', 'IN_DISCUSSION', 'CONVERTED', 'COMPLETED', 'PAID', 'REJECTED'];
export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  SUBMITTED: 'Submitted',
  VERIFIED: 'Verified',
  CONTACTED: 'Contacted',
  IN_DISCUSSION: 'In discussion',
  CONVERTED: 'Converted',
  COMPLETED: 'Completed',
  PAID: 'Paid',
  REJECTED: 'Rejected',
};

export type PayoutStatus = 'NOT_DUE' | 'DUE' | 'PAID';
export const PAYOUT_STATUSES: PayoutStatus[] = ['NOT_DUE', 'DUE', 'PAID'];
export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = { NOT_DUE: 'Not due', DUE: 'Due', PAID: 'Paid' };
