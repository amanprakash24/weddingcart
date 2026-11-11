'use client';

import { useState } from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { KeyRound, Phone } from 'lucide-react';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';
import { VivahOsMark } from '@/components/vivah-os/VivahOsLogo';
import { osFontClasses } from '@/app/fonts/osFonts';

// Sign-in for every person (vendor owners since 6 Oct 2026; founder, managers and employees since 7 Oct): their own mobile number
// + their own 6-digit login code. Afterwards they go to "Choose Workspace", which opens by itself when they belong to one business. One step, no message is sent. Every kind of "no" gets the same sentence — a wrong code, an unknown number, a number
// locked after too many tries — so the page never says which numbers are registered.
// Two looks (11 Nov 2026): venues and vendors sign in to Venue OS / Vendor OS in the approved liquid glass theme; the Shaadi
// Shopping team's sign-in (/admin/login, `team`) keeps Vivah OS's maroon and gold.
const LOOK = {
  team: {
    root: 'bg-[#1E0510]',
    shade: 'from-[#2E0A16]/70 via-[#2E0A16]/80 to-[#1E0510]/95',
    eyebrow: 'text-[#E8C98A]',
    eyebrowLine: 'bg-[#E8C98A]/70',
    panel: 'bg-[#FFFAF5]',
    title: 'text-[#2A1F1B]',
    body: 'text-[#6B5B4D]',
    accent: 'text-[#8B1A4A]',
    icon: 'text-[#B08D55]',
    line: 'border-[#E8DCC8]',
    button: 'bg-gradient-to-r from-[#8B1A4A] via-[#9E2A55] to-[#C5A46D] shadow-[0_12px_32px_rgba(139,26,74,0.25)]',
    field: 'border-[#E8DCC8] bg-[#FFFCF7] text-[#2A1F1B] placeholder:text-[#B5A898] focus:border-[#C5A46D] focus:ring-[#C5A46D]/25',
  },
  business: {
    root: `os-theme ${osFontClasses} bg-[#0F172A]`,
    shade: 'from-[#0F172A]/70 via-[#1E1B4B]/80 to-[#0F172A]/95',
    eyebrow: 'text-[#C4B5FD]',
    eyebrowLine: 'bg-[#C4B5FD]/70',
    panel: 'bg-[#F5F2FE]/95 shadow-[inset_1px_0_0_rgba(255,255,255,0.9),0_0_60px_-10px_rgba(123,63,242,0.45)] backdrop-blur-2xl',
    title: 'text-[var(--color-text-primary)]',
    body: 'text-[var(--color-text-secondary)]',
    accent: 'text-[var(--color-primary-text)]',
    icon: 'text-[var(--primary)]',
    line: 'border-[var(--color-border-default)]',
    button: 'bg-[var(--primary)] hover:bg-[var(--color-primary-hover)] shadow-[0_12px_32px_rgba(123,63,242,0.35)]',
    field: 'border-[var(--color-border-default)] bg-white text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--primary)] focus:ring-[var(--primary)]/25',
  },
};
const field = 'w-full rounded-xl border py-3.5 pl-11 pr-4 text-base outline-none transition focus:bg-white focus:ring-2';

export default function VendorCodeLoginClient({ redirectPath = '/workspace', team = false }: { redirectPath?: string; team?: boolean }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const L = team ? LOOK.team : LOOK.business;
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn('code', { phone, code, redirect: false });
      if (res?.ok) {
        window.location.href = redirectPath;
        return;
      }
      setCode('');
      setError('That mobile number and code do not match. Please check both and try again. After 5 wrong tries, sign-in is paused for 15 minutes.');
    } catch {
      setError('Could not connect — please check your connection and try again.');
    }
    setBusy(false);
  }

  return (
    <div className={`relative flex min-h-screen flex-col overflow-hidden lg:flex-row ${L.root}`}>
      {/* Background: a wedding photo under a maroon shade, behind the whole page (same photo as the couple's sign-in). */}
      <Image src="/images/homepage-poster.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
      <div aria-hidden className={`absolute inset-0 bg-gradient-to-br ${L.shade}`} />

      {/* Brand side */}
      <div className="relative flex flex-col justify-between px-6 pb-10 pt-8 lg:w-1/2 lg:px-14 lg:py-12">
        <div className="relative">
          {team ? (
            <Image src="/logo.png" alt="Shaadi Shopping" width={240} height={150} priority className="h-20 w-auto object-contain lg:h-24" />
          ) : (
            // Venues and vendors share this page (11 Nov 2026: Venue OS and Vendor OS), so it shows the mark and both names — which one
            // a business is in shows once it has signed in (lib/productName.ts).
            <>
              <div className="lg:hidden"><VivahOsMark size={48} tone="light" title="Venue OS and Vendor OS by Shaadi Shopping" /></div>
              <div className="hidden lg:block"><VivahOsMark size={110} tone="light" title="Venue OS and Vendor OS by Shaadi Shopping" /></div>
            </>
          )}
        </div>
        <div className="relative mt-8 lg:mt-0">
          <p className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] ${L.eyebrow}`}>
            <span className={`h-px w-8 ${L.eyebrowLine}`} /> {team ? 'Vivah OS' : 'Venue OS · Vendor OS'}
          </p>
          <h1 className="mt-3 max-w-md font-playfair text-[1.6rem] leading-snug text-[#FFF7EA] sm:text-[1.9rem] lg:text-[2.25rem]">
            {team ? (
              <>The Shaadi Shopping<br className="hidden sm:block" /> Command Center.</>
            ) : (
              <>Your enquiries, quotations<br className="hidden sm:block" /> and bookings, in one place.</>
            )}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[#E9D9C3]/80">{team ? 'For the Shaadi Shopping team.' : 'For venues and wedding professionals working with Shaadi Shopping.'}</p>
        </div>
        {team && <p className="relative mt-8 hidden text-xs text-[#E9D9C3]/50 lg:block">Powered by Vivah OS</p>}
      </div>

      {/* Sign-in side */}
      <div className={`relative flex flex-1 items-center justify-center rounded-t-[28px] px-5 py-10 lg:rounded-l-[36px] lg:rounded-tr-none lg:px-14 ${L.panel}`}>
        <div className="w-full max-w-sm">
          <h2 className={`font-playfair text-2xl font-bold ${L.title}`}>Sign in</h2>
          <p className={`mt-1.5 text-sm leading-relaxed ${L.body}`}>Use the mobile number you registered with and the 6-digit code we shared with you.</p>

          <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
            <div>
              <label htmlFor="vendor-mobile" className={`mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] ${L.accent}`}>
                Mobile number
              </label>
              <div className="relative">
                <Phone className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${L.icon}`} aria-hidden />
                <input
                  id="vendor-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className={`${field} ${L.field}`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="vendor-code" className={`mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] ${L.accent}`}>
                Login code
              </label>
              <div className="relative">
                <KeyRound className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${L.icon}`} aria-hidden />
                <input
                  id="vendor-code"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 digits"
                  className={`${field} ${L.field} tracking-[0.4em] placeholder:tracking-normal`}
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || phone.length !== 10 || code.length !== 6}
              className={`min-h-[52px] w-full rounded-full px-6 text-base font-semibold text-white transition disabled:opacity-40 disabled:shadow-none ${L.button}`}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className={`mt-8 space-y-2 border-t pt-6 text-sm leading-relaxed ${L.line} ${L.body}`}>
            <p>
              Lost your code, or never received one? Call Shaadi Shopping on{' '}
              <a href={`tel:${SHAADI_PHONE}`} className={`font-semibold ${L.accent}`}>
                {SHAADI_PHONE_DISPLAY}
              </a>{' '}
              and we will give you a new one.
            </p>
            {team ? (
              <p>
                {/* The older sign-in stays until the code sign-in is proven for everyone (founder's decision, 7 Oct 2026). */}
                <a href="/admin/login?with=password" className={`font-semibold ${L.accent}`}>
                  Sign in with email and password instead
                </a>
              </p>
            ) : (
              <p>
                Not registered yet?{' '}
                <a href="/vendor-onboarding" className={`font-semibold ${L.accent}`}>
                  Register your business
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
