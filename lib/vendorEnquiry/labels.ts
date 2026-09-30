// Vendor enquiry statuses, answer choices and their wording (04-vendor-os.md §9). No imports, so the browser
// components can use it — the rules that validate answers live in ./rules.ts (server side).
export type VendorEnquiryStatus = 'PENDING' | 'AVAILABLE' | 'AVAILABLE_WITH_CONDITIONS' | 'NOT_AVAILABLE' | 'ALTERNATE_DATE' | 'QUOTED' | 'WITHDRAWN';
export type AnswerStatus = Exclude<VendorEnquiryStatus, 'PENDING' | 'WITHDRAWN'>;
export const ANSWER_STATUSES: AnswerStatus[] = ['AVAILABLE', 'AVAILABLE_WITH_CONDITIONS', 'NOT_AVAILABLE', 'ALTERNATE_DATE', 'QUOTED'];

// How the answer reached us: the vendor in Vendor OS, or staff recording what the vendor told them.
export const VENDOR_CHANNEL = 'VENDOR_OS' as const;
export const STAFF_CHANNELS = ['PHONE', 'WHATSAPP', 'IN_PERSON', 'OTHER'] as const;
export type StaffChannel = (typeof STAFF_CHANNELS)[number];

export const STATUS_LABEL: Record<VendorEnquiryStatus, string> = {
  PENDING: 'Waiting for answer',
  AVAILABLE: 'Available',
  AVAILABLE_WITH_CONDITIONS: 'Available with conditions',
  NOT_AVAILABLE: 'Not available',
  ALTERNATE_DATE: 'Suggests another date',
  QUOTED: 'Sent a quote',
  WITHDRAWN: 'No longer needed',
};
export const CHANNEL_LABEL: Record<string, string> = { VENDOR_OS: 'Vendor OS', PHONE: 'phone', WHATSAPP: 'WhatsApp', IN_PERSON: 'in person', OTHER: 'another channel' };

// Shape of what the vendor may see (built on the server by toVendorEnquiryView in ./rules.ts).
export interface VendorEnquiryView {
  id: string;
  services: string;
  functions: string | null;
  eventDate: string | null;
  guestCount: number | null;
  city: string | null;
  eventType: string | null;
  status: VendorEnquiryStatus;
  answer: { note: string | null; suggestedDate: string | null; quotedAmount: number | null; answeredAt: string | null; answeredBy: 'you' | 'shaadi-shopping' | null };
  askedAt: string;
}
