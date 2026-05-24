'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';
import Image from 'next/image';

const STORAGE_KEY = 'ss_lead_dismissed';
const DISMISS_DAYS = 7;

const WhatsAppIcon = () => (
  <svg viewBox="0 0 32 32" className="w-4 h-4 fill-[#25D366] flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 2C8.28 2 2 8.28 2 16c0 2.46.67 4.76 1.83 6.74L2 30l7.45-1.79A13.93 13.93 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5a11.44 11.44 0 0 1-5.83-1.6l-.42-.25-4.42 1.06 1.1-4.3-.28-.44A11.47 11.47 0 0 1 4.5 16C4.5 9.6 9.6 4.5 16 4.5S27.5 9.6 27.5 16 22.4 27.5 16 27.5zm6.3-8.57c-.34-.17-2.03-1-2.35-1.12-.32-.11-.55-.17-.78.17-.23.34-.9 1.12-1.1 1.35-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.02-1.9-2.36-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59H9.8c-.2 0-.54.07-.82.37-.28.3-1.08 1.06-1.08 2.58s1.1 2.99 1.26 3.2c.16.2 2.17 3.32 5.26 4.65.74.32 1.31.51 1.76.65.74.23 1.41.2 1.94.12.59-.09 1.82-.74 2.07-1.46.26-.72.26-1.34.18-1.46-.07-.12-.28-.2-.62-.37z"/>
  </svg>
);

export default function LeadCapturePopup() {
  const [visible, setVisible] = useState(false);
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const until = Number(dismissed);
      if (Date.now() < until) return;
    }
    const t = setTimeout(() => setVisible(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = (permanent = false) => {
    const days = permanent ? 365 : DISMISS_DAYS;
    localStorage.setItem(STORAGE_KEY, String(Date.now() + days * 86400000));
    setVisible(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setError('Please enter a valid 10-digit mobile number.'); return; }
    setLoading(true);
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `+91${digits}`, whatsapp }),
      });
      setSubmitted(true);
      setTimeout(() => dismiss(), 2500);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4" style={{ background: 'rgba(28,18,8,0.55)' }}>
      <div
        className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.28)]"
        style={{ animation: 'slideUp 0.35s cubic-bezier(0.22,1,0.36,1)' }}
      >
        {/* Close button */}
        <button
          onClick={() => dismiss()}
          className="absolute top-4 right-4 z-10 w-7 h-7 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div
          className="px-8 pt-8 pb-6 text-center"
          style={{ background: 'linear-gradient(135deg, #2A1F1B 0%, #8B1A4A 100%)' }}
        >
          <div className="inline-flex mb-4">
            <Image src="/logo.png" alt="ShaadiShopping" width={160} height={50} className="h-10 w-auto object-contain brightness-0 invert" />
          </div>
          <h2 className="text-white font-semibold text-lg leading-snug" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
            India&apos;s Expert Wedding Platform
          </h2>
          <p className="text-white/70 text-sm mt-1.5">
            Share your number & get a <span className="text-[#C5A46D] font-semibold">free consultation</span> with our wedding expert
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <p className="font-semibold text-gray-800">Thank you! We&apos;ll be in touch shortly.</p>
              <p className="text-sm text-gray-400">Our wedding expert will call you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#C5A46D]/40 focus-within:border-[#C5A46D] transition-all">
                  <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 border-r border-gray-200 flex-shrink-0">
                    <span className="text-lg">🇮🇳</span>
                    <span className="text-sm font-semibold text-gray-600">+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter your mobile number"
                    className="flex-1 px-4 py-3 text-sm bg-white outline-none text-gray-800 placeholder:text-gray-400"
                  />
                </div>
                {error && <p className="text-rose-500 text-xs mt-1.5">{error}</p>}
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setWhatsapp((v) => !v)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0 ${whatsapp ? 'bg-[#25D366] border-[#25D366]' : 'border-gray-300'}`}
                >
                  {whatsapp && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  Send me wedding details on <WhatsAppIcon /> <span className="font-medium">WhatsApp</span>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#8B1A4A] text-white font-bold py-3.5 rounded-xl hover:bg-[#7A1640] transition-all hover:shadow-lg disabled:opacity-60 tracking-wide text-sm"
              >
                {loading ? 'Submitting…' : 'Get Free Consultation'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-5 flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-[0.7rem] text-gray-400">
            By submitting, you agree to our{' '}
            <a href="#" className="underline hover:text-[#8B1A4A] transition-colors">Terms & Conditions</a>
          </p>
          <button
            onClick={() => dismiss(true)}
            className="text-[0.68rem] text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap ml-4 flex-shrink-0"
          >
            Don&apos;t show again
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
