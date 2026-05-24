'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Phone, ArrowRight, RefreshCw, LogOut, MapPin, Star, Mail, Package, MessageSquare, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Enquiry {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  eventDate?: string;
  guestCount?: string;
  message?: string;
  status: 'new' | 'contacted' | 'closed';
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  category: string;
  city: string;
  priceMin: number;
  priceMax: number;
  rating: number;
  reviewCount: number;
  image: string;
  description: string;
  isFeatured: boolean;
  packages: { id: string; name: string; price: number; description: string }[];
}

type Step = 'phone' | 'otp' | 'dashboard';

const STATUS_CONFIG = {
  new:       { label: 'New',       icon: MessageSquare, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  contacted: { label: 'Contacted', icon: Clock,         color: 'bg-amber-50 text-amber-600 border-amber-200' },
  closed:    { label: 'Closed',    icon: XCircle,       color: 'bg-gray-50 text-gray-500 border-gray-200' },
};

export default function VendorLoginClient() {
  const [step, setStep]         = useState<Step>('phone');
  const [phone, setPhone]       = useState('');
  const [otp, setOtp]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [vendor, setVendor]     = useState<Vendor | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [devCode, setDevCode]   = useState('');

  const isValidPhone = (v: string) => /^\d{10}$/.test(v);

  const startResendTimer = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    if (!isValidPhone(phone)) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message || 'Failed to send OTP'); return; }
      if (data.devCode) setDevCode(data.devCode);
      setStep('otp');
      startResendTimer();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/vendor-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }
      setVendor(data.vendor);
      setEnquiries(data.enquiries || []);
      setStep('dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setStep('phone');
    setPhone('');
    setOtp('');
    setVendor(null);
    setEnquiries([]);
    setError('');
    setDevCode('');
  };

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (step === 'dashboard' && vendor) {
    const newCount       = enquiries.filter((e) => e.status === 'new').length;
    const contactedCount = enquiries.filter((e) => e.status === 'contacted').length;

    return (
      <div className="min-h-screen bg-[#FFFAF5] pt-24 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="bg-gradient-to-r from-[#8B1A4A] to-[#C5A46D] rounded-2xl p-6 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/20 flex-shrink-0">
                {vendor.image
                  ? <Image src={vendor.image} alt={vendor.name} width={56} height={56} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">{vendor.name[0]}</div>
                }
              </div>
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Vendor Dashboard</p>
                <h1 className="text-white font-bold text-xl font-[Playfair_Display,serif]">{vendor.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-white/70 text-xs capitalize">{vendor.category.replace(/-/g, ' ')}</span>
                  <span className="text-white/40">·</span>
                  <span className="flex items-center gap-1 text-white/70 text-xs"><MapPin className="w-3 h-3" />{vendor.city}</span>
                  <span className="text-white/40">·</span>
                  <span className="flex items-center gap-1 text-white/70 text-xs"><Star className="w-3 h-3 fill-amber-300 text-amber-300" />{vendor.rating}</span>
                </div>
              </div>
            </div>
            <button onClick={logout} className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Enquiries', value: enquiries.length, color: 'text-[#8B1A4A]' },
              { label: 'New',             value: newCount,         color: 'text-blue-600' },
              { label: 'Contacted',       value: contactedCount,   color: 'text-amber-600' },
              { label: 'Packages',        value: vendor.packages?.length ?? 0, color: 'text-emerald-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-gray-500 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Enquiries list */}
            <div className="lg:col-span-2">
              <h2 className="font-bold text-gray-900 mb-3 font-[Playfair_Display,serif]">Recent Enquiries</h2>
              {enquiries.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                  <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No enquiries yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {enquiries.map((enq) => {
                    const cfg = STATUS_CONFIG[enq.status] ?? STATUS_CONFIG.new;
                    const StatusIcon = cfg.icon;
                    return (
                      <div key={enq._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-900 text-sm">{enq.name}</p>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                                <StatusIcon className="w-2.5 h-2.5" />{cfg.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{enq.phone}</span>
                              {enq.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{enq.email}</span>}
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{enq.city}</span>
                              {enq.eventDate && <span>Event: {enq.eventDate}</span>}
                              {enq.guestCount && <span>Guests: {enq.guestCount}</span>}
                            </div>
                            {enq.message && (
                              <p className="text-gray-400 text-xs mt-1.5 line-clamp-2">{enq.message}</p>
                            )}
                          </div>
                          <p className="text-gray-300 text-[10px] flex-shrink-0">{new Date(enq.createdAt).toLocaleDateString('en-IN')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sidebar: Profile + Packages */}
            <div className="space-y-4">
              {/* Profile card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 text-sm mb-3">Business Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Owner</span><span className="font-medium text-gray-800">{vendor.ownerName || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="font-medium text-gray-800">{vendor.ownerPhone}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium text-gray-800 truncate ml-2">{vendor.ownerEmail || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Price</span><span className="font-medium text-gray-800">₹{vendor.priceMin?.toLocaleString('en-IN')} – ₹{vendor.priceMax?.toLocaleString('en-IN')}</span></div>
                  {vendor.isFeatured && (
                    <div className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold pt-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Featured Vendor
                    </div>
                  )}
                </div>
                <Link href={`/vendors/${vendor.id}`} className="mt-4 flex items-center justify-center gap-1.5 w-full border border-[#8B1A4A]/30 text-[#8B1A4A] text-xs font-semibold py-2.5 rounded-xl hover:bg-[#8B1A4A] hover:text-white transition-all">
                  View Public Profile <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Packages */}
              {vendor.packages?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-1.5"><Package className="w-4 h-4 text-[#C5A46D]" /> Your Packages</h3>
                  <div className="space-y-2">
                    {vendor.packages.map((pkg) => (
                      <div key={pkg.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                        <span className="text-gray-700 text-xs font-medium">{pkg.name}</span>
                        <span className="text-[#8B1A4A] text-xs font-bold">₹{pkg.price?.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Support note */}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                <CheckCircle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                <p className="text-amber-800 text-xs font-semibold mb-1">Need to update your profile?</p>
                <p className="text-amber-600 text-xs">Contact our team and we&apos;ll make changes for you.</p>
                <a href="tel:+917646028228" className="mt-3 inline-flex items-center gap-1.5 bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-all">
                  <Phone className="w-3 h-3" /> Call Support
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── Login form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FFFAF5] pt-24 pb-12 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">

          {/* Header */}
          <div className="bg-gradient-to-r from-[#8B1A4A] to-[#C5A46D] px-8 pt-8 pb-6 text-center">
            <div className="bg-white rounded-2xl px-5 py-3 inline-flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Image src="/logo.png" alt="ShaadiShopping" width={120} height={75} className="object-contain h-10 w-auto" />
            </div>
            <h1 className="text-xl font-bold text-white font-[Playfair_Display,serif]">Vendor Login</h1>
            <p className="text-white/75 text-xs mt-1">Access your dashboard & manage enquiries</p>
          </div>

          <div className="px-8 py-7">
            {step === 'phone' && (
              <>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Registered Phone Number
                </label>
                <div className="relative mb-4">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                    placeholder="10-digit mobile number"
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm bg-gray-50 focus:bg-white focus:border-[#8B1A4A] outline-none transition-colors"
                  />
                </div>

                {error && <p className="text-rose-500 text-xs mb-3">{error}</p>}

                <button
                  onClick={sendOtp}
                  disabled={!isValidPhone(phone) || loading}
                  className="w-full bg-gradient-to-r from-[#8B1A4A] to-[#C5A46D] text-white font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
                </button>
              </>
            )}

            {step === 'otp' && (
              <>
                <p className="text-gray-600 text-sm mb-1">OTP sent to <span className="font-semibold text-gray-900">+91 {phone}</span></p>
                <p className="text-gray-400 text-xs mb-5">Check your WhatsApp for the 6-digit code</p>

                {devCode && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-center">
                    <p className="text-blue-600 text-xs font-semibold">Dev mode — OTP: <span className="text-lg font-bold">{devCode}</span></p>
                  </div>
                )}

                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Enter OTP</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  placeholder="6-digit OTP"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white focus:border-[#8B1A4A] outline-none transition-colors text-center tracking-[0.5em] text-lg font-bold mb-4"
                />

                {error && <p className="text-rose-500 text-xs mb-3">{error}</p>}

                <button
                  onClick={verifyOtp}
                  disabled={otp.length !== 6 || loading}
                  className="w-full bg-gradient-to-r from-[#8B1A4A] to-[#C5A46D] text-white font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 mb-3"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Verify & Login <ArrowRight className="w-4 h-4" /></>}
                </button>

                <div className="flex items-center justify-between text-xs">
                  <button onClick={() => { setStep('phone'); setOtp(''); setError(''); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                    ← Change number
                  </button>
                  {resendTimer > 0
                    ? <span className="text-gray-400">Resend in {resendTimer}s</span>
                    : <button onClick={sendOtp} disabled={loading} className="text-[#8B1A4A] font-semibold hover:opacity-75 transition-opacity">Resend OTP</button>
                  }
                </div>
              </>
            )}
          </div>
        </div>

        {/* Register link */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Not registered yet?{' '}
          <Link href="/vendor-onboarding" className="text-[#8B1A4A] font-semibold hover:underline">
            Register as a Vendor
          </Link>
        </p>

      </div>
    </div>
  );
}
