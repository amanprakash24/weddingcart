'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { DAYS_MAX, EVENT_KINDS, WEDDING_FUNCTIONS, type EventKind, type WeddingFunction } from '@/lib/venue/enquiry';

// The couple's form on a venue's enquiry page (11 Nov 2026, Vivah OS phase 1). Phone-first: big boxes, chips for the choices. Only
// name, mobile and what they celebrate are needed. Where they came from is read from the page's own link (?src=…), never asked.
// The hidden "website" box and the time the form was open let the server quietly drop forms sent by programs.

const field = 'h-[52px] w-full rounded-[14px] border-[1.5px] border-[#D9C9B2] bg-white px-4 text-base outline-none placeholder:text-[#B8A898] focus:border-[#7A1238]';
const label = 'mb-1.5 block text-[13px] font-semibold';
const chip = (on: boolean) =>
  `min-h-11 rounded-full border-[1.5px] px-4 text-sm font-semibold transition ${on ? 'border-[#7A1238] bg-[#7A1238] text-white' : 'border-[#D9C9B2] bg-white text-[#2A1F1B] hover:border-[#7A1238]'}`;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

type Form = { name: string; phone: string; eventType: EventKind; weddingDate: string; days: string; functions: WeddingFunction[]; guestCount: string; budget: string; need: string };

export default function EnquiryPageForm({ slug, venueName }: { slug: string; venueName: string }) {
  // When the form became usable on this phone (set once loaded) — how long it was open is sent with it, never a clock time.
  const openedAt = useRef<number | null>(null);
  useEffect(() => {
    openedAt.current = performance.now();
  }, []);
  const [form, setForm] = useState<Form>({ name: '', phone: '', eventType: 'wedding', weddingDate: '', days: '1', functions: [], guestCount: '', budget: '', need: '' });
  const [trap, setTrap] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null); // the first name, once sent

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));
  };
  const toggle = (fn: WeddingFunction) => set('functions', form.functions.includes(fn) ? form.functions.filter((f) => f !== fn) : [...form.functions, fn]);

  async function send(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const src = new URLSearchParams(window.location.search).get('src') ?? '';
      const res = await fetch(`/api/enquire/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, src, trap, openMs: openedAt.current === null ? 0 : Math.round(performance.now() - openedAt.current) }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setSent(body.data?.firstName ?? form.name.split(' ')[0]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrors(body.fieldErrors ?? {});
        setError(body.fieldErrors ? 'Please check the boxes marked in red.' : (body.error ?? 'Your enquiry could not be sent. Please try again.'));
      }
    } catch {
      setError('No internet connection. Your enquiry was not sent — please try again.');
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-[20px] border border-[#EADFCF] bg-white px-6 py-10 text-center">
        <CheckCircle2 className="h-12 w-12 text-[#2E7D4F]" aria-hidden />
        <h2 className="font-cormorant text-[2rem] font-semibold leading-tight">Thank you, {sent}!</h2>
        <p className="max-w-sm text-[15px] leading-relaxed text-[#6B5A4E]">
          Your enquiry has reached {venueName}. They will call you on +91 {form.phone.replace(/\D/g, '').slice(-10).replace(/(\d{5})(\d{5})/, '$1 $2')} soon.
        </p>
      </div>
    );
  }

  const err = (k: string) => (errors[k] ? <p className="mt-1 text-[13px] text-[#B42318]">{errors[k]}</p> : null);

  return (
    <form onSubmit={send} noValidate className="flex flex-col gap-5">
      <p className="text-[15px] leading-relaxed text-[#6B5A4E]">Tell {venueName} about your celebration. They will call you back.</p>

      <div>
        <label htmlFor="eq-name" className={label}>Your name</label>
        <input id="eq-name" value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" placeholder="Neha Sharma" className={field} aria-invalid={!!errors.name} />
        {err('name')}
      </div>

      <div>
        <label htmlFor="eq-phone" className={label}>Mobile number</label>
        <div className="flex h-[52px] items-center overflow-hidden rounded-[14px] border-[1.5px] border-[#D9C9B2] bg-white focus-within:border-[#7A1238]">
          <span className="flex h-full items-center border-r border-[#EADFCF] bg-[#F7F0E6] px-4 text-base font-semibold text-[#6B5A4E]">+91</span>
          <input id="eq-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/[^\d ]/g, '').slice(0, 12))} placeholder="98765 43210" className="h-full min-w-0 flex-1 bg-transparent px-4 text-base outline-none placeholder:text-[#B8A898]" aria-invalid={!!errors.phone} />
        </div>
        {err('phone')}
      </div>

      <fieldset>
        <legend className={label}>What are you celebrating?</legend>
        <div className="flex flex-wrap gap-2">
          {EVENT_KINDS.map((k) => (
            <button key={k.id} type="button" aria-pressed={form.eventType === k.id} onClick={() => set('eventType', k.id)} className={chip(form.eventType === k.id)}>{k.label}</button>
          ))}
        </div>
        {err('eventType')}
      </fieldset>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="min-w-0">
          <label htmlFor="eq-date" className={label}>Date <span className="font-normal text-[#8A7A6D]">(if decided)</span></label>
          <input id="eq-date" type="date" min={today()} value={form.weddingDate} onChange={(e) => set('weddingDate', e.target.value)} className={field} aria-invalid={!!errors.weddingDate} />
          {err('weddingDate')}
        </div>
        <div>
          <label htmlFor="eq-days" className={label}>Days</label>
          <select id="eq-days" value={form.days} onChange={(e) => set('days', e.target.value)} className={`${field} w-[96px] px-3`}>
            {Array.from({ length: DAYS_MAX }, (_, i) => String(i + 1)).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {err('days')}
        </div>
      </div>

      {form.eventType === 'wedding' && (
        <fieldset>
          <legend className={label}>Functions <span className="font-normal text-[#8A7A6D]">(choose all that apply)</span></legend>
          <div className="flex flex-wrap gap-2">
            {WEDDING_FUNCTIONS.map((f) => (
              <button key={f.id} type="button" aria-pressed={form.functions.includes(f.id)} onClick={() => toggle(f.id)} className={chip(form.functions.includes(f.id))}>{f.label}</button>
            ))}
          </div>
          {err('functions')}
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="eq-guests" className={label}>Guests</label>
          <input id="eq-guests" inputMode="numeric" value={form.guestCount} onChange={(e) => set('guestCount', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="300" className={field} aria-invalid={!!errors.guestCount} />
          {err('guestCount')}
        </div>
        <div className="min-w-0">
          <label htmlFor="eq-budget" className={label}>Budget <span className="font-normal text-[#8A7A6D]">(₹, optional)</span></label>
          <input id="eq-budget" inputMode="numeric" value={form.budget} onChange={(e) => set('budget', e.target.value.replace(/[^\d,]/g, '').slice(0, 14))} placeholder="5,00,000" className={field} aria-invalid={!!errors.budget} />
          {err('budget')}
        </div>
      </div>

      <div>
        <label htmlFor="eq-need" className={label}>Anything else? <span className="font-normal text-[#8A7A6D]">(optional)</span></label>
        <textarea id="eq-need" value={form.need} onChange={(e) => set('need', e.target.value)} rows={3} maxLength={500} placeholder="Lawn for the Haldi, veg catering, rooms for family…" className="w-full rounded-[14px] border-[1.5px] border-[#D9C9B2] bg-white px-4 py-3 text-base outline-none placeholder:text-[#B8A898] focus:border-[#7A1238]" />
        {err('need')}
      </div>

      {/* For programs only: people never see this box, so it stays empty for them. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="eq-website">Website</label>
        <input id="eq-website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <button type="submit" disabled={busy} className="h-[54px] rounded-[14px] bg-[#7A1238] text-base font-semibold text-white transition hover:bg-[#5A0D29] disabled:opacity-55">
        {busy ? 'Sending…' : 'Send enquiry'}
      </button>
      <p className="text-center text-xs leading-relaxed text-[#8A7A6D]">By sending, you agree that {venueName} may call or WhatsApp you about this enquiry.</p>
    </form>
  );
}
