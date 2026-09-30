// Growth Partner Program — validation and business rules (docs/wedding-os/14-growth-partner.md). Pure: no database.
//
// V1 answers four questions only: who is the partner, what did they refer, did it convert, what payout is due.
// Staff verify everything by hand; payout amounts are always entered by staff (no automatic rates).
import { ValidationError } from '@/lib/errors';
import {
  NETWORK_TYPES,
  PARTNER_CATEGORIES,
  PARTNER_STATUSES,
  PAYOUT_STATUSES,
  REFERRAL_STATUSES,
  REFERRAL_TYPES,
  type PartnerStatus,
  type PayoutStatus,
  type ReferralStatus,
  type ReferralType,
} from './labels';

export * from './labels';

const str = (v: unknown, label: string, max: number, required: boolean): string | null => {
  if (v == null || (typeof v === 'string' && v.trim() === '')) {
    if (required) throw new ValidationError(`${label} is required`);
    return null;
  }
  if (typeof v !== 'string') throw new ValidationError(`${label} must be text`);
  const t = v.trim().replace(/\s+/g, ' ');
  if (t.length > max) throw new ValidationError(`${label} must be at most ${max} characters`);
  return t;
};

// Indian mobile: 10 digits starting 6–9, optional +91 / 91 / 0 prefix and spaces or dashes.
export function normalizeMobile(v: unknown, label = 'Mobile number', required = true): string | null {
  const raw = str(v, label, 20, required);
  if (raw == null) return null;
  const digits = raw.replace(/[\s-]/g, '').replace(/^(\+?91|0)(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) throw new ValidationError(`${label} must be a 10-digit Indian mobile number`);
  return digits;
}

function email(v: unknown): string | null {
  const e = str(v, 'Email', 200, false);
  if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ValidationError('Email looks incomplete');
  return e ? e.toLowerCase() : null;
}

export interface Registration {
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  city: string;
  category: string;
  referralTypes: string[];
  networkNote: string | null;
}

export function validateRegistration(input: Record<string, unknown>): Registration {
  if (input.consent !== true) throw new ValidationError('Please agree to be contacted about the Growth Partner Program');
  const category = str(input.category, 'What best describes you', 60, true)!;
  if (!(PARTNER_CATEGORIES as readonly string[]).includes(category)) throw new ValidationError('Choose what best describes you');
  const types = Array.isArray(input.referralTypes) ? input.referralTypes : [];
  if (types.length === 0) throw new ValidationError('Choose at least one type of referral you can provide');
  if (!types.every((t) => (NETWORK_TYPES as readonly unknown[]).includes(t))) throw new ValidationError('Choose referral types from the list');
  return {
    name: str(input.name, 'Full name', 100, true)!,
    phone: normalizeMobile(input.phone)!,
    whatsapp: normalizeMobile(input.whatsapp, 'WhatsApp number', false),
    email: email(input.email),
    city: str(input.city, 'City', 80, true)!,
    category,
    referralTypes: [...new Set(types as string[])],
    networkNote: str(input.networkNote, 'About your network', 1000, false),
  };
}

// "GP-1001", "GP-1002" … — sequential, human-friendly, not a secret on its own (it is always checked with the mobile).
export const CODE_START = 1001;
export function nextPartnerCode(lastCode: string | null): string {
  const n = lastCode ? Number(lastCode.replace(/^GP-/, '')) : NaN;
  return `GP-${Number.isInteger(n) && n >= CODE_START ? n + 1 : CODE_START}`;
}
export function normalizePartnerCode(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = v.trim().toUpperCase().replace(/\s+/g, '').match(/^(?:GP-?)?(\d{4,6})$/);
  return m ? `GP-${m[1]}` : null;
}

export interface ReferralInput {
  partnerPhone: string;
  partnerCode: string;
  type: ReferralType;
  name: string;
  phone: string;
  city: string;
  requirement: string | null;
  notes: string | null;
}

// One message for every "who are you" failure, so the form never reveals whether a mobile is registered.
export const PARTNER_NOT_FOUND = 'That mobile number and Partner code do not match. Check the code shown when you registered, or contact us.';

export function validateReferral(input: Record<string, unknown>): ReferralInput {
  if (input.consent !== true) throw new ValidationError('Please confirm this person or business agreed to be contacted');
  const code = normalizePartnerCode(input.partnerCode);
  if (!code) throw new ValidationError(PARTNER_NOT_FOUND);
  const type = input.type as ReferralType;
  if (!REFERRAL_TYPES.includes(type)) throw new ValidationError('Choose what you are referring');
  return {
    partnerPhone: normalizeMobile(input.partnerPhone, 'Your registered mobile')!,
    partnerCode: code,
    type,
    name: str(input.name, 'Name / business name', 120, true)!,
    phone: normalizeMobile(input.phone, 'Their contact number')!,
    city: str(input.city, 'City / location', 80, true)!,
    requirement: str(input.requirement, 'Requirement', 1000, false),
    notes: str(input.notes, 'Additional notes', 1000, false),
  };
}

// ---- staff updates -------------------------------------------------------------------------------------------------

export interface PartnerUpdate {
  status?: PartnerStatus;
  staffNotes?: string | null;
}
export function validatePartnerUpdate(input: Record<string, unknown>): PartnerUpdate {
  const out: PartnerUpdate = {};
  if (input.status !== undefined) {
    if (!PARTNER_STATUSES.includes(input.status as PartnerStatus)) throw new ValidationError('Unknown partner status');
    out.status = input.status as PartnerStatus;
  }
  if (input.staffNotes !== undefined) out.staffNotes = str(input.staffNotes, 'Notes', 2000, false);
  return out;
}

export interface ReferralUpdate {
  status?: ReferralStatus;
  assignedToId?: string | null;
  payoutStatus?: PayoutStatus;
  payoutAmount?: number | null;
  staffNotes?: string | null;
}
export function validateReferralUpdate(input: Record<string, unknown>): ReferralUpdate {
  const out: ReferralUpdate = {};
  if (input.status !== undefined) {
    if (!REFERRAL_STATUSES.includes(input.status as ReferralStatus)) throw new ValidationError('Unknown referral status');
    out.status = input.status as ReferralStatus;
  }
  if (input.payoutStatus !== undefined) {
    if (!PAYOUT_STATUSES.includes(input.payoutStatus as PayoutStatus)) throw new ValidationError('Unknown payout status');
    out.payoutStatus = input.payoutStatus as PayoutStatus;
  }
  if (input.payoutAmount !== undefined) {
    if (input.payoutAmount === null || input.payoutAmount === '') out.payoutAmount = null;
    else {
      const n = Number(input.payoutAmount);
      if (!Number.isInteger(n) || n < 0 || n > 10_000_000) throw new ValidationError('Payout amount must be a whole number of rupees');
      out.payoutAmount = n;
    }
  }
  if (input.assignedToId !== undefined) {
    if (input.assignedToId !== null && (typeof input.assignedToId !== 'string' || !input.assignedToId)) throw new ValidationError('Choose a team member');
    out.assignedToId = input.assignedToId as string | null;
  }
  if (input.staffNotes !== undefined) out.staffNotes = str(input.staffNotes, 'Notes', 2000, false);
  return out;
}

const PAYABLE: ReferralStatus[] = ['COMPLETED', 'PAID'];

// The state after an update, checked as a whole: a payout can only be due or paid once the business is completed,
// "Paid" needs an amount, and a referral marked PAID must have its payout paid (and the other way round).
export function applyReferralUpdate(
  current: { status: ReferralStatus; payoutStatus: PayoutStatus; payoutAmount: number | null; completedAt: Date | null; paidAt: Date | null },
  update: ReferralUpdate,
  now: Date
) {
  let status = update.status ?? current.status;
  let payoutStatus = update.payoutStatus ?? current.payoutStatus;
  const payoutAmount = update.payoutAmount !== undefined ? update.payoutAmount : current.payoutAmount;
  // Marking either side "paid" marks both — one fact, not two that can disagree.
  if (update.status === 'PAID') payoutStatus = 'PAID';
  if (update.payoutStatus === 'PAID' && status !== 'PAID') status = 'PAID';
  if (payoutStatus !== 'NOT_DUE' && !PAYABLE.includes(status)) throw new ValidationError('A payout can only be due or paid once the referral is completed');
  if (payoutStatus === 'PAID' && (payoutAmount == null || payoutAmount <= 0)) throw new ValidationError('Enter the payout amount before marking it paid');
  // Paid only after completed — however the "paid" was reached (referral status or payout status).
  if (status === 'PAID' && current.status !== 'PAID' && current.status !== 'COMPLETED') {
    throw new ValidationError('Mark the referral completed before marking it paid');
  }
  return {
    status,
    payoutStatus,
    payoutAmount,
    completedAt: PAYABLE.includes(status) ? current.completedAt ?? now : null,
    paidAt: payoutStatus === 'PAID' ? current.paidAt ?? now : null,
  };
}
