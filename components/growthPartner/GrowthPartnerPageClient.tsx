'use client';

import { useState } from 'react';
import { Building2, Camera, Heart, PartyPopper, Handshake, Send, Briefcase, CheckCircle2, IndianRupee, ChevronDown, Users, Clock, BadgeCheck, Phone, MessageCircle } from 'lucide-react';
import { PARTNER_CATEGORIES, NETWORK_TYPES, REFERRAL_TYPES, REFERRAL_TYPE_LABEL, type ReferralType } from '@/lib/growthPartner/labels';
import { trackEvent } from '@/lib/analytics/events';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY, shaadiWhatsAppLink } from '@/lib/shaadiContact';

// Growth Partner Program page (docs/wedding-os/14-growth-partner.md). Mobile-first, brand maroon + gold + ivory.
// No fixed payout amounts anywhere — payout depends on category, business value and agreed terms.

const MAROON = '#8B1A4A';
const serif = { fontFamily: 'var(--font-playfair), serif' };

const WHO = [
  'Event Planners / Coordinators', 'Wedding Professionals', 'Photographers', 'Decorators', 'Caterers', 'Makeup Artists',
  'DJs / Entertainment', 'Banquet / Hotel / Resort Staff', 'Venue Managers / Sales Executives', 'Freelancers', 'Students',
  'Part-time workers', 'Local networkers', 'Anyone with genuine wedding contacts',
];
const REFER = [
  { icon: Building2, title: 'Venue', text: 'Banquet halls, hotels, resorts and wedding venues.' },
  { icon: Camera, title: 'Vendor', text: 'Photographers, decorators, caterers, makeup artists, DJs, mehendi and other wedding services.' },
  { icon: Heart, title: 'Client', text: 'Couples, families, bride/groom or anyone planning a wedding.' },
  { icon: PartyPopper, title: 'Event', text: 'Wedding, engagement, reception, corporate or other events.' },
];
const STEPS = [
  { title: 'Connect', text: 'Find a genuine wedding-related opportunity.' },
  { title: 'Refer', text: 'Introduce the person, business or client to Shaadi Shopping.' },
  { title: 'Business', text: 'We handle the requirement, discussion, quotation and business process.' },
  { title: 'Complete', text: 'The referred business successfully converts and completes.' },
  { title: 'Earn', text: 'You receive the agreed referral payout.' },
];
const WHY = [
  { icon: IndianRupee, text: 'No joining fee, no investment' },
  { icon: Clock, text: 'Part-time and flexible' },
  { icon: Handshake, text: 'You introduce — we handle the business' },
  { icon: BadgeCheck, text: 'Performance-based payout after completion' },
];
const FAQ = [
  ['Who can become a Growth Partner?', 'Anyone with genuine wedding-related contacts or a useful network.'],
  ['Is this a full-time job?', 'No. It is a part-time, flexible referral opportunity.'],
  ['Is there a joining fee?', 'No.'],
  ['What can I refer?', 'Venues, vendors, clients and events.'],
  ['Do I need to close the deal?', 'No. Your primary role is to make a genuine introduction. Shaadi Shopping handles the business process.'],
  ['Can I submit multiple referrals?', 'Yes.'],
  ['When will I receive payment?', 'After successful business completion, according to the agreed referral terms.'],
  ['How much can I earn?', 'The referral payout depends on the category and the deal, and will be communicated according to the applicable referral terms.'],
  ['What if two people refer the same business?', 'Referral ownership is decided by the verified referral / first valid introduction rules.'],
];

const input = 'w-full rounded-xl border border-[#C5A46D]/40 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#8B1A4A]';
const label = 'grid gap-1 text-sm font-medium text-[#2A1F1B]';

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.success) throw new Error(payload.issues?.[0]?.message ?? payload.error ?? 'Something went wrong — please try again');
  return payload.data;
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
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h3 className="mt-2 text-xl font-semibold text-[#2A1F1B]" style={serif}>Welcome, {done.firstName}!</h3>
        <p className="mt-2 text-sm text-[#4A3F38]">Your Partner code is</p>
        <p className="mt-1 text-3xl font-bold tracking-wider" style={{ color: MAROON }}>{done.code}</p>
        <p className="mt-3 text-sm text-[#4A3F38]">
          <b>Save this code.</b> You’ll need it with your mobile number to submit referrals. Our team will review your
          registration and get in touch.
        </p>
        <a href="#refer" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4" style={{ color: MAROON }}>Submit a referral now →</a>
      </div>
    );
  }
  if (done?.status === 'already-registered') {
    return (
      <div role="status" className="rounded-2xl border border-[#C5A46D]/40 bg-white p-6 text-center">
        <h3 className="text-lg font-semibold text-[#2A1F1B]" style={serif}>You’re already registered</h3>
        <p className="mt-2 text-sm text-[#4A3F38]">This mobile number is already a Growth Partner. Our team will contact you. Lost your Partner code? Call or WhatsApp us.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Full name *<input className={input} value={form.name} onChange={set('name')} required maxLength={100} autoComplete="name" /></label>
        <label className={label}>Mobile number *<input className={input} value={form.phone} onChange={set('phone')} required inputMode="tel" autoComplete="tel" placeholder="10-digit mobile" /></label>
        <label className={label}>WhatsApp number<input className={input} value={form.whatsapp} onChange={set('whatsapp')} inputMode="tel" placeholder="If different" /></label>
        <label className={label}>Email<input className={input} type="email" value={form.email} onChange={set('email')} autoComplete="email" /></label>
        <label className={label}>City *<input className={input} value={form.city} onChange={set('city')} required maxLength={80} autoComplete="address-level2" /></label>
        <label className={label}>
          What best describes you? *
          <select className={input} value={form.category} onChange={set('category')} required>
            <option value="">Choose…</option>
            {PARTNER_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-[#2A1F1B]">What type of referrals can you provide? *</legend>
        <div className="flex flex-wrap gap-2">
          {NETWORK_TYPES.map((t) => {
            const on = types.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setTypes((cur) => (on ? cur.filter((x) => x !== t) : [...cur, t]))}
                className={`min-h-[40px] rounded-full border px-4 text-sm ${on ? 'border-transparent text-white' : 'border-[#C5A46D]/50 bg-white text-[#2A1F1B]'}`}
                style={on ? { background: MAROON } : undefined}
              >
                {t}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className={label}>
        Tell us briefly about your network
        <textarea className={input} rows={3} maxLength={1000} value={form.networkNote} onChange={set('networkNote')} placeholder="I know around 10 banquet owners in Patna and regularly work with wedding vendors." />
      </label>
      <label className="flex items-start gap-3 text-sm text-[#2A1F1B]">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#8B1A4A]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I agree to be contacted by Shaadi Shopping regarding the Growth Partner Program and referral opportunities.</span>
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-[48px] rounded-xl text-base font-semibold text-white disabled:opacity-50" style={{ background: MAROON }}>
        {busy ? 'Submitting…' : 'Join as Growth Partner'}
      </button>
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
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h3 className="mt-2 text-xl font-semibold text-[#2A1F1B]" style={serif}>Referral received!</h3>
        <p className="mt-2 text-sm text-[#4A3F38]">Thank you for connecting this opportunity with Shaadi Shopping. Our team will review the details and contact the referral.</p>
        <button type="button" onClick={() => { setDone(false); setForm((f) => ({ ...f, name: '', phone: '', city: '', requirement: '', notes: '' })); setType(''); setConsent(false); }} className="mt-4 text-sm font-semibold underline underline-offset-4" style={{ color: MAROON }}>
          Submit another referral
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-4 rounded-xl bg-[#FFFAF5] p-3 sm:grid-cols-2">
        <label className={label}>Your registered mobile *<input className={input} value={form.partnerPhone} onChange={set('partnerPhone')} inputMode="tel" autoComplete="tel" /></label>
        <label className={label}>Your Partner code *<input className={input} value={form.partnerCode} onChange={set('partnerCode')} placeholder="GP-1001" autoCapitalize="characters" /></label>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-[#2A1F1B]">What are you referring? *</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REFERRAL_TYPES.map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`min-h-[44px] rounded-xl border text-sm font-medium ${type === t ? 'border-transparent text-white' : 'border-[#C5A46D]/50 bg-white text-[#2A1F1B]'}`} style={type === t ? { background: MAROON } : undefined}>
              {REFERRAL_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Name / business name *<input className={input} value={form.name} onChange={set('name')} maxLength={120} /></label>
        <label className={label}>Their contact number *<input className={input} value={form.phone} onChange={set('phone')} inputMode="tel" /></label>
        <label className={`${label} sm:col-span-2`}>City / location *<input className={input} value={form.city} onChange={set('city')} maxLength={80} /></label>
      </div>
      <label className={label}>Requirement / basic details<textarea className={input} rows={2} maxLength={1000} value={form.requirement} onChange={set('requirement')} /></label>
      <label className={label}>Additional notes<textarea className={input} rows={2} maxLength={1000} value={form.notes} onChange={set('notes')} /></label>
      <label className="flex items-start gap-3 text-sm text-[#2A1F1B]">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#8B1A4A]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I confirm this person / business agreed to be contacted by Shaadi Shopping.</span>
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-[48px] rounded-xl text-base font-semibold text-white disabled:opacity-50" style={{ background: MAROON }}>
        {busy ? 'Submitting…' : 'Submit Referral'}
      </button>
    </form>
  );
}

export default function GrowthPartnerPageClient() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="bg-[#FFFAF5] text-[#2A1F1B]">
      {/* Hero */}
      <section className="px-4 pb-14 pt-24 sm:pt-28" style={{ background: 'linear-gradient(160deg, #5E0F30 0%, #8B1A4A 60%, #A8325E 100%)' }}>
        <div className="mx-auto max-w-4xl text-center text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#F3D9A4]">Shaadi Shopping</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl" style={serif}>Growth Partner Program</h1>
          <p className="mt-3 text-2xl font-semibold text-[#F3D9A4]" style={serif}>Connect. Refer. Earn.</p>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/90">Have wedding-related contacts? Turn your network into opportunities with Shaadi Shopping.</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-white/75">
            Refer venues, vendors, clients or events. We handle the business process. Successful business completion earns you an agreed referral payout.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#register" onClick={() => trackEvent('growth_partner_cta_click', { location: 'hero' })} className="inline-flex min-h-[48px] items-center rounded-xl bg-white px-6 text-base font-semibold" style={{ color: MAROON }}>
              Become a Growth Partner
            </a>
            <a href="#how" className="text-sm font-medium text-white/90 underline underline-offset-4">How it works ↓</a>
          </div>
          <p className="mt-5 text-xs text-white/70">No joining fee • Part-time • Flexible • Performance-based</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-14">
        {/* Who can join */}
        <section aria-labelledby="who">
          <h2 id="who" className="text-center text-3xl font-semibold" style={serif}>Who can join?</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#4A3F38]">
            <b>You don’t need to be a wedding expert.</b> You need a genuine network and the ability to make introductions.
          </p>
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {WHO.map((w) => (
              <li key={w} className="rounded-full border border-[#C5A46D]/40 bg-white px-3 py-1.5 text-sm">{w}</li>
            ))}
          </ul>
        </section>

        {/* What can you refer */}
        <section aria-labelledby="refer-what">
          <h2 id="refer-what" className="text-center text-3xl font-semibold" style={serif}>What can you refer?</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REFER.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-[#C5A46D]/25 bg-white p-5">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF3E6]"><Icon className="h-6 w-6" style={{ color: MAROON }} /></span>
                <h3 className="mt-3 text-lg font-semibold" style={serif}>{title}</h3>
                <p className="mt-1 text-sm text-[#4A3F38]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-h" className="scroll-mt-24">
          <h2 id="how-h" className="text-center text-3xl font-semibold" style={serif}>How it works</h2>
          <p className="mt-2 text-center font-semibold" style={{ color: MAROON }}>You bring the opportunity. We handle the business.</p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-[#C5A46D]/25 bg-white p-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: MAROON }}>{i + 1}</span>
                <h3 className="mt-2 font-semibold uppercase tracking-wide">{s.title}</h3>
                <p className="mt-1 text-sm text-[#4A3F38]">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Why + payment */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#C5A46D]/25 bg-white p-6">
            <h2 className="text-2xl font-semibold" style={serif}>Why become a partner</h2>
            <ul className="mt-4 grid gap-3">
              {WHY.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm"><Icon className="h-5 w-5 shrink-0" style={{ color: MAROON }} />{text}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#C5A46D]/25 bg-white p-6">
            <h2 className="text-2xl font-semibold" style={serif}>How payment works</h2>
            <p className="mt-3 text-sm text-[#4A3F38]">
              Referral payout is based on the referral category, business value and agreed terms. Payment is made after successful business completion.
            </p>
            <p className="mt-3 text-sm text-[#4A3F38]">Genuine referrals only — every referral is verified by our team.</p>
          </div>
        </section>

        {/* Register + refer */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div id="register" className="scroll-mt-24 rounded-2xl border border-[#C5A46D]/30 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2"><Users className="h-5 w-5" style={{ color: MAROON }} /><h2 className="text-2xl font-semibold" style={serif}>Become a Growth Partner</h2></div>
            <p className="mb-4 mt-1 text-sm text-[#6B5B4D]">It takes a minute. No joining fee.</p>
            <RegisterForm />
          </div>
          <div id="refer" className="scroll-mt-24 rounded-2xl border border-[#C5A46D]/30 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2"><Send className="h-5 w-5" style={{ color: MAROON }} /><h2 className="text-2xl font-semibold" style={serif}>Refer an Opportunity</h2></div>
            <p className="mb-4 mt-1 text-sm text-[#6B5B4D]">Already a partner? Use your registered mobile and Partner code.</p>
            <ReferralForm />
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq">
          <h2 id="faq" className="text-center text-3xl font-semibold" style={serif}>Questions</h2>
          <div className="mx-auto mt-6 max-w-3xl divide-y divide-[#C5A46D]/25 rounded-2xl border border-[#C5A46D]/25 bg-white">
            {FAQ.map(([q, a], i) => (
              <div key={q}>
                <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-medium">
                  {q}
                  <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
                </button>
                {open === i && <p className="px-5 pb-4 text-sm text-[#4A3F38]">{a}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="rounded-3xl p-8 text-center text-white" style={{ background: MAROON }}>
          <Briefcase className="mx-auto h-8 w-8 text-[#F3D9A4]" />
          <h2 className="mt-3 text-3xl font-semibold" style={serif}>Have the network?</h2>
          <p className="mt-1 text-xl text-[#F3D9A4]" style={serif}>Grow with Shaadi Shopping.</p>
          <p className="mt-2 font-semibold">Connect. Refer. Earn.</p>
          <div className="mt-5">
            <a href="#register" onClick={() => trackEvent('growth_partner_cta_click', { location: 'final' })} className="inline-flex min-h-[48px] items-center rounded-xl bg-white px-6 text-base font-semibold" style={{ color: MAROON }}>
              Become a Growth Partner
            </a>
          </div>
          <p className="mt-4 text-xs text-white/75">No joining fee • Part-time • Flexible • Performance-based</p>
          <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm">
            <a href={`tel:${SHAADI_PHONE}`} className="inline-flex items-center gap-1.5 underline underline-offset-4"><Phone className="h-4 w-4" />{SHAADI_PHONE_DISPLAY}</a>
            <a href={shaadiWhatsAppLink('Hi, I want to know more about the Shaadi Shopping Growth Partner Program.')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 underline underline-offset-4"><MessageCircle className="h-4 w-4" />WhatsApp us</a>
          </div>
        </section>
      </div>
    </div>
  );
}

