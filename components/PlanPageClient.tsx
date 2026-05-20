'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { User, Phone, Mail, Calendar, Users, UtensilsCrossed, Building2, CheckCircle, ChevronRight, ChevronLeft, Sparkles, Heart, Clock, X, MapPin } from 'lucide-react';
import WeddingDashboardClient from '@/components/WeddingDashboardClient';

const CITIES = ['Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa'];
import { useCart } from '@/context/CartContext';

const STEPS = ['Event Details', 'Services', 'Hospitality', 'Celebration', 'Consultation'];

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
  days: number; guestCount: number; foodPreference: string; weddingStyle: string;
  budgetRange: string;
  services: string[]; meals: Record<number, string[]>;
  venueType: string; consultationDate: string; preferredTime: string; message: string;
}

export default function PlanPageClient() {
  const { items, total, clearCart } = useCart();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [devOtpCode, setDevOtpCode] = useState('');
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: '', phone: '', email: '', city: 'Patna', weddingDate: '', days: 1,
    guestCount: 100, foodPreference: 'veg', weddingStyle: '', budgetRange: '',
    services: [], meals: {}, venueType: '', consultationDate: '', preferredTime: '', message: '',
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

  const maskPhone = (p: string) => p.slice(0, 2) + 'XXXXXX' + p.slice(-2);

  const handleOtpInput = (value: string, idx: number) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[idx] = digit;
    setOtpDigits(next);
    setOtpError('');
    if (digit && idx < 5) otpInputRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) otpInputRefs.current[idx - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = pasted.padEnd(6, '').split('').slice(0, 6);
    setOtpDigits(next);
    otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const sendOtp = async () => {
    setOtpLoading(true);
    setOtpError('');
    setDevOtpCode('');
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone }),
      });
      const data = await res.json();
      if (data.devCode) setDevOtpCode(data.devCode);
      setResendTimer(30);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 80);
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    const code = otpDigits.join('');
    if (code.length < 6) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone, code }),
      });
      if (res.ok) {
        setOtpVerified(true);
        setShowOtpModal(false);
        setStep(4);
      } else {
        const data = await res.json();
        setOtpError(data.message || 'Invalid OTP. Please try again.');
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 50);
      }
    } finally {
      setOtpLoading(false);
    }
  };

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

  if (success) return <WeddingDashboardClient form={form} cartTotal={total} />;

  return (
    <div className="pt-16 min-h-screen bg-[#FFFAF5]">
      {/* Header */}
      <div className="py-12 sm:py-16" style={{ background: '#8B1A4A' }}>
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
                    i === step ? 'bg-[#8B1A4A] text-white shadow-lg' :
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
                  <h2 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">Let&apos;s Begin Your Wedding Journey</h2>
                  <p className="text-gray-500 text-sm">Tell us about yourself and your dream wedding</p>
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
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Wedding Style</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[
                      { id: 'traditional', label: 'Traditional', icon: '🪔' },
                      { id: 'luxury', label: 'Luxury', icon: '👑' },
                      { id: 'royal', label: 'Royal', icon: '🏰' },
                      { id: 'destination', label: 'Destination', icon: '✈️' },
                      { id: 'intimate', label: 'Intimate', icon: '🌸' },
                      { id: 'modern', label: 'Modern', icon: '✨' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        onClick={() => updateField('weddingStyle', form.weddingStyle === style.id ? '' : style.id)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                          form.weddingStyle === style.id
                            ? 'border-[#8B1A4A] bg-rose-50 text-[#8B1A4A]'
                            : 'border-gray-200 text-gray-600 hover:border-rose-300'
                        }`}
                      >
                        <span className="text-xl">{style.icon}</span>
                        {style.label}
                      </button>
                    ))}
                  </div>
                  {form.weddingStyle && (
                    <p className="text-xs text-amber-600 mt-2 font-medium">
                      {form.weddingStyle === 'intimate' && '✨ Perfect for an intimate, close-knit celebration with your loved ones.'}
                      {form.weddingStyle === 'destination' && '✈️ Great choice for a destination-style celebration — we handle the logistics.'}
                      {form.weddingStyle === 'luxury' && '👑 We work with premium vendors to create an extraordinary luxury experience.'}
                      {form.weddingStyle === 'royal' && '🏰 Royal-style weddings deserve royal coordination — we\'re here for it.'}
                      {form.weddingStyle === 'traditional' && '🪔 Beautiful traditional wedding values — we honour every custom and ritual.'}
                      {form.weddingStyle === 'modern' && '✨ A modern, stylish celebration crafted around your unique vision.'}
                    </p>
                  )}
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

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Total Wedding Budget *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'under-5L',  label: 'Under ₹5 Lakh',   icon: '💰' },
                      { id: '5-10L',     label: '₹5 – 10 Lakh',    icon: '💰' },
                      { id: '10-20L',    label: '₹10 – 20 Lakh',   icon: '💎' },
                      { id: '20-50L',    label: '₹20 – 50 Lakh',   icon: '💎' },
                      { id: '50L-1Cr',   label: '₹50L – 1 Crore',  icon: '👑' },
                      { id: 'above-1Cr', label: 'Above ₹1 Crore',  icon: '🏆' },
                    ].map((b) => (
                      <button
                        key={b.id}
                        onClick={() => updateField('budgetRange', b.id)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          form.budgetRange === b.id
                            ? 'border-[#8B1A4A] bg-rose-50 text-[#8B1A4A]'
                            : 'border-gray-200 text-gray-600 hover:border-rose-300'
                        }`}
                      >
                        <span>{b.icon}</span>
                        <span>{b.label}</span>
                      </button>
                    ))}
                  </div>
                  {!form.budgetRange && (
                    <p className="text-xs text-gray-400 mt-2">Selecting a budget helps us recommend the right vendors for you.</p>
                  )}
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
                  <h2 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">What Would You Like Help With?</h2>
                  <p className="text-gray-500 text-sm">Choose the services you need — we&apos;ll coordinate everything for you</p>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400">{form.services.length} service{form.services.length !== 1 ? 's' : ''} selected</p>
                  <button
                    onClick={() => {
                      const recommended = ['venue', 'catering', 'photo-video', 'decorator', 'makeup', 'mehndi'];
                      updateField('services', recommended);
                    }}
                    className="text-xs text-amber-600 font-semibold border border-amber-300 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-full transition-all"
                  >
                    ✨ Recommend for me
                  </button>
                </div>
                {form.services.length > 0 && (
                  <p className="text-xs text-amber-600 mb-3 font-medium">Most couples with similar weddings select these services.</p>
                )}
                <div className="space-y-5">
                  {[
                    { group: '📋 Planning & Coordination', ids: ['planning', 'hospitality', 'legal'] },
                    { group: '🏛️ Venue & Experience', ids: ['venue', 'accommodation', 'transport'] },
                    { group: '🍽️ Food & Entertainment', ids: ['catering', 'dj', 'band'] },
                    { group: '💄 Beauty & Fashion', ids: ['makeup', 'mehndi', 'bridal-lehenga', 'bridal-jewellery', 'sherwani', 'trousseau'] },
                    { group: '📸 Decor & Media', ids: ['decorator', 'photo-video', 'invitations', 'gifts'] },
                  ].map((groupItem) => (
                    <div key={groupItem.group}>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{groupItem.group}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {SERVICES.filter((s) => groupItem.ids.includes(s.id)).map((s) => {
                          const selected = form.services.includes(s.id);
                          return (
                            <button key={s.id} onClick={() => toggleService(s.id)}
                              className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                                selected ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-300 bg-white'
                              }`}
                            >
                              {selected && (
                                <div className="absolute top-2 right-2 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                                  <CheckCircle className="w-3 h-3 text-white" />
                                </div>
                              )}
                              <div className="text-xl mb-1">{s.icon}</div>
                              <p className={`text-xs font-semibold leading-tight ${selected ? 'text-amber-700' : 'text-gray-700'}`}>{s.label}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: Meal Plan */}
            {step === 2 && (
              <div className="animate-fade-in space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">Wedding Hospitality Planning</h2>
                  <p className="text-gray-500 text-sm">Select meal requirements for each wedding event</p>
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2">
                    💡 We use this information to estimate catering and hospitality requirements for your wedding.
                  </p>
                </div>
                <div className="space-y-4">
                  {[
                    { id: 0, name: 'Mehndi', icon: '🌿', desc: 'Mehndi ceremony' },
                    { id: 1, name: 'Haldi', icon: '💛', desc: 'Haldi ceremony' },
                    { id: 2, name: 'Sangeet', icon: '🎵', desc: 'Sangeet night' },
                    { id: 3, name: 'Wedding', icon: '💍', desc: 'Main wedding ceremony' },
                    { id: 4, name: 'Reception', icon: '🎊', desc: 'Wedding reception' },
                  ].map((event) => (
                    <div key={event.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                          <span className="text-lg">{event.icon}</span>
                          {event.name}
                          <span className="text-gray-400 text-xs font-normal">{event.desc}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['Breakfast', 'Lunch', 'High Tea', 'Dinner'].map((meal) => {
                          const selected = (form.meals[event.id] || []).includes(meal);
                          return (
                            <button key={meal} onClick={() => toggleMeal(event.id, meal)}
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
                  <h2 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">What Kind Of Celebration Do You Envision?</h2>
                  <p className="text-gray-500 text-sm">Choose a venue style that matches your dream wedding</p>
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
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Setting Preference</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'indoor', label: 'Indoor', icon: '🏛️', desc: 'AC & covered' },
                      { id: 'outdoor', label: 'Outdoor', icon: '🌳', desc: 'Open air & natural' },
                      { id: 'both', label: 'Both', icon: '⚖️', desc: 'Mix of both' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => updateField('venueType', form.venueType === opt.id ? '' : opt.id)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          form.venueType === opt.id ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-300 bg-white'
                        }`}
                      >
                        <div className="text-2xl mb-1">{opt.icon}</div>
                        <p className={`text-xs font-bold ${form.venueType === opt.id ? 'text-amber-700' : 'text-gray-700'}`}>{opt.label}</p>
                        <p className="text-[10px] text-gray-400">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-800 mb-2">📊 Venue Capacity Guide</p>
                  <div className="space-y-1 text-xs text-blue-700">
                    <p>🏛️ <strong>Banquet Hall</strong> — Best for 100–400 guests</p>
                    <p>🌾 <strong>Farmhouse / Lawn</strong> — Perfect for open-air, 200–800 guests</p>
                    <p>🏰 <strong>Palace / Heritage</strong> — Ideal for 150–500 guests, royal feel</p>
                    <p>🌴 <strong>Resort</strong> — Great for destination weddings, 100–300 guests</p>
                    <p>🏖️ <strong>Beach Venue</strong> — Romantic setting for 50–200 guests</p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Consultation */}
            {step === 4 && (
              <div className="animate-fade-in space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">Speak With Your Wedding Expert</h2>
                  <p className="text-gray-500 text-sm">Book your free 30-minute strategy call — we&apos;ll coordinate your entire wedding</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-rose-100 flex items-center justify-center text-2xl flex-shrink-0">
                    👨‍💼
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900 text-sm">Your Dedicated Wedding Consultant</p>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Available</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">500+ weddings coordinated · Responds within 24 hours</p>
                    <p className="text-xs text-amber-700 italic font-medium">&quot;We&apos;ll help coordinate your complete wedding stress-free — from first call to your special day.&quot;</p>
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#8B1A4A' }}>
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
                onClick={() => {
                if (!canNext()) return;
                if (step === 3 && !otpVerified) {
                  sendOtp();
                  setShowOtpModal(true);
                  return;
                }
                setStep((s) => s + 1);
              }}
                disabled={!canNext()}
                className="flex items-center gap-2 bg-[#8B1A4A] text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !canNext()}
                className="flex items-center gap-2 bg-[#8B1A4A] text-white px-6 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : <><Sparkles className="w-4 h-4" /> Confirm Plan</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── OTP Verification Modal ── */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">

            {/* Icon + heading */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#25D366' }}>
                <span className="text-3xl">💬</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">
                Verify via WhatsApp
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                We&apos;ve sent a 6-digit OTP on <span className="font-semibold text-[#25D366]">WhatsApp</span> to<br />
                <span className="font-semibold text-gray-900">+91 {maskPhone(form.phone)}</span>
              </p>
            </div>

            {/* 6 digit inputs */}
            <div className="flex gap-2 justify-center mb-3">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpInputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpInput(e.target.value, i)}
                  onKeyDown={(e) => handleOtpKeyDown(e, i)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  className={`w-11 h-12 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all ${
                    otpError
                      ? 'border-rose-400 bg-rose-50 text-rose-600'
                      : digit
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-gray-200 focus:border-amber-400'
                  }`}
                />
              ))}
            </div>

            {/* Dev mode OTP hint */}
            {devOtpCode && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-3 text-center">
                <p className="text-xs text-amber-600 font-medium mb-0.5">Dev mode (WhatsApp not configured)</p>
                <p className="text-base font-bold text-amber-800 tracking-widest">{devOtpCode}</p>
              </div>
            )}

            {/* Error message */}
            {otpError && (
              <p className="text-center text-rose-500 text-xs mb-3">{otpError}</p>
            )}

            {/* Verify button */}
            <button
              onClick={verifyOtp}
              disabled={otpDigits.some((d) => !d) || otpLoading}
              className="w-full text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 mb-3 text-sm mt-2"
              style={{ background: otpDigits.some((d) => !d) || otpLoading ? '#a3d9b1' : '#25D366' }}
            >
              {otpLoading ? 'Verifying…' : '✓ Verify & Continue'}
            </button>

            {/* Resend + cancel */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              {resendTimer > 0 ? (
                <span>Resend in <span className="font-semibold text-amber-600">{resendTimer}s</span></span>
              ) : (
                <button
                  onClick={sendOtp}
                  disabled={otpLoading}
                  className="text-amber-600 font-semibold hover:underline disabled:opacity-50"
                >
                  Resend OTP
                </button>
              )}
              <button
                onClick={() => setShowOtpModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
