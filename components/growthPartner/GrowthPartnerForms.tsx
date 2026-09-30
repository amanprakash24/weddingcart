'use client';

import { useEffect, useState } from 'react';
import { PARTNER_CATEGORIES, NETWORK_TYPES, REFERRAL_TYPES, REFERRAL_TYPE_LABEL, type ReferralType } from '@/lib/growthPartner/labels';
import { trackEvent } from '@/lib/analytics/events';

// The two Growth Partner forms in one card, as tabs (docs/wedding-os/14-growth-partner.md). Same fields, validation
// and API as before — only the presentation is the luxury Shaadi Shopping style. #register and #refer open a tab.

const serif = { fontFamily: 'var(--font-playfair), serif' };
const script = { fontFamily: 'var(--font-cormorant), Georgia, serif' };

const field =
  'w-full rounded-lg border border-[#E8DCC8] bg-[#FFFCF7] px-4 py-3 text-[15px] text-[#2A1F1B] placeholder:text-[#B8A99A] outline-none transition focus:border-[#C5A46D] focus:bg-white focus:ring-4 focus:ring-[#C5A46D]/15';
const labelText = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A6556]';

function Label({ text, children, className = '' }: { text: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className={labelText}>{text}</span>
      {children}
    </label>
  );
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.success) throw new Error(payload.issues?.[0]?.message ?? payload.error ?? 'Something went wrong — please try again');
  return payload.data;
}

function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="min-h-[52px] w-full rounded-full bg-gradient-to-r from-[#8B1A4A] via-[#9E2A55] to-[#C5A46D] text-[15px] font-semibold tracking-wide text-white shadow-[0_10px_30px_rgba(139,26,74,0.25)] transition hover:shadow-[0_14px_36px_rgba(139,26,74,0.35)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Consent({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#FBF5EC] px-4 py-3 text-sm leading-relaxed text-[#4A3F38]">
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#8B1A4A]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function Seal() {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#C5A46D] bg-gradient-to-br from-[#FFF6E6] to-[#F3D9A4] shadow-inner">
      <span className="text-2xl text-[#8B1A4A]" style={serif}>✓</span>
    </div>
  );
}

function RegisterForm() {
  const [form, setForm] = useState({ name: '', phone: '', whatsapp: '', email: '', city: '', category: '', networkNote: '' });
  const [types, setTypes] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ status: string; code?: string; firstName?: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await postJson('/api/growth-partner/register', { ...form, referralTypes: types, consent });
      setDone(data);
      if (data.status === 'registered') trackEvent('growth_partner_registered', { category: form.category });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done?.status === 'registered') {
    return (
      <div role="status" className="py-4 text-center">
        <Seal />
        <h3 className="mt-4 text-2xl text-[#2A1F1B]" style={serif}>Welcome to the circle, {done.firstName}</h3>
        <p className="mt-1 text-lg italic text-[#8B1A4A]" style={script}>Your Growth Partner journey begins.</p>
        <div className="mx-auto mt-6 max-w-xs rounded-2xl border border-[#C5A46D]/60 bg-gradient-to-b from-[#FFFCF7] to-[#FBF1DF] px-6 py-5 shadow-sm">
          <p className={labelText}>Your Partner code</p>
          <p className="mt-2 text-4xl tracking-[0.12em] text-[#8B1A4A]" style={serif}>{done.code}</p>
        </div>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-[#4A3F38]">
          <b>Please save this code.</b> You’ll need it with your mobile number to submit referrals. Our team will review your registration and be in touch.
        </p>
        <a href="#refer" className="mt-5 inline-block text-sm font-semibold text-[#8B1A4A] underline decoration-[#C5A46D] underline-offset-4">Refer an opportunity now →</a>
      </div>
    );
  }
  if (done?.status === 'already-registered') {
    return (
      <div role="status" className="py-6 text-center">
        <Seal />
        <h3 className="mt-4 text-2xl text-[#2A1F1B]" style={serif}>You’re already one of us</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#4A3F38]">This mobile number is already a Growth Partner. Our team will contact you. Lost your Partner code? Call or WhatsApp us.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Label text="Full name *"><input className={field} value={form.name} onChange={set('name')} maxLength={100} autoComplete="name" /></Label>
        <Label text="Mobile number *"><input className={field} value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="10-digit mobile" /></Label>
        <Label text="WhatsApp number"><input className={field} value={form.whatsapp} onChange={set('whatsapp')} inputMode="tel" placeholder="If different" /></Label>
        <Label text="Email"><input className={field} type="email" value={form.email} onChange={set('email')} autoComplete="email" /></Label>
        <Label text="City *"><input className={field} value={form.city} onChange={set('city')} maxLength={80} autoComplete="address-level2" /></Label>
        <Label text="What best describes you? *">
          <select className={field} value={form.category} onChange={set('category')}>
            <option value="">Choose…</option>
            {PARTNER_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Label>
      </div>
      <fieldset className="grid gap-2">
        <legend className={labelText}>What type of referrals can you provide? *</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {NETWORK_TYPES.map((t) => {
            const on = types.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setTypes((cur) => (on ? cur.filter((x) => x !== t) : [...cur, t]))}
                className={`min-h-[42px] rounded-full border px-4 text-sm transition ${on ? 'border-[#8B1A4A] bg-[#8B1A4A] text-white shadow-sm' : 'border-[#E8DCC8] bg-white text-[#4A3F38] hover:border-[#C5A46D]'}`}
              >
                {on ? '✓ ' : ''}{t}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Label text="Tell us briefly about your network">
        <textarea className={field} rows={3} maxLength={1000} value={form.networkNote} onChange={set('networkNote')} placeholder="I know around 10 banquet owners in Patna and regularly work with wedding vendors." />
      </Label>
      <Consent checked={consent} onChange={setConsent}>I agree to be contacted by Shaadi Shopping regarding the Growth Partner Program and referral opportunities.</Consent>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <SubmitButton busy={busy}>{busy ? 'Submitting…' : 'Join as Growth Partner'}</SubmitButton>
    </form>
  );
}

function ReferralForm() {
  const [form, setForm] = useState({ partnerPhone: '', partnerCode: '', name: '', phone: '', city: '', requirement: '', notes: '' });
  const [type, setType] = useState<ReferralType | ''>('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await postJson('/api/growth-partner/referrals', { ...form, type, consent });
      setDone(true);
      trackEvent('growth_partner_referral_submitted', { type });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div role="status" className="py-4 text-center">
        <Seal />
        <h3 className="mt-4 text-2xl text-[#2A1F1B]" style={serif}>Referral received!</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#4A3F38]">Thank you for connecting this opportunity with Shaadi Shopping. Our team will review the details and contact the referral.</p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setForm((f) => ({ ...f, name: '', phone: '', city: '', requirement: '', notes: '' }));
            setType('');
            setConsent(false);
          }}
          className="mt-5 text-sm font-semibold text-[#8B1A4A] underline decoration-[#C5A46D] underline-offset-4"
        >
          Refer another opportunity
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid gap-5 rounded-xl border border-[#EFE3CF] bg-[#FBF5EC] p-4 sm:grid-cols-2">
        <Label text="Your registered mobile *"><input className={field} value={form.partnerPhone} onChange={set('partnerPhone')} inputMode="tel" autoComplete="tel" /></Label>
        <Label text="Your Partner code *"><input className={field} value={form.partnerCode} onChange={set('partnerCode')} placeholder="GP-1001" autoCapitalize="characters" /></Label>
      </div>
      <fieldset className="grid gap-2">
        <legend className={labelText}>What are you referring? *</legend>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REFERRAL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`min-h-[46px] rounded-lg border text-sm font-medium transition ${type === t ? 'border-[#8B1A4A] bg-[#8B1A4A] text-white shadow-sm' : 'border-[#E8DCC8] bg-white text-[#4A3F38] hover:border-[#C5A46D]'}`}
            >
              {REFERRAL_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Label text="Name / business name *"><input className={field} value={form.name} onChange={set('name')} maxLength={120} /></Label>
        <Label text="Their contact number *"><input className={field} value={form.phone} onChange={set('phone')} inputMode="tel" /></Label>
        <Label text="City / location *" className="sm:col-span-2"><input className={field} value={form.city} onChange={set('city')} maxLength={80} /></Label>
      </div>
      <Label text="Requirement / basic details"><textarea className={field} rows={2} maxLength={1000} value={form.requirement} onChange={set('requirement')} /></Label>
      <Label text="Additional notes"><textarea className={field} rows={2} maxLength={1000} value={form.notes} onChange={set('notes')} /></Label>
      <Consent checked={consent} onChange={setConsent}>I confirm this person / business agreed to be contacted by Shaadi Shopping.</Consent>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <SubmitButton busy={busy}>{busy ? 'Submitting…' : 'Submit Referral'}</SubmitButton>
    </form>
  );
}

// One card, two tabs. The page's #register / #refer links open the matching tab.
export default function GrowthPartnerForms() {
  const [tab, setTab] = useState<'register' | 'refer'>('register');

  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === '#refer') setTab('refer');
      else if (window.location.hash === '#register') setTab('register');
    };
    const t = setTimeout(fromHash, 0);
    window.addEventListener('hashchange', fromHash);
    return () => {
      clearTimeout(t);
      window.removeEventListener('hashchange', fromHash);
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#E8DCC8] bg-white shadow-[0_30px_80px_rgba(42,6,20,0.10)]">
      <div className="h-1 bg-gradient-to-r from-[#8B1A4A] via-[#C5A46D] to-[#8B1A4A]" />
      <div role="tablist" aria-label="Growth Partner forms" className="grid grid-cols-2 border-b border-[#EFE3CF] bg-[#FFFCF7]">
        {(
          [
            ['register', 'Become a Partner'],
            ['refer', 'Refer an Opportunity'],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`relative min-h-[60px] px-3 text-[15px] transition ${tab === key ? 'bg-white text-[#8B1A4A]' : 'text-[#7A6556] hover:text-[#8B1A4A]'}`}
            style={serif}
          >
            {text}
            {tab === key && <span className="absolute inset-x-8 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-[#C5A46D] to-transparent" />}
          </button>
        ))}
      </div>
      <div className="p-6 sm:p-10">
        {tab === 'register' ? (
          <>
            <p className="mb-6 text-center text-sm text-[#7A6556]">It takes a minute · No joining fee</p>
            <RegisterForm />
          </>
        ) : (
          <>
            <p className="mb-6 text-center text-sm text-[#7A6556]">Already a partner? Use your registered mobile and Partner code.</p>
            <ReferralForm />
          </>
        )}
      </div>
    </div>
  );
}
