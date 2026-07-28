'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Phone, ShieldCheck, Sparkles } from 'lucide-react';

// Shared by /vendor/login and /customer/login — the underlying auth call is
// identical (NextAuth's 'otp' credentials provider looks the phone number up
// and returns whatever roles that User already has; there's no "log in as
// vendor" vs "log in as customer" distinction at sign-in time). Only the
// copy and post-login destination differ per portal.
export default function OtpLoginClient({
  portalName,
  redirectPath,
}: {
  portalName: string;
  redirectPath: string;
}) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Failed to send OTP.');
        return;
      }
      setDevCode(data.devCode ?? null);
      setStage('code');
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signIn('otp', { phone, code, redirect: false });
      if (res?.ok) {
        window.location.href = redirectPath;
      } else {
        setError('Invalid or expired code. Please try again.');
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFAF5] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-5 py-2.5 rounded-full text-sm font-bold mb-4 shadow-lg">
            <Sparkles className="w-4 h-4" />
            ShaadiShopping
          </div>
          <h1 className="text-3xl font-bold text-gray-900 font-[Playfair_Display,serif]">{portalName} Login</h1>
          <p className="text-gray-500 text-sm mt-1">
            {stage === 'phone' ? "We'll text you a verification code" : `Enter the code sent to +91 ${phone}`}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          {stage === 'phone' ? (
            <form onSubmit={handleSendCode} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    required
                    pattern="\d{10}"
                    autoComplete="tel"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || phone.length !== 10}
                className="w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-all shadow-lg disabled:opacity-60 text-sm"
              >
                {loading ? 'Sending…' : 'Send Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Verification Code</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    required
                    pattern="\d{6}"
                    autoComplete="one-time-code"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-gray-50 focus:bg-white"
                  />
                </div>
                {devCode && (
                  <p className="text-xs text-gray-400 mt-1.5">Dev mode — code: {devCode}</p>
                )}
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-all shadow-lg disabled:opacity-60 text-sm"
              >
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>

              <button
                type="button"
                onClick={() => { setStage('phone'); setCode(''); setError(''); }}
                className="w-full text-gray-500 hover:text-gray-700 text-sm text-center"
              >
                Use a different number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
