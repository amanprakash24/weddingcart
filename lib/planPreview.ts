// Shared display constants/helpers for the /plan wizard's live preview
// (components/plan/LivePlanPreview.tsx) and the post-submission result
// screen (components/WeddingDashboardClient.tsx) — both describe the same
// plan data, so they read from one source instead of drifting copies.
import { Vendor } from '@/types';

export interface PlanFormData {
  name: string; phone: string; email: string; city: string; weddingDate: string;
  days: number; guestCount: number; foodPreference: string; weddingStyle: string;
  budgetRange: string; eventType: string;
  services: string[]; meals: Record<number, string[]>;
  venueType: string; consultationDate: string; preferredTime: string; message: string;
}

export const EVENT_LABELS: Record<string, string> = {
  wedding: 'Wedding', engagement: 'Engagement', birthday: 'Birthday',
  anniversary: 'Anniversary', corporate: 'Corporate Event', other: 'Event',
};

// ── Catering price-per-plate by food pref ───────────────────────────────────
export const CATERING_RATES: Record<string, { label: string; min: number; max: number; icon: string }> = {
  veg:     { label: 'Pure Veg', min: 450,  max: 900,  icon: '🥗' },
  'non-veg': { label: 'Non-Veg', min: 600,  max: 1200, icon: '🍗' },
  both:    { label: 'Veg + Non-Veg', min: 550,  max: 1100, icon: '🍽️' },
  jain:    { label: 'Jain', min: 500,  max: 950,  icon: '🌿' },
};

// ── Vendor suggestions per service ──────────────────────────────────────────
export const SERVICE_ICONS: Record<string, string> = {
  venue: '🏛️', makeup: '💄', mehndi: '🌿', decorator: '🌸', band: '🎺',
  dj: '🎧', catering: '🍽️', 'photo-video': '📸', accommodation: '🏨',
  gifts: '🎁', invitations: '✉️', transport: '🚗', legal: '📋',
  hospitality: '🤝', planning: '📝', 'bridal-lehenga': '👗',
  'bridal-jewellery': '💍', sherwani: '🤵', trousseau: '🎀', sfx: '✨', security: '🛡️',
};
export const SERVICE_LABELS: Record<string, string> = {
  venue: 'Venues', makeup: 'Makeup Artists', mehndi: 'Mehndi Artists',
  decorator: 'Decorators', band: 'Band & Music', dj: 'DJs',
  catering: 'Catering', 'photo-video': 'Photographers & Videographers',
  accommodation: 'Accommodation', gifts: 'Gifts', invitations: 'Invitations',
  transport: 'Transportation', legal: 'Legal Services',
  hospitality: 'Hospitality', planning: 'Wedding Planners',
  'bridal-lehenga': 'Bridal Lehenga', 'bridal-jewellery': 'Jewellery',
  sherwani: 'Groom Wear', trousseau: 'Trousseau', sfx: 'SFX Effects', security: 'Security Guards & Bouncers',
};
export const EST_RANGES: Record<string, string> = {
  venue: '₹1.5–40 L', makeup: '₹15–80 K', mehndi: '₹8–35 K', decorator: '₹50 K–5 L',
  band: '₹30–80 K', dj: '₹15–50 K', catering: 'Per-plate estimate above',
  'photo-video': '₹50 K–3 L', accommodation: '₹500–5000/room/night',
  gifts: '₹500–5000/guest', invitations: '₹30–150/card', transport: '₹10–40 K',
  legal: '₹5–20 K', hospitality: '₹50–200/guest', planning: '₹50 K–3 L',
  'bridal-lehenga': '₹30 K–5 L', 'bridal-jewellery': '₹50 K–20 L',
  sherwani: '₹15–1 L', trousseau: '₹10–40 K', sfx: '₹25–2 L', security: '₹8–50 K',
};

export const STYLE_LABELS: Record<string, string> = {
  traditional: 'Traditional', luxury: 'Luxury', royal: 'Royal',
  destination: 'Destination', intimate: 'Intimate', modern: 'Modern',
};
export const BUDGET_LABELS: Record<string, string> = {
  'under-5L':  'Under ₹5 Lakh',
  '5-10L':     '₹5 – 10 Lakh',
  '10-20L':    '₹10 – 20 Lakh',
  '20-50L':    '₹20 – 50 Lakh',
  '50L-1Cr':   '₹50L – 1 Crore',
  'above-1Cr': 'Above ₹1 Crore',
};
export const BUDGET_TIPS: Record<string, string> = {
  'under-5L':  "Great for intimate weddings. We'll shortlist budget-friendly vendors that don't compromise on quality.",
  '5-10L':     "A solid budget for a beautiful wedding. We can cover all the essentials with room for special touches.",
  '10-20L':    "With this range, you can have a premium wedding experience across all services.",
  '20-50L':    "Luxury is within reach. Our premium vendor network will make your wedding unforgettable.",
  '50L-1Cr':   "An exclusive, high-end wedding. We'll curate only the finest venues and vendors for you.",
  'above-1Cr': "A grand celebration. Expect white-glove service and a fully customised wedding experience.",
};
export const STYLE_COLORS: Record<string, string> = {
  traditional: 'bg-amber-100 text-amber-800',
  luxury: 'bg-purple-100 text-purple-800',
  royal: 'bg-rose-100 text-rose-800',
  destination: 'bg-teal-100 text-teal-800',
  intimate: 'bg-pink-100 text-pink-800',
  modern: 'bg-gray-100 text-gray-800',
};

// ── Checklist items ──────────────────────────────────────────────────────────
export function buildChecklist(weddingDate: string, services: string[]) {
  if (!weddingDate) return [];
  const d = new Date(weddingDate);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86400000));

  const items = [
    { label: 'Confirm venue booking', done: daysLeft < 270, urgency: daysLeft < 90 ? 'high' : 'medium' },
    { label: 'Finalize guest list', done: daysLeft < 180, urgency: daysLeft < 60 ? 'high' : 'medium' },
    { label: 'Book catering & set menu', done: daysLeft < 150, urgency: daysLeft < 60 ? 'high' : 'medium' },
    { label: 'Send out invitations', done: daysLeft < 60, urgency: daysLeft < 30 ? 'high' : 'medium' },
  ];
  if (services.includes('photo-video')) items.push({ label: 'Book photographer & videographer', done: daysLeft < 200, urgency: daysLeft < 90 ? 'high' : 'low' });
  if (services.includes('makeup'))      items.push({ label: 'Schedule makeup artist trial', done: daysLeft < 60, urgency: daysLeft < 30 ? 'high' : 'low' });
  if (services.includes('decorator'))   items.push({ label: 'Confirm decor themes & colours', done: daysLeft < 120, urgency: daysLeft < 45 ? 'high' : 'medium' });
  if (services.includes('mehndi'))      items.push({ label: 'Book mehndi artist for pre-events', done: daysLeft < 90, urgency: daysLeft < 30 ? 'high' : 'low' });
  items.push({ label: 'Consult your wedding expert', done: false, urgency: 'high' });
  return items;
}

export function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

export function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Same math WeddingDashboardClient's JSX computes inline — pulled out so the
// live preview doesn't re-derive it independently.
export function cateringEstimate(guestCount: number, foodPreference: string, days: number) {
  const catering = CATERING_RATES[foodPreference] || CATERING_RATES['veg'];
  const min = catering.min * guestCount;
  const max = catering.max * guestCount;
  const perDayAvg = (min + max) / 2 / Math.max(1, days);
  return { catering, min, max, perDayAvg };
}

// Same ternary WeddingDashboardClient's JSX uses inline for the venue card badge.
export function venueTag(vendor: Pick<Vendor, 'isFeatured' | 'rating'>): string {
  if (vendor.isFeatured) return 'Featured';
  if (vendor.rating >= 4.8) return 'Top Rated';
  if (vendor.rating >= 4.5) return 'Highly Rated';
  return 'Verified';
}

export function emptyVenueMessage(city: string) {
  return {
    title: `No venues listed for ${city} yet`,
    body: 'Our expert will personally recommend the best venues for your celebration.',
  };
}
