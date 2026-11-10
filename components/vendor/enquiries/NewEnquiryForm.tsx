'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { CHANNELS, CHANNEL_LABEL, DAYS_MAX, EVENT_KINDS, WEDDING_FUNCTIONS, type Channel, type EventKind, type WeddingFunction } from '@/lib/venue/enquiry';

// "+ New Enquiry" (audit brief §26; fuller since 11 Nov 2026, Vivah OS phase 1): name, phone, what they celebrate, date, days, a
// wedding's functions, guests, budget, what they need, where they came from. Only name, phone and "where from" are required, so it
// takes seconds during a phone call. The same fields as the venue's public enquiry page (lib/venue/enquiry.ts validateNewEnquiry).

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const pill = (on: boolean) =>
  `min-h-11 rounded-full border px-4 text-sm font-medium ${on ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--color-on-primary)]' : 'border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]'}`;

type Form = { name: string; phone: string; eventType: EventKind; weddingDate: string; days: string; functions: WeddingFunction[]; guestCount: string; budget: string; need: string; channel: Channel };

export default function NewEnquiryForm() {
  const router = useRouter();
  const [form, setForm] = useState<Form>({ name: '', phone: '', eventType: 'wedding', weddingDate: '', days: '1', functions: [], guestCount: '', budget: '', need: '', channel: 'PHONE' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));
  };
  const toggle = (fn: WeddingFunction) => set('functions', form.functions.includes(fn) ? form.functions.filter((f) => f !== fn) : [...form.functions, fn]);

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/vendor-os/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        router.push(`/vendor/enquiries/${body.data.id}?added=1`);
        return;
      }
      setErrors(body.fieldErrors ?? {});
      setError(body.fieldErrors ? null : (body.error ?? 'Something went wrong. Your enquiry was not saved — please try again.'));
    } catch {
      setError('Could not reach Vivah OS. Your enquiry was not saved — please check your connection and try again.');
    }
    setBusy(false);
  }

  const fieldError = (k: string) => (errors[k] ? <p className="mt-1 text-xs text-[var(--color-danger-text)]">{errors[k]}</p> : null);

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">New Enquiry</h1>
      <Input label="Customer name" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoComplete="off" className="min-h-12 text-base" required />
      <Input label="Mobile number" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} inputMode="tel" placeholder="98765 43210" className="min-h-12 text-base" required />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">What are they celebrating?</legend>
        <div className="flex flex-wrap gap-2">
          {EVENT_KINDS.map((k) => (
            <button key={k.id} type="button" aria-pressed={form.eventType === k.id} onClick={() => set('eventType', k.id)} className={pill(form.eventType === k.id)}>{k.label}</button>
          ))}
        </div>
        {fieldError('eventType')}
      </fieldset>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Input label="Date" type="date" min={today()} value={form.weddingDate} onChange={(e) => set('weddingDate', e.target.value)} error={errors.weddingDate} helperText="If known" className="min-h-12 text-base" />
        <div>
          <label htmlFor="ne-days" className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]">Days</label>
          <select id="ne-days" value={form.days} onChange={(e) => set('days', e.target.value)} className="min-h-12 w-24 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-base text-[var(--color-text-primary)]">
            {Array.from({ length: DAYS_MAX }, (_, i) => String(i + 1)).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {fieldError('days')}
        </div>
      </div>

      {form.eventType === 'wedding' && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Functions <span className="font-normal text-[var(--color-text-muted)]">(if known)</span></legend>
          <div className="flex flex-wrap gap-2">
            {WEDDING_FUNCTIONS.map((f) => (
              <button key={f.id} type="button" aria-pressed={form.functions.includes(f.id)} onClick={() => toggle(f.id)} className={pill(form.functions.includes(f.id))}>{f.label}</button>
            ))}
          </div>
          {fieldError('functions')}
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input label="Guests" inputMode="numeric" value={form.guestCount} onChange={(e) => set('guestCount', e.target.value)} error={errors.guestCount} helperText="If known" placeholder="300" className="min-h-12 text-base" />
        <Input label="Budget (₹)" inputMode="numeric" value={form.budget} onChange={(e) => set('budget', e.target.value)} error={errors.budget} helperText="If they said" placeholder="5,00,000" className="min-h-12 text-base" />
      </div>
      <Textarea label="What do they need?" value={form.need} onChange={(e) => set('need', e.target.value)} error={errors.need} rows={3} placeholder="Hall for the reception, veg catering for 300…" />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Where did they come from?</legend>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button key={c} type="button" aria-pressed={form.channel === c} onClick={() => set('channel', c)} className={pill(form.channel === c)}>
              {CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>
        {fieldError('channel')}
      </fieldset>

      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      <button type="submit" disabled={busy} className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[var(--primary)] text-base font-semibold text-[var(--color-on-primary)] disabled:opacity-50">
        {busy ? 'Saving…' : 'Save enquiry'}
      </button>
    </form>
  );
}
