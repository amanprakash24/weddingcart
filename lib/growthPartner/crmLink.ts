// A Growth Partner referral → where it is worked (MASTER-GAP-ANALYSIS §2.4.3). Before this, a referral was a separate list whose
// status staff typed by hand, with no link to the lead or wedding it became. Now staff send it on once, and the referral shows the
// real CRM stage from then on:
//   • a couple (CLIENT)      → a CRM Consultation (the same kind of record the /plan wizard creates)
//   • a VENUE or VENDOR      → a Vendor prospect (the sales outreach list for businesses not yet on Shaadi Shopping)
//   • an EVENT               → stays a referral (no matching place exists yet)
// Nothing is duplicated: an existing open record with the same mobile is linked instead of creating a second one. Pure.
import type { ReferralType } from './rules';

export type ReferralTarget = 'CONSULTATION' | 'VENDOR_PROSPECT';

export function referralTarget(type: ReferralType): ReferralTarget | null {
  if (type === 'CLIENT') return 'CONSULTATION';
  if (type === 'VENUE' || type === 'VENDOR') return 'VENDOR_PROSPECT';
  return null;
}

// The last 10 digits — how a mobile is matched across tables that store it in different formats.
export const mobileKey = (phone: string): string => phone.replace(/\D/g, '').slice(-10);

const STRICT_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ConsultationDetails {
  weddingDate: string; // YYYY-MM-DD, or '' when not decided yet
  guestCount: number; // 0 when not known yet
}

// Staff may add the date and guests when sending a couple to the CRM; both are optional.
export function validateConsultationDetails(input: { weddingDate?: unknown; guestCount?: unknown }): ConsultationDetails | { error: string } {
  const date = typeof input.weddingDate === 'string' ? input.weddingDate.trim() : '';
  if (date && !STRICT_DATE.test(date)) return { error: 'Enter the wedding date as a date, or leave it empty' };
  const raw = input.guestCount;
  const guests = raw === undefined || raw === null || raw === '' ? 0 : Number(raw);
  if (!Number.isInteger(guests) || guests < 0 || guests > 100000) return { error: 'Enter the number of guests, or leave it empty' };
  return { weddingDate: date, guestCount: guests };
}

export interface ReferralForLink {
  name: string;
  phone: string;
  city: string;
  requirement: string | null;
  notes: string | null;
}

export function consultationFromReferral(r: ReferralForLink, partnerCode: string, details: ConsultationDetails) {
  const message = [`Referred by Growth Partner ${partnerCode}.`, r.requirement, r.notes ? `Partner's note: ${r.notes}` : null].filter(Boolean).join(' ');
  return { name: r.name, phone: r.phone, city: r.city, weddingDate: details.weddingDate, days: 1, guestCount: details.guestCount, message };
}

export function prospectFromReferral(r: ReferralForLink, partnerCode: string) {
  return { name: r.name, phone: r.phone, city: r.city, source: `growth-partner:${partnerCode}`, notes: [r.requirement, r.notes].filter(Boolean).join(' — ') || null };
}

// What the referral row shows about where it went.
export interface ReferralCrmView {
  kind: ReferralTarget;
  href: string;
  label: string; // "In CRM · Quotation Sent", "Booked · WED-2026-0002", "Vendor prospect · Interested"
}

export function referralCrmView(
  link: {
    consultation?: { id: string; pipelineStage: string; wedding: { weddingNumber: string } | null } | null;
    vendorProspect?: { id: string; status: string } | null;
  },
  stageLabel: (stage: string) => string
): ReferralCrmView | null {
  if (link.consultation) {
    const c = link.consultation;
    return {
      kind: 'CONSULTATION',
      href: `/admin/crm/leads/CONSULTATION/${c.id}`,
      label: c.wedding ? `Booked · ${c.wedding.weddingNumber}` : `In CRM · ${stageLabel(c.pipelineStage)}`,
    };
  }
  if (link.vendorProspect) {
    const s = link.vendorProspect.status;
    return { kind: 'VENDOR_PROSPECT', href: '/admin/vendor-prospects', label: `Vendor prospect · ${s.charAt(0)}${s.slice(1).toLowerCase().replace(/_/g, ' ')}` };
  }
  return null;
}
