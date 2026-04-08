'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { User, Phone, Mail, Calendar, Users, UtensilsCrossed, Building2, CheckCircle, ChevronRight, ChevronLeft, Sparkles, Heart, Clock, X, MapPin } from 'lucide-react';

const CITIES = ['Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa'];
import { useCart } from '@/context/CartContext';

const STEPS = ['Event Details', 'Services', 'Meal Plan', 'Venue Preference', 'Consultation'];

const SERVICES = [
  // ── Primary 8 categories (in original order) ──
  { id: 'venue', label: 'Venues', icon: '🏛️', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { id: 'makeup', label: 'Makeup Artists', icon: '💄', color: 'bg-pink-50 border-pink-200 text-pink-700' },
  { id: 'mehndi', label: 'Mehndi', icon: '🌿', color: 'bg-green-50 border-green-200 text-green-700' },
  { id: 'decorator', label: 'Decorators', icon: '🌸', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { id: 'band', label: 'Band & Music', icon: '🎺', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  { id: 'dj', label: 'DJ', icon: '🎧', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { id: 'catering', label: 'Catering', icon: '🍽️', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  { id: 'photo-video', label: 'Photo & Video', icon: '📸', color: 'bg-teal-50 border-teal-200 text-teal-700' },
  // ── Additional / On-demand services ──
  { id: 'accommodation', label: 'Accommodation', icon: '🏨', color: 'bg-sky-50 border-sky-200 text-sky-700' },
  { id: 'gifts', label: 'Gifts', icon: '🎁', color: 'bg-red-50 border-red-200 text-red-700' },
  { id: 'invitations', label: 'Invitations & Stationery', icon: '✉️', color: 'bg-rose-50 border-rose-200 text-rose-700' },
  { id: 'transport', label: 'Transportation', icon: '🚗', color: 'bg-gray-50 border-gray-200 text-gray-700' },
  { id: 'legal', label: 'Legal & Documentation', icon: '📋', color: 'bg-slate-50 border-slate-200 text-slate-700' },
  { id: 'hospitality', label: 'Hospitality', icon: '🤝', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { id: 'planning', label: 'Wedding Planning & Coordination', icon: '📝', color: 'bg-violet-50 border-violet-200 text-violet-700' },
  { id: 'bridal-lehenga', label: 'Bridal Lehenga', icon: '👗', color: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700' },
  { id: 'bridal-jewellery', label: 'Bridal Jewellery', icon: '💍', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { id: 'sherwani', label: 'Sherwani / Groom Wear', icon: '🤵', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { id: 'trousseau', label: 'Trousseau Packing', icon: '🎀', color: 'bg-lime-50 border-lime-200 text-lime-700' },
];

const VENUE_TYPES = [
  { id: '5star', label: '5-Star Hotel', icon: '⭐', desc: 'Luxury & prestige' },
  { id: 'resort', label: 'Resort', icon: '🌴', desc: 'Nature & relaxation' },
  { id: 'farmhouse', label: 'Farm House', icon: '🌾', desc: 'Open & spacious' },
  { id: 'palace', label: 'Palace', icon: '🏰', desc: 'Royal & heritage' },
  { id: 'banquet', label: 'Banquet Hall', icon: '🏛️', desc: 'Classic & elegant' },
  { id: 'beach', label: 'Beach Venue', icon: '🏖️', desc: 'Romantic & scenic' },
  { id: 'garden', label: 'Garden / Lawn', icon: '🌿', desc: 'Natural & fresh' },
  { id: 'own-home', label: 'Own Home', icon: '🏠', desc: 'Personal & intimate' },
];

const TIMES = ['9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '5:00 PM', '7:00 PM'];

interface FormData {
  name: string; phone: string; email: string; city: string; weddingDate: string;
  days: number; guestCount: number; foodPreference: string;
  services: string[]; meals: Record<number, string[]>;
  venueType: string; consultationDate: string; preferredTime: string; message: string;
}

export default function PlanPageClient() {
  const { items, total, clearCart } = useCart();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: '', phone: '', email: '', city: 'Patna', weddingDate: '', days: 1,
    guestCount: 100, foodPreference: 'veg', services: [],
    meals: {}, venueType: '', consultationDate: '', preferredTime: '', message: '',
  });

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleService = (id: string) =>
    updateField('services', form.services.includes(id)
      ? form.services.filter((s) => s !== id)
      : [...form.services, id]);

  const toggleMeal = (day: number, meal: string) => {
    const current = form.meals[day] || [];
    updateField('meals', {
      ...form.meals,
      [day]: current.includes(meal) ? current.filter((m) => m !== meal) : [...current, meal],
    });
  };

  const toggleVenueType = (id: string) =>
    updateField('venueType', form.venueType === id ? '' : id);

  const isValidPhone = (v: string) => /^\d{10}$/.test(v.replace(/[\s\-\+\(\)]/g, ''));

  const canNext = () => {
    if (step === 0) return form.name && isValidPhone(form.phone) && form.weddingDate && form.city;
    if (step === 1) return form.services.length > 0;
    if (step === 4) return true;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          cartItems: items,
          totalBudget: total,
        }),
      });
      setSuccess(true);
      clearCart();
    } finally {
      setSubmitting(false);
    }
  };

  if (success) return (
    <div className="pt-24 min-h-screen bg-[#FFFAF5] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-10 text-center max-w-md w-full shadow-xl border border-gray-100 animate-scale-in">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3 font-[Playfair_Display,serif]">You&apos;re All Set! 🎉</h2>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Your wedding consultation has been scheduled. Our expert planner will call you on <strong>{form.consultationDate}</strong> at <strong>{form.preferredTime}</strong> to discuss your dream wedding.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-left space-y-2">
          <p className="text-sm text-gray-700"><span className="font-semibold">Name:</span> {form.name}</p>
          <p className="text-sm text-gray-700"><span className="font-semibold">Phone:</span> {form.phone}</p>
          <p className="text-sm text-gray-700"><span className="font-semibold">Date:</span> {form.consultationDate}</p>
          <p className="text-sm text-gray-700"><span className="font-semibold">Call Time:</span> {form.preferredTime}</p>
          {total > 0 && <p className="text-sm text-gray-700"><span className="font-semibold">Plan Budget:</span> ₹{total.toLocaleString('en-IN')}</p>}
        </div>
        <Link href="/" className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold px-8 py-3 rounded-full hover:opacity-90 transition-all text-sm">
          <Heart className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    </div>
  );

  return (
    <div className="pt-16 min-h-screen bg-[#FFFAF5]">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 via-rose-400 to-rose-500 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" /> Free Wedding Planning Wizard
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white font-[Playfair_Display,serif] mb-3">
            Plan Your Dream Wedding
          </h1>
          <p className="text-white/80 text-sm">Complete the wizard in 5 simple steps. Our expert planners will do the rest.</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-16 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step ? 'bg-emerald-500 text-white' :
                    i === step ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-lg' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`mt-1 text-[10px] sm:text-xs font-medium hidden sm:block ${i === step ? 'text-amber-600' : i < step ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-6 sm:w-12 mx-1 sm:mx-2 transition-all ${i < step ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Step content */}
          <div className="p-6 sm:p-8">
            {/* STEP 1: Event Details */}
            {step === 0 && (
              <div className="animate-fade-in space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">Event Details</h2>
                  <p className="text-gray-500 text-sm">Tell us about yourself and your wedding</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input required value={form.name} onChange={(e) => updateField('name', e.target.value)} className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 transition-colors" placeholder="Priya Sharma" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        required
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={form.phone}
                        onChange={(e) => updateField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className={`w-full rounded-xl pl-10 pr-4 py-3 text-sm transition-colors border ${form.phone && !isValidPhone(form.phone) ? 'border-rose-400 focus:border-rose-500' : 'border-gray-200 focus:border-amber-400'}`}
                        placeholder="10-digit mobile number"
                      />
                    </div>
                    {form.phone && !isValidPhone(form.phone) && (
                      <p className="text-xs text-rose-500 mt-1">Enter a valid 10-digit mobile number</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 transition-colors" placeholder="priya@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Your City *</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select required value={form.city} onChange={(e) => updateField('city', e.target.value)} className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 transition-colors appearance-none">
                        {CITIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Wedding Date *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input required type="date" value={form.weddingDate} onChange={(e) => updateField('weddingDate', e.target.value)} className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Number of Days</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select value={form.days} onChange={(e) => updateField('days', Number(e.target.value))} className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 transition-colors appearance-none">
                        {[1, 2, 3, 4, 5, 7].map((d) => <option key={d} value={d}>{d} Day{d > 1 ? 's' : ''}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Guest Count</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.guestCount === 0 ? '' : String(form.guestCount)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '');
                          updateField('guestCount', digits === '' ? 0 : parseInt(digits, 10));
                        }}
                        className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 transition-colors"
                        placeholder="200"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Food Preference</label>
                  <div className="flex gap-3">
                    {['veg', 'non-veg', 'both'].map((pref) => (
                      <button key={pref} onClick={() => updateField('foodPreference', pref)}
                        className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                          form.foodPreference === pref
                            ? 'border-amber-400 bg-amber-50 text-amber-700'
                            : 'border-gray-200 text-gray-500 hover:border-amber-200'
                        }`}
                      >
                        {pref === 'veg' ? '🥗 Veg' : pref === 'non-veg' ? '🍖 Non-Veg' : '🍽️ Both'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cart summary if items */}
                {items.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-amber-700 font-semibold text-sm mb-2">Your Wedding Plan Cart</p>
                    <div className="space-y-1.5 mb-2">
                      {items.map((item) => (
                        <div key={`${item.vendor.id}-${item.package.id}`} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{item.vendor.name} — {item.package.name}</span>
                          <span className="font-semibold text-amber-600">₹{item.package.price.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-amber-200 pt-2 flex justify-between font-bold text-sm">
                      <span>Total Budget</span>
                      <span className="gradient-text">₹{total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Services */}
            {step === 1 && (
              <div className="animate-fade-in space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">Select Services</h2>
                  <p className="text-gray-500 text-sm">Which services do you need for your wedding?</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SERVICES.map((s) => {
                    const selected = form.services.includes(s.id);
                    return (
                      <button key={s.id} onClick={() => toggleService(s.id)}
                        className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                          selected ? `border-amber-400 bg-amber-50` : 'border-gray-200 hover:border-amber-300 bg-white'
                        }`}
                      >
                        {selected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <div className="text-2xl mb-2">{s.icon}</div>
                        <p className={`text-sm font-semibold ${selected ? 'text-amber-700' : 'text-gray-700'}`}>{s.label}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400">{form.services.length} service{form.services.length !== 1 ? 's' : ''} selected</p>
              </div>
            )}

            {/* STEP 3: Meal Plan */}
            {step === 2 && (
              <div className="animate-fade-in space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">Meal Plan</h2>
                  <p className="text-gray-500 text-sm">Select meal requirements for each day</p>
                </div>
                <div className="space-y-4">
                  {Array.from({ length: form.days }, (_, d) => (
                    <div key={d} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <p className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                        <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                        Day {d + 1}
                        {form.weddingDate && <span className="text-gray-400 text-xs font-normal ml-1">
                          ({new Date(new Date(form.weddingDate).getTime() + d * 86400000).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })})
                        </span>}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['Breakfast', 'Lunch', 'High Tea', 'Dinner'].map((meal) => {
                          const selected = (form.meals[d] || []).includes(meal);
                          return (
                            <button key={meal} onClick={() => toggleMeal(d, meal)}
                              className={`text-xs font-semibold px-4 py-2 rounded-full border-2 transition-all ${
                                selected
                                  ? 'border-amber-400 bg-amber-500 text-white'
                                  : 'border-gray-200 text-gray-600 hover:border-amber-300 bg-white'
                              }`}
                            >{meal}</button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: Venue Preference */}
            {step === 3 && (
              <div className="animate-fade-in space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">Venue Preference</h2>
                  <p className="text-gray-500 text-sm">What type of venue best suits your vision?</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {VENUE_TYPES.map((vt) => (
                    <button key={vt.id} onClick={() => toggleVenueType(vt.id)}
                      className={`relative p-4 rounded-2xl border-2 text-center transition-all ${
                        form.venueType === vt.id
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-gray-200 bg-white hover:border-amber-300'
                      }`}
                    >
                      {form.venueType === vt.id && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      <div className="text-3xl mb-2">{vt.icon}</div>
                      <p className={`text-xs font-semibold ${form.venueType === vt.id ? 'text-amber-700' : 'text-gray-700'}`}>{vt.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{vt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5: Consultation */}
            {step === 4 && (
              <div className="animate-fade-in space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">Schedule Consultation</h2>
                  <p className="text-gray-500 text-sm">Pick a time for a free call with our wedding expert</p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-200 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-rose-500 rounded-2xl flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">Free 30-Minute Expert Call</p>
                      <p className="text-gray-500 text-xs">Get personalized vendor recommendations</p>
                    </div>
                  </div>

                  {/* Date picker */}
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Preferred Date <span className="text-gray-400 font-normal normal-case">(optional)</span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={form.consultationDate}
                        onChange={(e) => updateField('consultationDate', e.target.value)}
                        className="w-full border border-amber-200 bg-white rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Time picker */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Preferred Time <span className="text-gray-400 font-normal normal-case">(optional)</span>
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="time"
                        value={form.preferredTime}
                        onChange={(e) => updateField('preferredTime', e.target.value)}
                        className="w-full border border-amber-200 bg-white rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Additional Notes</label>
                  <textarea rows={4} value={form.message} onChange={(e) => updateField('message', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-amber-400 transition-colors resize-none" placeholder="Any specific requirements, theme ideas, or questions for our expert..." />
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <h4 className="font-bold text-gray-800 text-sm mb-3">Your Wedding Plan Summary</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between"><span>Name</span><span className="font-medium text-gray-900">{form.name}</span></div>
                    <div className="flex justify-between"><span>Wedding Date</span><span className="font-medium text-gray-900">{form.weddingDate || 'Not set'}</span></div>
                    <div className="flex justify-between"><span>Duration</span><span className="font-medium text-gray-900">{form.days} day{form.days > 1 ? 's' : ''}</span></div>
                    <div className="flex justify-between"><span>Guests</span><span className="font-medium text-gray-900">{form.guestCount}</span></div>
                    <div className="flex justify-between"><span>Services</span><span className="font-medium text-gray-900">{form.services.length} selected</span></div>
                    {form.venueType && <div className="flex justify-between"><span>Venue Type</span><span className="font-medium text-gray-900 capitalize">{form.venueType.replace(/-/g, ' ')}</span></div>}
                    {form.consultationDate && <div className="flex justify-between"><span>Consultation Date</span><span className="font-medium text-gray-900">{form.consultationDate}</span></div>}
                    {total > 0 && <div className="flex justify-between border-t border-gray-200 pt-2 mt-2"><span className="font-semibold">Cart Total</span><span className="font-bold gradient-text">₹{total.toLocaleString('en-IN')}</span></div>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="border-t border-gray-100 px-6 sm:px-8 py-5 flex items-center justify-between bg-gray-50">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div className="flex items-center gap-2">
              {STEPS.map((_, i) => (
                <div key={i} className={`rounded-full transition-all ${i === step ? 'w-5 h-2 bg-amber-500' : i < step ? 'w-2 h-2 bg-emerald-400' : 'w-2 h-2 bg-gray-200'}`} />
              ))}
            </div>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => { if (canNext()) setStep((s) => s + 1); }}
                disabled={!canNext()}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !canNext()}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : <><Sparkles className="w-4 h-4" /> Confirm Plan</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
