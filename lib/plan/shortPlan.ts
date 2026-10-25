// The /plan form (25 Oct 2026): every question of the old 5-step wizard on one page — four quick details first, the rest
// in optional sections. What is checked, and what is sent to POST /api/consultations. Pure, so it is tested alone.
//
// The server (app/api/consultations/schema.ts) keeps only its own fields and silently drops the rest: the wizard's
// style, meals and call date never reached the CRM. They now travel in `message`, so the Wedding Expert sees every answer.
import type { PlanFormData } from '@/lib/planPreview';

export const EVENT_TYPES = [
  { id: 'wedding', label: 'Wedding' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'anniversary', label: 'Anniversary' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'other', label: 'Other event' },
] as const;

export const CITIES = ['Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa'] as const;
export const DAY_OPTIONS = [1, 2, 3, 4, 5, 7] as const;
export const FOOD_OPTIONS = [
  { id: 'veg', label: 'Veg' },
  { id: 'non-veg', label: 'Non-veg' },
  { id: 'both', label: 'Both' },
] as const;

export const BUDGET_OPTIONS = [
  { id: 'under-5L', label: 'Under ₹5 lakh' },
  { id: '5-10L', label: '₹5–10 lakh' },
  { id: '10-20L', label: '₹10–20 lakh' },
  { id: '20-50L', label: '₹20–50 lakh' },
  { id: '50L-1Cr', label: '₹50 lakh–1 crore' },
  { id: 'above-1Cr', label: 'Above ₹1 crore' },
] as const;

// Homepage budget links (?budget=…) → the nearest budget option.
export const BUDGET_QUERY_MAP: Record<string, string> = {
  'under-5': 'under-5L',
  '5-10': '5-10L',
  '10-15': '10-20L',
  '15-25': '20-50L',
  '25-plus': '20-50L',
};

export const MAIN_SERVICES = [
  { id: 'venue', label: 'Venues' },
  { id: 'makeup', label: 'Makeup Artists' },
  { id: 'mehndi', label: 'Mehndi' },
  { id: 'decorator', label: 'Decorators' },
  { id: 'band', label: 'Band & Music' },
  { id: 'dj', label: 'DJ' },
  { id: 'catering', label: 'Catering' },
  { id: 'photo-video', label: 'Photo & Video' },
] as const;

export const MORE_SERVICES = [
  { id: 'accommodation', label: 'Accommodation' },
  { id: 'gifts', label: 'Gifts' },
  { id: 'invitations', label: 'Invitations & Stationery' },
  { id: 'transport', label: 'Transportation' },
  { id: 'legal', label: 'Legal & Documentation' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'planning', label: 'Wedding Planning & Coordination' },
  { id: 'bridal-lehenga', label: 'Bridal Lehenga' },
  { id: 'bridal-jewellery', label: 'Bridal Jewellery' },
  { id: 'sherwani', label: 'Sherwani / Groom Wear' },
  { id: 'trousseau', label: 'Trousseau Packing' },
  { id: 'sfx', label: 'SFX Effects' },
  { id: 'security', label: 'Security Guards & Bouncers' },
] as const;

export const VENUE_TYPES = [
  { id: '5star', label: '5-Star Hotel', desc: 'Luxury & prestige' },
  { id: 'resort', label: 'Resort', desc: 'Nature & relaxation' },
  { id: 'farmhouse', label: 'Farm House', desc: 'Open & spacious' },
  { id: 'palace', label: 'Palace', desc: 'Royal & heritage' },
  { id: 'banquet', label: 'Banquet Hall', desc: 'Classic & elegant' },
  { id: 'beach', label: 'Beach Venue', desc: 'Romantic & scenic' },
  { id: 'garden', label: 'Garden / Lawn', desc: 'Natural & fresh' },
  { id: 'own-home', label: 'Own Home', desc: 'Personal & intimate' },
] as const;

export const CAPACITY_GUIDE = [
  ['Banquet Hall', 'best for 100–400 guests'],
  ['Farmhouse / Lawn', 'open-air, 200–800 guests'],
  ['Palace / Heritage', '150–500 guests, royal feel'],
  ['Resort', 'destination weddings, 100–300 guests'],
  ['Beach Venue', '50–200 guests'],
] as const;

export const SETTINGS = [
  { id: 'indoor', label: 'Indoor', desc: 'AC & covered' },
  { id: 'outdoor', label: 'Outdoor', desc: 'Open air & natural' },
  { id: 'both', label: 'Both', desc: 'Mix of both' },
] as const;

export const MEALS = ['Breakfast', 'Lunch', 'High Tea', 'Dinner'] as const;

export const STYLES = [
  { id: 'traditional', label: 'Traditional', note: 'We honour every custom and ritual.' },
  { id: 'luxury', label: 'Luxury', note: 'Premium vendors for an extraordinary experience.' },
  { id: 'royal', label: 'Royal', note: 'Royal-style weddings deserve royal coordination.' },
  { id: 'destination', label: 'Destination', note: 'We handle the logistics.' },
  { id: 'intimate', label: 'Intimate', note: 'A close-knit celebration with your loved ones.' },
  { id: 'modern', label: 'Modern', note: 'A stylish celebration around your vision.' },
] as const;

/** A 10-digit Indian mobile, typed with or without +91, 0, spaces or dashes; null if it is not one. */
export function planPhoneDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export type QuickField = 'name' | 'phone' | 'weddingDate' | 'guestCount';

/** Problems with the four required details, shown next to each; empty = it can be sent. `today` = YYYY-MM-DD. */
export function checkPlanForm(form: Pick<PlanFormData, QuickField>, today: string): Partial<Record<QuickField, string>> {
  const problems: Partial<Record<QuickField, string>> = {};
  if (!form.name.trim()) problems.name = 'Please enter your name.';
  if (!planPhoneDigits(form.phone)) problems.phone = 'Please enter a 10-digit mobile number.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.weddingDate) || Number.isNaN(new Date(form.weddingDate).getTime())) problems.weddingDate = 'Please pick the date.';
  else if (form.weddingDate < today) problems.weddingDate = 'Please pick a date from today onwards.';
  if (!Number.isInteger(form.guestCount) || form.guestCount < 1) problems.guestCount = 'Please enter roughly how many guests.';
  else if (form.guestCount > 100000) problems.guestCount = 'Please check the number of guests.';
  return problems;
}

const labelOf = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;

/** The answers the server has no field for, as lines for the Wedding Expert. */
export function extraAnswers(form: PlanFormData, setting: string): string[] {
  const lines: string[] = [];
  if (form.weddingStyle) lines.push(`Style: ${labelOf(STYLES, form.weddingStyle)}`);
  if (setting) lines.push(`Setting: ${labelOf(SETTINGS, setting)}`);
  const meals = Object.entries(form.meals)
    .filter(([day, list]) => Number(day) <= form.days && list.length > 0)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([day, list]) => `Day ${day} ${MEALS.filter((m) => list.includes(m)).join(', ')}`);
  if (meals.length > 0) lines.push(`Meals: ${meals.join('; ')}`);
  if (form.consultationDate) lines.push(`Call on: ${form.consultationDate}${form.preferredTime ? ` at ${form.preferredTime}` : ''}`);
  return lines;
}

/** The body for POST /api/consultations: every answer, either in its own field or in the message. */
export function planPayload(form: PlanFormData, setting: string, cartItems: unknown[], cartTotal: number) {
  const extras = extraAnswers(form, setting);
  const message = [form.message.trim(), extras.length > 0 ? extras.join('\n') : ''].filter(Boolean).join('\n\n');
  return {
    name: form.name.trim(),
    phone: planPhoneDigits(form.phone) ?? form.phone.trim(),
    ...(form.email.trim() ? { email: form.email.trim() } : {}),
    city: form.city,
    eventType: form.eventType,
    weddingDate: form.weddingDate,
    days: form.days,
    guestCount: form.guestCount,
    ...(form.foodPreference ? { foodPreference: form.foodPreference } : {}),
    services: form.services,
    ...(form.venueType ? { venueType: form.venueType } : {}),
    ...(form.preferredTime ? { preferredTime: form.preferredTime } : {}),
    ...(form.budgetRange ? { budgetRange: form.budgetRange } : {}),
    ...(message ? { message } : {}),
    cartItems,
    totalBudget: Math.max(0, Math.round(cartTotal || 0)),
  };
}
