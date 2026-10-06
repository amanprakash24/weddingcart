'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { CHANNELS, CHANNEL_LABEL, type Channel } from '@/lib/venue/enquiry';

// "+ New Enquiry" (audit brief §26): name, phone, wedding date, guests, what they need, where they came from. Save — and Vivah OS
// says what to do next. Only name, phone and "where from" are required, so it takes seconds during a phone call.

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

export default function NewEnquiryForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', weddingDate: '', guestCount: '', need: '', channel: 'PHONE' as Channel });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));
  };

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

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">New Enquiry</h1>
      <Input label="Customer name" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoComplete="off" className="min-h-12 text-base" required />
      <Input label="Mobile number" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} inputMode="tel" placeholder="98765 43210" className="min-h-12 text-base" required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Wedding date" type="date" min={today()} value={form.weddingDate} onChange={(e) => set('weddingDate', e.target.value)} error={errors.weddingDate} helperText="If known" className="min-h-12 text-base" />
        <Input label="Guests" inputMode="numeric" value={form.guestCount} onChange={(e) => set('guestCount', e.target.value)} error={errors.guestCount} helperText="If known" placeholder="300" className="min-h-12 text-base" />
      </div>
      <Textarea label="What do they need?" value={form.need} onChange={(e) => set('need', e.target.value)} error={errors.need} rows={3} placeholder="Hall for the reception, veg catering for 300…" />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Where did they come from?</legend>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={form.channel === c}
              onClick={() => set('channel', c)}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium ${form.channel === c ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--color-on-primary)]' : 'border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]'}`}
            >
              {CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>
        {errors.channel && <p className="mt-1 text-xs text-[var(--color-danger-text)]">{errors.channel}</p>}
      </fieldset>

      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      <button type="submit" disabled={busy} className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[var(--primary)] text-base font-semibold text-[var(--color-on-primary)] disabled:opacity-50">
        {busy ? 'Saving…' : 'Save enquiry'}
      </button>
    </form>
  );
}
