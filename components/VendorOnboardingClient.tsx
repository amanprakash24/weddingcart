'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowLeft, Sparkles, Phone, Mail, MapPin, Briefcase, IndianRupee, Star, AtSign, Globe, ChevronDown } from 'lucide-react';
import { Category } from '@/types';

const CITIES = [
  'Patna', 'Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad',
  'Jaipur', 'Lucknow', 'Ahmedabad', 'Pune', 'Surat', 'Chandigarh', 'Indore',
  'Bhopal', 'Nagpur', 'Varanasi', 'Agra', 'Meerut', 'Ranchi',
];

const EXPERIENCE_OPTIONS = [
  'Less than 1 year', '1–2 years', '3–5 years', '5–10 years', '10+ years',
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

function stagger(children = 0.1, delay = 0) {
  return { hidden: {}, show: { transition: { staggerChildren: children, delayChildren: delay } } };
}

const EMPTY_FORM = {
  businessName: '',
  ownerName:    '',
  ownerPhone:   '',
  ownerEmail:   '',
  category:     '',
  city:         '',
  priceMin:     '',
  priceMax:     '',
  experience:   '',
  description:  '',
  instagram:    '',
  website:      '',
};

export default function VendorOnboardingClient() {
  const [form, setForm]             = useState(EMPTY_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => { if (d.success) setCategories(d.data); });
  }, []);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/vendor-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          priceMin: Number(form.priceMin) || 0,
          priceMax: Number(form.priceMax) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-rose-50 flex items-center justify-center px-4">
        <motion.div
          className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3 font-[Playfair_Display,serif]">
            Application Submitted!
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Thank you for applying to join ShaadiShopping as a vendor. Our team will review your details and get back to you within <strong>2–3 business days</strong>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-8 py-3.5 rounded-full font-semibold text-sm hover:opacity-90 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-rose-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-950 to-gray-800 py-14 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 80% 50%, #f43f5e 0%, transparent 50%)' }}
        />
        <motion.div
          className="relative z-10 max-w-2xl mx-auto"
          initial="hidden"
          animate="show"
          variants={stagger(0.15, 0.1)}
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white px-4 py-1.5 rounded-full text-sm mb-4">
            <Sparkles className="w-4 h-4 text-amber-300" /> Vendor Partnership
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-white mb-3 font-[Playfair_Display,serif]">
            Grow Your Business with <span className="text-amber-400">ShaadiShopping</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="text-white/70 text-sm">
            Reach thousands of couples planning their dream wedding. Fill in your details below and our team will onboard you.
          </motion.p>
        </motion.div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <motion.form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-8"
          initial="hidden"
          animate="show"
          variants={stagger(0.08, 0.2)}
        >
          {/* Business Info */}
          <motion.div variants={fadeUp}>
            <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-amber-600" />
              </div>
              Business Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Business / Brand Name <span className="text-rose-500">*</span></label>
                <input
                  required
                  value={form.businessName}
                  onChange={(e) => set('businessName', e.target.value)}
                  placeholder="e.g. Royal Wedding Photography"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <select
                    required
                    value={form.category}
                    onChange={(e) => set('category', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 appearance-none bg-white"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">City <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <select
                    required
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 appearance-none bg-white"
                  >
                    <option value="">Select city</option>
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Years of Experience</label>
                <div className="relative">
                  <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <select
                    value={form.experience}
                    onChange={(e) => set('experience', e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 appearance-none bg-white"
                  >
                    <option value="">Select experience</option>
                    {EXPERIENCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Starting Price (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="number"
                    min="0"
                    value={form.priceMin}
                    onChange={(e) => set('priceMin', e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Maximum Price (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="number"
                    min="0"
                    value={form.priceMax}
                    onChange={(e) => set('priceMax', e.target.value)}
                    placeholder="e.g. 100000"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">About Your Business</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Describe your services, specialities, and what makes you unique..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                />
              </div>
            </div>
          </motion.div>

          {/* Contact Info */}
          <motion.div variants={fadeUp}>
            <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
              <div className="w-7 h-7 bg-rose-100 rounded-lg flex items-center justify-center">
                <Phone className="w-4 h-4 text-rose-500" />
              </div>
              Contact Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Owner / Contact Name <span className="text-rose-500">*</span></label>
                <input
                  required
                  value={form.ownerName}
                  onChange={(e) => set('ownerName', e.target.value)}
                  placeholder="Full name"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    required
                    type="tel"
                    value={form.ownerPhone}
                    onChange={(e) => set('ownerPhone', e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    required
                    type="email"
                    value={form.ownerEmail}
                    onChange={(e) => set('ownerEmail', e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Instagram Handle</label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    value={form.instagram}
                    onChange={(e) => set('instagram', e.target.value)}
                    placeholder="@yourbusiness"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Website URL</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => set('website', e.target.value)}
                    placeholder="https://yourbusiness.com"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {error && (
            <motion.p variants={fadeUp} className="text-rose-500 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              {error}
            </motion.p>
          )}

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold px-8 py-4 rounded-2xl hover:opacity-90 transition-all hover:shadow-lg disabled:opacity-60 text-sm"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
            <Link
              href="/"
              className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 px-6 py-4 rounded-2xl text-sm font-medium hover:bg-gray-50 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>
          </motion.div>

          <motion.p variants={fadeUp} className="text-center text-gray-400 text-xs">
            By submitting, you agree to our terms. Our team will review and contact you within 2–3 business days.
          </motion.p>
        </motion.form>
      </div>
    </div>
  );
}
