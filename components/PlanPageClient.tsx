'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, Phone } from 'lucide-react';
import { trackConsultationLeadConversion } from '@/lib/analytics/googleAds';
import { useCart } from '@/context/CartContext';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY, shaadiWhatsAppLink } from '@/lib/shaadiContact';
import { checkPlanForm, planPayload, BUDGET_OPTIONS, BUDGET_QUERY_MAP, PLAN_SERVICES, type PlanFields } from '@/lib/plan/shortPlan';
import { serif } from '@/components/home/styles';

// /plan (25 Oct 2026, founder: "this form is too long"): one short form instead of the 5-step wizard. The four things the
// server needs (name, mobile, date, guests) plus budget and services as optional taps; the Wedding Expert asks the rest on
// the first call. Saved to the same place as before (POST /api/consultations → a consultation in the CRM).
const WHATSAPP = shaadiWhatsAppLink('Hi, I just sent my wedding details on Shaadi Shopping.');

const input =
  'min-h-[52px] w-full min-w-0 rounded-[14px] border border-[#E2D3BC] bg-[#FBF6EE] px-3.5 text-base text-[#221714] outline-none focus-visible:border-[#7A1238] focus-visible:ring-2 focus-visible:ring-[#7A1238]/25';
const chip = (on: boolean) =>
  `min-h-[44px] rounded-full border px-4 text-[15px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238]/40 ${
    on ? 'border-[#7A1238] bg-[#7A1238] text-white' : 'border-[#E2D3BC] bg-white text-[#221714] hover:border-[#7A1238]'
  }`;

export default function PlanPageClient() {
  const { items, total, clearCart } = useCart();
  const searchParams = useSearchParams();
  const fromHomepage = BUDGET_QUERY_MAP[searchParams.get('budget') ?? ''] ?? '';

  const [fields, setFields] = useState<PlanFields>({ name: '', phone: '', weddingDate: '', guests: '', budgetRange: fromHomepage, services: ['venue'] });
  const [errors, setErrors] = useState<Partial<Record<keyof PlanFields, string>>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const set = <K extends keyof PlanFields>(key: K, value: PlanFields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const toggleService = (id: string) =>
    set('services', fields.services.includes(id) ? fields.services.filter((s) => s !== id) : [...fields.services, id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError('');
    const problems = checkPlanForm(fields, today);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    setSending(true);
    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planPayload(fields, items, total)),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setSent(true);
      clearCart();
      trackConsultationLeadConversion();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSendError(`We could not send your details. Please try again, or call us on ${SHAADI_PHONE_DISPLAY}.`);
    } finally {
      setSending(false);
    }
  };

  const err = (key: keyof PlanFields) =>
    errors[key] ? <p id={`plan-${key}-error`} role="alert" className="text-[13px] font-medium text-[#B42318]">{errors[key]}</p> : null;
  const label = 'flex flex-col gap-1.5 text-sm font-semibold text-[#221714]';

  return (
    <div className="min-h-screen bg-[#FBF6EE] text-[#221714]">
      {/* Clears the fixed announcement bar (36px) and the navbar (52 / 64 / 72px) */}
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-10 px-4 pb-24 pt-[112px] sm:px-6 sm:pt-[128px] lg:gap-14 lg:pt-[144px]">
        <section className="min-w-0 flex-[1_1_380px]">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#8A6A2F]">Free for families · under a minute</p>
          <h1 className="mt-3 text-[2.6rem] font-semibold leading-[1.03] tracking-[-0.01em] sm:text-[3.4rem] lg:text-[4rem]" style={serif}>
            Get your free <span className="italic text-[#7A1238]">wedding shortlist.</span>
          </h1>
          <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-[#4D3E36] sm:text-lg">
            Four quick details. Your Wedding Expert calls you, asks the rest in a friendly chat, and sends venues and vendors that fit your guests and budget.
          </p>
          <ul className="mt-7 hidden space-y-3.5 text-base text-[#4D3E36] sm:block">
            {['One person for your whole wedding', 'Real Patna venues with their prices', 'Visits and quotations arranged for you'].map((t) => (
              <li key={t} className="flex items-center gap-3"><Check className="h-[18px] w-[18px] text-[#7A1238]" strokeWidth={2.4} aria-hidden />{t}</li>
            ))}
          </ul>
          <div className="mt-8 hidden max-w-[420px] items-center gap-3.5 rounded-[20px] border border-[#EADFCC] bg-white px-4 py-3.5 sm:flex">
            <Image src="/images/anisha.jpg" alt="" width={56} height={56} className="h-14 w-14 rounded-full border-2 border-[#E9C98E] object-cover object-top" />
            <div>
              <p className="font-bold">Talk to a Wedding Expert</p>
              <p className="text-sm text-[#6B5A4E]">Mon–Sat, 10am–7pm · <a href={`tel:${SHAADI_PHONE}`} className="font-semibold text-[#7A1238]">{SHAADI_PHONE_DISPLAY}</a></p>
            </div>
          </div>
        </section>

        <main className="min-w-0 flex-[1_1_520px] rounded-[28px] border border-[#EADFCC] bg-white p-5 shadow-[0_18px_50px_rgba(34,23,20,0.08)] sm:p-8">
          {sent ? (
            <div className="px-2 py-8 text-center sm:py-10" role="status">
              <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#E6F0E9]"><Check className="h-9 w-9 text-[#2F6B45]" strokeWidth={2.2} aria-hidden /></span>
              <h2 className="mt-5 text-[2.2rem] font-semibold leading-tight sm:text-[2.6rem]" style={serif}>Thank you, {fields.name.trim().split(/\s+/)[0]}! Your expert will call you</h2>
              <p className="mx-auto mt-3 max-w-[440px] text-base leading-relaxed text-[#4D3E36]">
                Our Wedding Experts call Mon–Sat, 10am–7pm, on the number you gave. Keep your phone close.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-[#1F7A4D] px-6 font-bold text-white">WhatsApp us now</a>
                <Link href="/cities/patna/venue" className="inline-flex min-h-[50px] items-center justify-center rounded-full border border-[#D9C7AA] px-6 font-semibold text-[#221714]">Browse venues</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate aria-label="Get your free wedding shortlist" className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>
                  Your name
                  <input className={input} value={fields.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'plan-name-error' : undefined} />
                  {err('name')}
                </label>
                <label className={label}>
                  Mobile number
                  <span className={`${input} flex items-center overflow-hidden px-0 focus-within:border-[#7A1238] focus-within:ring-2 focus-within:ring-[#7A1238]/25`}>
                    <span className="border-r border-[#E2D3BC] px-3 font-semibold text-[#6B5A4E]">+91</span>
                    <input className="min-h-[50px] min-w-0 flex-1 bg-transparent px-3 text-base outline-none" type="tel" inputMode="numeric" value={fields.phone} onChange={(e) => set('phone', e.target.value)} placeholder="10 digits" autoComplete="tel-national" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'plan-phone-error' : undefined} />
                  </span>
                  {err('phone')}
                </label>
                <label className={label}>
                  Wedding date
                  <input className={input} type="date" min={today} value={fields.weddingDate} onChange={(e) => set('weddingDate', e.target.value)} aria-invalid={!!errors.weddingDate} aria-describedby={errors.weddingDate ? 'plan-weddingDate-error' : undefined} />
                  {err('weddingDate')}
                </label>
                <label className={label}>
                  Number of guests
                  <input className={input} type="number" inputMode="numeric" min={1} value={fields.guests} onChange={(e) => set('guests', e.target.value)} placeholder="e.g. 300" aria-invalid={!!errors.guests} aria-describedby={errors.guests ? 'plan-guests-error' : undefined} />
                  {err('guests')}
                </label>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-bold">Budget <span className="font-normal text-[#6B5A4E]">(optional)</span></legend>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_OPTIONS.map((b) => (
                    <button key={b.id} type="button" aria-pressed={fields.budgetRange === b.id} onClick={() => set('budgetRange', fields.budgetRange === b.id ? '' : b.id)} className={chip(fields.budgetRange === b.id)}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-bold">What do you need? <span className="font-normal text-[#6B5A4E]">(optional, tap any)</span></legend>
                <div className="flex flex-wrap gap-2">
                  {PLAN_SERVICES.map((s) => (
                    <button key={s.id} type="button" aria-pressed={fields.services.includes(s.id)} onClick={() => toggleService(s.id)} className={chip(fields.services.includes(s.id))}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {items.length > 0 && (
                <p className="rounded-2xl bg-[#F4ECDF] px-4 py-3 text-sm text-[#4D3E36]">
                  The {items.length === 1 ? 'service' : `${items.length} services`} in your cart will be sent with this, so your expert can see them.
                </p>
              )}

              {sendError && <p role="alert" className="rounded-2xl bg-[#FEF3F2] px-4 py-3 text-sm font-medium text-[#B42318]">{sendError}</p>}

              <button type="submit" disabled={sending} className="min-h-[58px] rounded-2xl bg-[#7A1238] text-[17px] font-bold text-white transition-colors hover:bg-[#5A0D29] disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238] focus-visible:ring-offset-2">
                {sending ? 'Sending…' : 'Get my free shortlist'}
              </button>
              <p className="text-center text-[13px] leading-snug text-[#6B5A4E]">
                We&apos;ll call or WhatsApp you about your wedding only. No charges for families. Prefer to talk?{' '}
                <a href={`tel:${SHAADI_PHONE}`} className="inline-flex items-center gap-1 font-semibold text-[#7A1238]"><Phone className="h-3.5 w-3.5" aria-hidden />{SHAADI_PHONE_DISPLAY}</a>
              </p>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
