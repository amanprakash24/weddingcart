'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle, Calendar, Users, MapPin, Phone, Star,
  ChevronRight, Heart, Sparkles, Clock, Utensils, Building2,
  Camera, Music, Flower2, Crown
} from 'lucide-react';

interface FormData {
  name: string; phone: string; email: string; city: string; weddingDate: string;
  days: number; guestCount: number; foodPreference: string; weddingStyle: string;
  budgetRange: string; eventType: string;
  services: string[]; meals: Record<number, string[]>;
  venueType: string; consultationDate: string; preferredTime: string; message: string;
}

const EVENT_LABELS: Record<string, string> = {
  wedding: 'Wedding', engagement: 'Engagement', birthday: 'Birthday',
  anniversary: 'Anniversary', corporate: 'Corporate Event', other: 'Event',
};

interface Props {
  form: FormData;
  cartTotal: number;
}

// ── Venue data per city ─────────────────────────────────────────────────────
const VENUE_SUGGESTIONS: Record<string, { name: string; type: string; capacity: string; price: string; rating: number; tag: string }[]> = {
  Patna: [
    { name: 'Hotel Maurya', type: '5-Star Hotel', capacity: '50–800 guests', price: '₹3–8 L/day', rating: 4.7, tag: 'Most Booked' },
    { name: 'Chanakya Hotel', type: 'Banquet Hall', capacity: '100–500 guests', price: '₹1.5–4 L/day', rating: 4.5, tag: 'Best Value' },
    { name: 'Green Valley Farms', type: 'Farm House', capacity: '200–1000 guests', price: '₹2–5 L/day', rating: 4.6, tag: 'Outdoor Fav' },
  ],
  Delhi: [
    { name: 'The Leela Palace', type: '5-Star Hotel', capacity: '50–1200 guests', price: '₹10–25 L/day', rating: 4.9, tag: 'Premium Pick' },
    { name: 'Ambience Club', type: 'Banquet Hall', capacity: '100–600 guests', price: '₹3–8 L/day', rating: 4.6, tag: 'Most Booked' },
    { name: 'Qutub Resort', type: 'Resort', capacity: '200–800 guests', price: '₹5–12 L/day', rating: 4.7, tag: 'Best Value' },
  ],
  Mumbai: [
    { name: 'The Taj Mahal Palace', type: '5-Star Hotel', capacity: '50–1000 guests', price: '₹12–30 L/day', rating: 4.9, tag: 'Premium Pick' },
    { name: 'Nehru Centre', type: 'Banquet Hall', capacity: '200–700 guests', price: '₹4–10 L/day', rating: 4.5, tag: 'Best Value' },
    { name: 'Alibaug Beachside', type: 'Beach Venue', capacity: '100–400 guests', price: '₹6–14 L/day', rating: 4.8, tag: 'Destination' },
  ],
  Jaipur: [
    { name: 'Rambagh Palace', type: 'Palace', capacity: '50–600 guests', price: '₹15–40 L/day', rating: 4.9, tag: 'Royal Choice' },
    { name: 'Samode Haveli', type: 'Palace', capacity: '30–200 guests', price: '₹8–20 L/day', rating: 4.8, tag: 'Heritage' },
    { name: 'Dera Amer', type: 'Resort', capacity: '100–500 guests', price: '₹5–12 L/day', rating: 4.7, tag: 'Most Booked' },
  ],
  Udaipur: [
    { name: 'Taj Lake Palace', type: 'Palace', capacity: '50–400 guests', price: '₹20–50 L/day', rating: 5.0, tag: 'Iconic' },
    { name: 'Fateh Garh', type: 'Palace', capacity: '100–600 guests', price: '₹8–18 L/day', rating: 4.8, tag: 'Royal Choice' },
    { name: 'Devigarh Palace', type: 'Palace', capacity: '30–250 guests', price: '₹12–28 L/day', rating: 4.9, tag: 'Boutique' },
  ],
  Goa: [
    { name: 'Caravela Beach Resort', type: 'Beach Venue', capacity: '50–500 guests', price: '₹6–15 L/day', rating: 4.7, tag: 'Beach View' },
    { name: 'Vivanta Panaji', type: '5-Star Hotel', capacity: '100–600 guests', price: '₹5–12 L/day', rating: 4.6, tag: 'Most Booked' },
    { name: 'Dudhsagar Plantation', type: 'Resort', capacity: '200–800 guests', price: '₹4–9 L/day', rating: 4.5, tag: 'Nature' },
  ],
};
const DEFAULT_VENUES = [
  { name: 'City Grand Hotel', type: '5-Star Hotel', capacity: '100–800 guests', price: '₹4–10 L/day', rating: 4.6, tag: 'Top Rated' },
  { name: 'Royal Banquet', type: 'Banquet Hall', capacity: '150–500 guests', price: '₹1.5–4 L/day', rating: 4.4, tag: 'Best Value' },
  { name: 'Greenfield Farms', type: 'Farm House', capacity: '200–1000 guests', price: '₹2–6 L/day', rating: 4.5, tag: 'Popular' },
];

// ── Catering price-per-plate by food pref ───────────────────────────────────
const CATERING_RATES: Record<string, { label: string; min: number; max: number; icon: string }> = {
  veg:     { label: 'Pure Veg', min: 450,  max: 900,  icon: '🥗' },
  'non-veg': { label: 'Non-Veg', min: 600,  max: 1200, icon: '🍗' },
  both:    { label: 'Veg + Non-Veg', min: 550,  max: 1100, icon: '🍽️' },
  jain:    { label: 'Jain', min: 500,  max: 950,  icon: '🌿' },
};

// ── Vendor suggestions per service ──────────────────────────────────────────
const SERVICE_ICONS: Record<string, string> = {
  venue: '🏛️', makeup: '💄', mehndi: '🌿', decorator: '🌸', band: '🎺',
  dj: '🎧', catering: '🍽️', 'photo-video': '📸', accommodation: '🏨',
  gifts: '🎁', invitations: '✉️', transport: '🚗', legal: '📋',
  hospitality: '🤝', planning: '📝', 'bridal-lehenga': '👗',
  'bridal-jewellery': '💍', sherwani: '🤵', trousseau: '🎀',
};
const SERVICE_LABELS: Record<string, string> = {
  venue: 'Venues', makeup: 'Makeup Artists', mehndi: 'Mehndi Artists',
  decorator: 'Decorators', band: 'Band & Music', dj: 'DJs',
  catering: 'Catering', 'photo-video': 'Photographers & Videographers',
  accommodation: 'Accommodation', gifts: 'Gifts', invitations: 'Invitations',
  transport: 'Transportation', legal: 'Legal Services',
  hospitality: 'Hospitality', planning: 'Wedding Planners',
  'bridal-lehenga': 'Bridal Lehenga', 'bridal-jewellery': 'Jewellery',
  sherwani: 'Groom Wear', trousseau: 'Trousseau',
};
const EST_RANGES: Record<string, string> = {
  venue: '₹1.5–40 L', makeup: '₹15–80 K', mehndi: '₹8–35 K', decorator: '₹50 K–5 L',
  band: '₹30–80 K', dj: '₹15–50 K', catering: 'Per-plate estimate above',
  'photo-video': '₹50 K–3 L', accommodation: '₹500–5000/room/night',
  gifts: '₹500–5000/guest', invitations: '₹30–150/card', transport: '₹10–40 K',
  legal: '₹5–20 K', hospitality: '₹50–200/guest', planning: '₹50 K–3 L',
  'bridal-lehenga': '₹30 K–5 L', 'bridal-jewellery': '₹50 K–20 L',
  sherwani: '₹15–1 L', trousseau: '₹10–40 K',
};

// ── Checklist items ──────────────────────────────────────────────────────────
function buildChecklist(weddingDate: string, services: string[]) {
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

function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STYLE_LABELS: Record<string, string> = {
  traditional: 'Traditional', luxury: 'Luxury', royal: 'Royal',
  destination: 'Destination', intimate: 'Intimate', modern: 'Modern',
};
const BUDGET_LABELS: Record<string, string> = {
  'under-5L':  'Under ₹5 Lakh',
  '5-10L':     '₹5 – 10 Lakh',
  '10-20L':    '₹10 – 20 Lakh',
  '20-50L':    '₹20 – 50 Lakh',
  '50L-1Cr':   '₹50L – 1 Crore',
  'above-1Cr': 'Above ₹1 Crore',
};
const BUDGET_TIPS: Record<string, string> = {
  'under-5L':  "Great for intimate weddings. We'll shortlist budget-friendly vendors that don't compromise on quality.",
  '5-10L':     "A solid budget for a beautiful wedding. We can cover all the essentials with room for special touches.",
  '10-20L':    "With this range, you can have a premium wedding experience across all services.",
  '20-50L':    "Luxury is within reach. Our premium vendor network will make your wedding unforgettable.",
  '50L-1Cr':   "An exclusive, high-end wedding. We'll curate only the finest venues and vendors for you.",
  'above-1Cr': "A grand celebration. Expect white-glove service and a fully customised wedding experience.",
};
const STYLE_COLORS: Record<string, string> = {
  traditional: 'bg-amber-100 text-amber-800',
  luxury: 'bg-purple-100 text-purple-800',
  royal: 'bg-rose-100 text-rose-800',
  destination: 'bg-teal-100 text-teal-800',
  intimate: 'bg-pink-100 text-pink-800',
  modern: 'bg-gray-100 text-gray-800',
};

export default function WeddingDashboardClient({ form, cartTotal }: Props) {
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  const eventLabel = EVENT_LABELS[form.eventType] || 'Event';
  const venues = VENUE_SUGGESTIONS[form.city] || DEFAULT_VENUES;
  const catering = CATERING_RATES[form.foodPreference] || CATERING_RATES['veg'];
  const minCatering = catering.min * form.guestCount;
  const maxCatering = catering.max * form.guestCount;
  const checklist = buildChecklist(form.weddingDate, form.services);
  const daysLeft = daysUntil(form.weddingDate);
  const selectedServices = form.services.filter((s) => SERVICE_LABELS[s]);

  return (
    <div className="min-h-screen bg-[#FFFAF5] pt-16">

      {/* ── SECTION 1 — Welcome Banner ── */}
      <div className="bg-gradient-to-br from-rose-500 via-amber-500 to-rose-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-8 text-6xl">💍</div>
          <div className="absolute top-8 right-12 text-5xl">🌸</div>
          <div className="absolute bottom-4 left-1/3 text-4xl">✨</div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl shrink-0">
              👰
            </div>
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Your {eventLabel.toLowerCase()} plan is ready</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white font-[Playfair_Display,serif]">
                Congratulations, {form.name.split(' ')[0]}! 🎉
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {form.weddingDate && (
              <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
                <Calendar className="w-5 h-5 text-white/70 mb-1" />
                <p className="text-white/70 text-xs mb-0.5">{eventLabel} Date</p>
                <p className="text-white font-semibold text-sm">{formatDate(form.weddingDate)}</p>
                {daysLeft && <p className="text-amber-200 text-xs mt-1">{daysLeft} days to go</p>}
              </div>
            )}
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <Users className="w-5 h-5 text-white/70 mb-1" />
              <p className="text-white/70 text-xs mb-0.5">Guest Count</p>
              <p className="text-white font-semibold text-sm">{form.guestCount.toLocaleString('en-IN')} guests</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <MapPin className="w-5 h-5 text-white/70 mb-1" />
              <p className="text-white/70 text-xs mb-0.5">City</p>
              <p className="text-white font-semibold text-sm">{form.city}</p>
            </div>
            {form.weddingStyle && (
              <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
                <Crown className="w-5 h-5 text-white/70 mb-1" />
                <p className="text-white/70 text-xs mb-0.5">Wedding Style</p>
                <p className="text-white font-semibold text-sm capitalize">{STYLE_LABELS[form.weddingStyle] || form.weddingStyle}</p>
              </div>
            )}
            {form.budgetRange && (
              <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
                <Sparkles className="w-5 h-5 text-white/70 mb-1" />
                <p className="text-white/70 text-xs mb-0.5">Budget Range</p>
                <p className="text-white font-semibold text-sm">{BUDGET_LABELS[form.budgetRange] || form.budgetRange}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* ── SECTION 6 — Consultant Status (shown early, most urgent) ── */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-2xl shrink-0">
            👨‍💼
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded-full">Confirmed</span>
              <span className="text-xs text-gray-500">Your expert call is scheduled</span>
            </div>
            <p className="text-gray-900 font-semibold text-base">
              Your Wedding Expert will call on <span className="text-emerald-700">{formatDate(form.consultationDate)}</span> at <span className="text-emerald-700">{form.preferredTime}</span>
            </p>
            <p className="text-gray-500 text-sm mt-1">They'll review your full plan, suggest vendors, and answer all your questions.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <a
              href="https://wa.me/917646028228"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-colors"
              style={{ background: '#25D366' }}
            >
              <span>💬</span> WhatsApp
            </a>
            <a
              href="tel:+917646028228"
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-colors"
            >
              <Phone className="w-4 h-4" /> Call Now
            </a>
          </div>
        </div>

        {/* ── SECTION 2 — Recommended Venues ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-[Playfair_Display,serif]">Recommended Venues for Your {eventLabel} in {form.city}</h2>
              <p className="text-gray-500 text-sm mt-0.5">Shortlisted for {form.guestCount} guests · {form.days} day{form.days > 1 ? 's' : ''}</p>
            </div>
            <Link href="/categories/venue" className="text-sm text-rose-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {venues.map((v) => (
              <div key={v.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                <div className="h-28 bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center text-5xl group-hover:scale-105 transition-transform">
                  {v.type.includes('5-Star') ? '🏨' : v.type.includes('Palace') ? '🏰' : v.type.includes('Beach') ? '🏖️' : v.type.includes('Farm') ? '🌾' : v.type.includes('Resort') ? '🌴' : '🏛️'}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{v.name}</p>
                    <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full shrink-0">{v.tag}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{v.type} · {v.capacity}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-semibold text-gray-700">{v.rating}</span>
                    </div>
                    <span className="text-xs font-semibold text-rose-600">{v.price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION 3 — Catering Estimates ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">
              {catering.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-[Playfair_Display,serif]">Catering Estimate</h2>
              <p className="text-gray-500 text-sm">{catering.label} for {form.guestCount} guests</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-green-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Budget Range</p>
              <p className="text-lg font-bold text-green-700">₹{(minCatering / 100000).toFixed(1)}–{(maxCatering / 100000).toFixed(1)} L</p>
              <p className="text-xs text-gray-500">(₹{catering.min}–{catering.max}/plate)</p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Per Day Cost (approx)</p>
              <p className="text-lg font-bold text-blue-700">₹{((minCatering + maxCatering) / 2 / form.days / 100000).toFixed(1)} L</p>
              <p className="text-xs text-gray-500">averaged over {form.days} days</p>
            </div>
            <div className="bg-purple-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Food Pref</p>
              <p className="text-lg font-bold text-purple-700">{catering.icon} {catering.label}</p>
              <p className="text-xs text-gray-500">as selected by you</p>
            </div>
          </div>

          <p className="text-xs text-gray-400 flex items-start gap-1.5">
            <span className="mt-0.5">ℹ️</span>
            Estimates are indicative. Final pricing depends on menu complexity, service style (buffet/plated), and vendor. Your expert will provide exact quotes.
          </p>
        </div>

        {/* ── SECTION 4 — Suggested Vendors ── */}
        {selectedServices.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 font-[Playfair_Display,serif]">Services You've Selected</h2>
                <p className="text-gray-500 text-sm mt-0.5">We'll find top-rated vendors in {form.city} for your {eventLabel.toLowerCase()}</p>
              </div>
              <span className="text-xs font-semibold bg-rose-100 text-rose-700 px-3 py-1 rounded-full">{selectedServices.length} services</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {selectedServices.map((svc) => (
                <div key={svc} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3 hover:border-rose-200 transition-colors">
                  <span className="text-2xl shrink-0">{SERVICE_ICONS[svc] || '✨'}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{SERVICE_LABELS[svc]}</p>
                    <p className="text-xs text-rose-600 font-medium mt-0.5">{EST_RANGES[svc]}</p>
                    <p className="text-xs text-gray-400 mt-1">Vendors in {form.city}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Cost estimates are ranges. Your expert will shortlist vendors matching your budget.
            </p>
          </div>
        )}

        {/* ── SECTION 5 — Planning Checklist ── */}
        {checklist.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 font-[Playfair_Display,serif]">Your Wedding Checklist</h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  {checklist.filter((c) => !c.done).length} tasks remaining · {daysLeft ? `${daysLeft} days to wedding` : 'Date not set'}
                </p>
              </div>
              <button
                onClick={() => setChecklistExpanded((v) => !v)}
                className="text-sm text-rose-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all"
              >
                {checklistExpanded ? 'Show less' : 'Show all'} <ChevronRight className={`w-4 h-4 transition-transform ${checklistExpanded ? 'rotate-90' : ''}`} />
              </button>
            </div>

            <div className="space-y-3">
              {(checklistExpanded ? checklist : checklist.slice(0, 5)).map((item, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  item.done ? 'bg-gray-50 border-gray-100' :
                  item.urgency === 'high' ? 'bg-red-50 border-red-100' :
                  'bg-amber-50 border-amber-100'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    item.done ? 'bg-emerald-100' : item.urgency === 'high' ? 'bg-red-100' : 'bg-amber-100'
                  }`}>
                    {item.done
                      ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                      : <span className="text-xs">{item.urgency === 'high' ? '🔴' : '🟡'}</span>
                    }
                  </div>
                  <span className={`text-sm font-medium flex-1 ${item.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {item.label}
                  </span>
                  {!item.done && item.urgency === 'high' && (
                    <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full shrink-0">Urgent</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Budget Summary ── */}
        {(form.budgetRange || cartTotal > 0) && (
          <div className="bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">💰</div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg font-[Playfair_Display,serif]">Budget Overview</h3>
                {form.budgetRange && (
                  <p className="text-amber-700 font-semibold text-sm">{BUDGET_LABELS[form.budgetRange]}</p>
                )}
              </div>
            </div>

            {form.budgetRange && BUDGET_TIPS[form.budgetRange] && (
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">{BUDGET_TIPS[form.budgetRange]}</p>
            )}

            {cartTotal > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-amber-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">Cart items total</span>
                  <span className="font-bold text-rose-600 text-base">₹{cartTotal.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Your expert will factor this into your final budget plan.</p>
              </div>
            )}
          </div>
        )}

        {/* ── CTA Row ── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/categories/venue"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold px-6 py-4 rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-rose-200"
          >
            <Building2 className="w-5 h-5" /> Explore {eventLabel} Vendors in {form.city}
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-semibold px-6 py-4 rounded-2xl hover:border-rose-300 hover:text-rose-600 transition-all"
          >
            <Heart className="w-5 h-5" /> Back to Home
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 pb-8">
          Need help? Call us at <a href="tel:+917646028228" className="text-rose-500 font-medium">+91 76460 28228</a> or <a href="tel:+916201732422" className="text-rose-500 font-medium">+91 62017 32422</a>
        </p>
      </div>
    </div>
  );
}
