'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Check, ChevronDown, Phone } from 'lucide-react';
import WeddingDashboardClient from '@/components/WeddingDashboardClient';
import LivePlanPreview from '@/components/plan/LivePlanPreview';
import { trackConsultationLeadConversion } from '@/lib/analytics/googleAds';
import { useCart } from '@/context/CartContext';
import { EVENT_LABELS, type PlanFormData } from '@/lib/planPreview';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';
import {
  BUDGET_OPTIONS, BUDGET_QUERY_MAP, CAPACITY_GUIDE, CITIES, DAY_OPTIONS, EVENT_TYPES, FOOD_OPTIONS, MAIN_SERVICES, MEALS,
  MORE_SERVICES, SETTINGS, STYLES, VENUE_TYPES, checkPlanForm, planPayload, type QuickField,
} from '@/lib/plan/shortPlan';
import { serif } from '@/components/home/styles';

// /plan (25 Oct 2026). Founder: the 5-step wizard was "too long" — but "I need all things, don't remove anything". So every
// question stays, on one page: the four details the server needs first (name, mobile, date, guests) with a Send button, and
// the rest in folded "Tell us more" sections. Saved as before (POST /api/consultations → a consultation in the CRM); answers
// the server has no field for go in the message (lib/plan/shortPlan.ts).
const input =
  'min-h-[52px] w-full min-w-0 rounded-[14px] border border-[#E2D3BC] bg-[#FBF6EE] px-3.5 text-base text-[#221714] outline-none focus-visible:border-[#7A1238] focus-visible:ring-2 focus-visible:ring-[#7A1238]/25';
const chip = (on: boolean) =>
  `min-h-[44px] rounded-full border px-4 text-[15px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238]/40 ${
    on ? 'border-[#7A1238] bg-[#7A1238] text-white' : 'border-[#E2D3BC] bg-white text-[#221714] hover:border-[#7A1238]'
  }`;
const card = (on: boolean) =>
  `rounded-2xl p-3.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238]/40 ${
    on ? 'border-2 border-[#7A1238] bg-[#FBF1F4]' : 'border border-[#E2D3BC] bg-white hover:border-[#7A1238]'
  }`;
const label = 'flex flex-col gap-1.5 text-sm font-semibold text-[#221714]';
const sub = 'font-normal text-[#6B5A4E]';

function Section({ title, hint, summary, children }: { title: string; hint: string; summary: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-[22px] border border-[#EADFCC] bg-white">
      <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238]/40 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-base font-bold text-[#221714]">{title}</span>
          <span className="block truncate text-[13px] text-[#6B5A4E]">{summary || hint}</span>
        </span>
        <ChevronDown className="h-5 w-5 flex-shrink-0 text-[#8A6A2F] transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-5 border-t border-[#F0E6D6] px-5 py-5">{children}</div>
    </details>
  );
}

export default function PlanPageClient() {
  const { items, total, clearCart } = useCart();
  const searchParams = useSearchParams();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [form, setForm] = useState<PlanFormData>(() => ({
    name: '', phone: '', email: '', city: 'Patna', weddingDate: '', days: 1,
    guestCount: 0, foodPreference: '', weddingStyle: '', budgetRange: BUDGET_QUERY_MAP[searchParams.get('budget') ?? ''] ?? '',
    eventType: 'wedding', services: [], meals: {}, venueType: '', consultationDate: '', preferredTime: '', message: '',
  }));
  const [guestsText, setGuestsText] = useState('');
  const [setting, setSetting] = useState('');
  const [errors, setErrors] = useState<Partial<Record<QuickField, string>>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState(false);

  const update = <K extends keyof PlanFormData>(key: K, value: PlanFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  // From the latest state, so quick taps one after another all count.
  const toggleService = (id: string) =>
    setForm((f) => ({ ...f, services: f.services.includes(id) ? f.services.filter((s) => s !== id) : [...f.services, id] }));
  const toggleMeal = (day: number, meal: string) =>
    setForm((f) => {
      const current = f.meals[day] ?? [];
      return { ...f, meals: { ...f.meals, [day]: current.includes(meal) ? current.filter((m) => m !== meal) : [...current, meal] } };
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError('');
    const problems = checkPlanForm(form, today);
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      document.getElementById('plan-quick')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planPayload(form, setting, items, total)),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error();
      setSent(true);
      clearCart();
      trackConsultationLeadConversion();
      window.scrollTo({ top: 0 });
    } catch {
      setSendError(`We could not send your details. Please try again, or call us on ${SHAADI_PHONE_DISPLAY}.`);
    } finally {
      setSending(false);
    }
  };

  if (sent) return <WeddingDashboardClient form={form} cartTotal={total} />;

  const err = (key: QuickField) =>
    errors[key] ? <p id={`plan-${key}-error`} role="alert" className="text-[13px] font-medium text-[#B42318]">{errors[key]}</p> : null;
  const described = (key: QuickField) => ({ 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `plan-${key}-error` : undefined });
  const eventLabel = (EVENT_LABELS[form.eventType] || 'event').toLowerCase();
  const labelFor = (list: readonly { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? '';
  const mealsChosen = Object.entries(form.meals).filter(([d, m]) => Number(d) <= form.days && m.length > 0).length;

  const send = (
    <button type="submit" disabled={sending} className="min-h-[58px] w-full rounded-2xl bg-[#7A1238] text-[17px] font-bold text-white transition-colors hover:bg-[#5A0D29] disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238] focus-visible:ring-offset-2">
      {sending ? 'Sending…' : 'Get my free shortlist'}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#FBF6EE] text-[#221714]">
      {/* Clears the fixed announcement bar (36px) and the navbar (52 / 64 / 72px) */}
      <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-[112px] sm:px-6 sm:pt-[128px] lg:pt-[144px]">
        <div className="max-w-[760px]">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#8A6A2F]">Free for families</p>
          <h1 className="mt-3 text-[2.5rem] font-semibold leading-[1.03] tracking-[-0.01em] sm:text-[3.2rem] lg:text-[3.8rem]" style={serif}>
            Plan your wedding <span className="italic text-[#7A1238]">with an expert.</span>
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-[#4D3E36] sm:text-lg">
            Four quick details are enough to send. Add more below if you like — the more you tell us, the closer your first shortlist.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <form onSubmit={submit} noValidate aria-label="Plan your wedding" className="min-w-0 space-y-4">
            {/* 1. The four details the server needs */}
            <section id="plan-quick" aria-labelledby="plan-quick-h" className="scroll-mt-32 rounded-[26px] border border-[#EADFCC] bg-white p-5 shadow-[0_18px_50px_rgba(34,23,20,0.08)] sm:p-7">
              <h2 id="plan-quick-h" className="text-[1.7rem] font-semibold" style={serif}>Quick details</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className={label}>
                  Your name
                  <input className={input} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Full name" autoComplete="name" {...described('name')} />
                  {err('name')}
                </label>
                <label className={label}>
                  Mobile number
                  <span className={`${input} flex items-center overflow-hidden px-0 focus-within:border-[#7A1238] focus-within:ring-2 focus-within:ring-[#7A1238]/25`}>
                    <span className="border-r border-[#E2D3BC] px-3 font-semibold text-[#6B5A4E]">+91</span>
                    <input className="min-h-[50px] min-w-0 flex-1 bg-transparent px-3 text-base outline-none" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="10 digits" autoComplete="tel-national" {...described('phone')} />
                  </span>
                  {err('phone')}
                </label>
                <label className={label}>
                  {form.eventType === 'wedding' ? 'Wedding date' : 'Event date'}
                  <input className={input} type="date" min={today} value={form.weddingDate} onChange={(e) => update('weddingDate', e.target.value)} {...described('weddingDate')} />
                  {err('weddingDate')}
                </label>
                <label className={label}>
                  Number of guests
                  <input className={input} type="number" inputMode="numeric" min={1} value={guestsText} onChange={(e) => { setGuestsText(e.target.value); update('guestCount', Number(e.target.value)); }} placeholder="e.g. 300" {...described('guestCount')} />
                  {err('guestCount')}
                </label>
              </div>
              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-bold">Total budget <span className={sub}>(optional)</span></legend>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_OPTIONS.map((b) => (
                    <button key={b.id} type="button" aria-pressed={form.budgetRange === b.id} onClick={() => update('budgetRange', form.budgetRange === b.id ? '' : b.id)} className={chip(form.budgetRange === b.id)}>{b.label}</button>
                  ))}
                </div>
              </fieldset>
              <div className="mt-6 hidden sm:block">{send}</div>
            </section>

            <p className="px-1 pt-2 text-sm font-bold uppercase tracking-[0.14em] text-[#8A6A2F]">Tell us more <span className="font-normal normal-case tracking-normal text-[#6B5A4E]">(optional — tap a section)</span></p>

            {/* 2. Event */}
            <Section
              title="Your event"
              hint="What, where, how many days, food, email"
              summary={[labelFor(EVENT_TYPES, form.eventType), form.city, `${form.days} day${form.days > 1 ? 's' : ''}`, labelFor(FOOD_OPTIONS, form.foodPreference)].filter(Boolean).join(' · ')}
            >
              <fieldset>
                <legend className="mb-2 text-sm font-bold">What are you planning?</legend>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((t) => <button key={t.id} type="button" aria-pressed={form.eventType === t.id} onClick={() => update('eventType', t.id)} className={chip(form.eventType === t.id)}>{t.label}</button>)}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className={label}>City<select className={input} value={form.city} onChange={(e) => update('city', e.target.value)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className={label}>Number of days<select className={input} value={form.days} onChange={(e) => update('days', Number(e.target.value))}>{DAY_OPTIONS.map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}</select></label>
                <label className={label}>Email <span className={sub}>(optional)</span><input className={input} type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-bold">Food</legend>
                <div className="flex flex-wrap gap-2">
                  {FOOD_OPTIONS.map((f) => <button key={f.id} type="button" aria-pressed={form.foodPreference === f.id} onClick={() => update('foodPreference', form.foodPreference === f.id ? '' : f.id)} className={chip(form.foodPreference === f.id)}>{f.label}</button>)}
                </div>
              </fieldset>
            </Section>

            {/* 3. Services */}
            <Section title="What would you like help with?" hint="Venue, catering, decor, photo and more" summary={form.services.length > 0 ? `${form.services.length} picked` : ''}>
              <fieldset>
                <legend className="mb-2 text-sm font-bold">Main services</legend>
                <div className="flex flex-wrap gap-2">
                  {MAIN_SERVICES.map((s) => <button key={s.id} type="button" aria-pressed={form.services.includes(s.id)} onClick={() => toggleService(s.id)} className={chip(form.services.includes(s.id))}>{s.label}</button>)}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-bold">More on request</legend>
                <div className="flex flex-wrap gap-2">
                  {MORE_SERVICES.map((s) => <button key={s.id} type="button" aria-pressed={form.services.includes(s.id)} onClick={() => toggleService(s.id)} className={chip(form.services.includes(s.id))}>{s.label}</button>)}
                </div>
              </fieldset>
            </Section>

            {/* 4. Venue and meals */}
            <Section
              title="Venue and meals"
              hint="Kind of venue, indoor or outdoor, meals each day"
              summary={[labelFor(VENUE_TYPES, form.venueType), labelFor(SETTINGS, setting), mealsChosen ? `meals for ${mealsChosen} day${mealsChosen > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}
            >
              <fieldset>
                <legend className="mb-2 text-sm font-bold">Kind of venue</legend>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {VENUE_TYPES.map((v) => (
                    <button key={v.id} type="button" aria-pressed={form.venueType === v.id} onClick={() => update('venueType', form.venueType === v.id ? '' : v.id)} className={card(form.venueType === v.id)}>
                      <span className="block text-[15px] font-bold">{v.label}</span>
                      <span className="mt-0.5 block text-[13px] text-[#6B5A4E]">{v.desc}</span>
                    </button>
                  ))}
                </div>
                <details className="mt-3 text-sm text-[#4D3E36]">
                  <summary className="inline-flex min-h-[44px] cursor-pointer items-center font-semibold text-[#7A1238]">Venue capacity guide</summary>
                  <ul className="mt-1 space-y-1">{CAPACITY_GUIDE.map(([v, t]) => <li key={v}><b>{v}</b> — {t}</li>)}</ul>
                </details>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-bold">Indoor or outdoor</legend>
                <div className="grid grid-cols-3 gap-2.5">
                  {SETTINGS.map((s) => (
                    <button key={s.id} type="button" aria-pressed={setting === s.id} onClick={() => setSetting(setting === s.id ? '' : s.id)} className={card(setting === s.id)}>
                      <span className="block text-[15px] font-bold">{s.label}</span>
                      <span className="mt-0.5 block text-[13px] text-[#6B5A4E]">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-bold">Meals for each day <span className={sub}>({form.days} day{form.days > 1 ? 's' : ''} — change in &ldquo;Your event&rdquo;)</span></legend>
                <div className="space-y-2.5">
                  {Array.from({ length: form.days }, (_, i) => i + 1).map((day) => (
                    <div key={day} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#EADFCC] bg-[#FBF6EE] px-3.5 py-3">
                      <span className="w-14 text-sm font-bold">Day {day}</span>
                      {MEALS.map((m) => {
                        const on = (form.meals[day] ?? []).includes(m);
                        return <button key={m} type="button" aria-pressed={on} onClick={() => toggleMeal(day, m)} className={chip(on)}>{m}</button>;
                      })}
                    </div>
                  ))}
                </div>
              </fieldset>
            </Section>

            {/* 5. Style */}
            <Section title="Celebration style" hint="Traditional, royal, modern…" summary={labelFor(STYLES, form.weddingStyle)}>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {STYLES.map((s) => (
                  <button key={s.id} type="button" aria-pressed={form.weddingStyle === s.id} onClick={() => update('weddingStyle', form.weddingStyle === s.id ? '' : s.id)} className={card(form.weddingStyle === s.id)}>
                    <span className="block text-[1.4rem] font-semibold leading-tight" style={serif}>{s.label}</span>
                    <span className="mt-1 block text-[13px] text-[#6B5A4E]">{s.note}</span>
                  </button>
                ))}
              </div>
            </Section>

            {/* 6. The call */}
            <Section
              title="Your call with the expert"
              hint="When to call, and anything else to tell us"
              summary={[form.consultationDate, form.preferredTime, form.message.trim() ? 'note added' : ''].filter(Boolean).join(' · ')}
            >
              <div className="flex items-center gap-3.5 rounded-2xl border border-[#EADFCC] bg-[#FBF6EE] p-3.5">
                <Image src="/images/anisha.jpg" alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-full border-2 border-[#E9C98E] object-cover object-top" />
                <p className="text-sm text-[#4D3E36]"><b className="text-[#221714]">A free 30-minute call</b> with your Wedding Expert from our Patna team, Mon–Sat, 10am–7pm.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>Day for the call <span className={sub}>(optional)</span><input className={input} type="date" min={today} value={form.consultationDate} onChange={(e) => update('consultationDate', e.target.value)} /></label>
                <label className={label}>Time <span className={sub}>(optional)</span><input className={input} type="time" value={form.preferredTime} onChange={(e) => update('preferredTime', e.target.value)} /></label>
              </div>
              <label className={label}>Anything else? <span className={sub}>(optional)</span>
                <textarea rows={4} maxLength={1500} className={`${input} py-3`} value={form.message} onChange={(e) => update('message', e.target.value)} placeholder="Theme ideas, must-haves, questions for your expert…" />
              </label>
            </Section>

            {items.length > 0 && (
              <p className="rounded-2xl bg-[#F4ECDF] px-4 py-3 text-sm text-[#4D3E36]">
                The {items.length === 1 ? 'service' : `${items.length} services`} in your cart will be sent with this, so your expert can see them.
              </p>
            )}
            {sendError && <p role="alert" className="rounded-2xl bg-[#FEF3F2] px-4 py-3 text-sm font-medium text-[#B42318]">{sendError}</p>}

            <div className="sticky bottom-0 z-10 -mx-4 border-t border-[#EADFCC] bg-[#FBF6EE]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
              {send}
            </div>
            <p className="text-center text-[13px] leading-snug text-[#6B5A4E]">
              We&apos;ll call or WhatsApp you about your {eventLabel} only. No charges for families. Prefer to talk?{' '}
              <a href={`tel:${SHAADI_PHONE}`} className="inline-flex min-h-[32px] items-center gap-1 font-semibold text-[#7A1238]"><Phone className="h-3.5 w-3.5" aria-hidden />{SHAADI_PHONE_DISPLAY}</a>
            </p>
          </form>

          <aside aria-label="Your plan so far" className="min-w-0 lg:sticky lg:top-[120px]">
            <LivePlanPreview form={form} step={4} />
            <ul className="mt-4 hidden space-y-2.5 rounded-[22px] border border-[#EADFCC] bg-white p-5 text-sm text-[#4D3E36] lg:block">
              {['One person for your whole wedding', 'Real Patna venues with their prices', 'Visits and quotations arranged for you'].map((t) => (
                <li key={t} className="flex items-center gap-2.5"><Check className="h-4 w-4 text-[#7A1238]" strokeWidth={2.4} aria-hidden />{t}</li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
