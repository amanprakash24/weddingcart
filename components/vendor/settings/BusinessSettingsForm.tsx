'use client';

import { useEffect, useState } from 'react';
import Input from '@/components/ui/Input';
import { Card, CardSkeleton } from '@/components/ui/Card';
import { SETTINGS_LIMITS, type SettingsField } from '@/lib/venue/settings';
import type { VenueSettingsView } from '@/services/venueSettings.service';

// "Settings" (Phase C) — what a venue decides for its OWN customers: the number they call, how much confirms a booking, and how
// long a part payment holds the date. A blank box means "use the default". Only the owner can change them; staff see them.

type Form = Record<SettingsField, string>;

const toForm = (s: VenueSettingsView): Form => ({
  contactPhone: s.contactPhone ?? '',
  confirmationPercent: s.confirmationPercent?.toString() ?? '',
  holdWindowDays: s.holdWindowDays?.toString() ?? '',
  upiId: s.upiId ?? '',
  upiName: s.upiName ?? '',
});

const phoneWords = (p: string) => `${p.slice(0, 5)} ${p.slice(5)}`;

export default function BusinessSettingsForm() {
  const [settings, setSettings] = useState<VenueSettingsView | null>(null);
  const [form, setForm] = useState<Form>({ contactPhone: '', confirmationPercent: '', holdWindowDays: '', upiId: '', upiName: '' });
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/settings')
      .then((r) => r.json())
      .then((body) => {
        if (!live) return;
        if (body.success) {
          setSettings(body.data);
          setForm(toForm(body.data));
        } else setError(body.error ?? 'Your settings could not be loaded. Please try again.');
      })
      .catch(() => live && setError('Could not reach Vivah OS — please check your connection.'));
    return () => {
      live = false;
    };
  }, []);

  const set = (key: SettingsField, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));
    setSaved(false);
  };

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy || !settings?.canEdit) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/vendor-os/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setSettings(body.data);
        setForm(toForm(body.data));
        setErrors({});
        setSaved(true);
      } else {
        setErrors(body.fieldErrors ?? {});
        setError(body.fieldErrors ? null : (body.error ?? 'Something went wrong. Your settings were not saved — please try again.'));
      }
    } catch {
      setError('Could not reach Vivah OS. Your settings were not saved — please check your connection and try again.');
    }
    setBusy(false);
  }

  if (!settings) {
    return (
      <div className="space-y-4">
        <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">Settings</h1>
        {error ? <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p> : <CardSkeleton />}
      </div>
    );
  }

  const L = SETTINGS_LIMITS;
  const readOnly = !settings.canEdit;
  const d = settings.defaults;

  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <div>
        <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {settings.businessName}{' '}
          — for the customers you bring yourself. Customers from Shaadi Shopping keep Shaadi Shopping&rsquo;s rule and number.
        </p>
      </div>

      {readOnly && <p className="text-sm text-[var(--color-text-muted)]">Only the owner can change these settings.</p>}

      <Card>
        <div className="space-y-4">
          <Input
            label="Phone number your customers see"
            value={form.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
            error={errors.contactPhone}
            helperText={
              form.contactPhone.trim()
                ? 'Shown on the proposal link you send to your customers.'
                : settings.shownPhone
                  ? `Leave blank to show your listing number, ${phoneWords(settings.shownPhone)}.`
                  : 'Blank: your proposal link shows no number to call or WhatsApp.'
            }
            inputMode="tel"
            placeholder="98765 43210"
            className="min-h-12 text-base"
            readOnly={readOnly}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="To confirm a booking (%)"
              value={form.confirmationPercent}
              onChange={(e) => set('confirmationPercent', e.target.value)}
              error={errors.confirmationPercent}
              helperText={`${L.percentMin}–${L.percentMax}. Blank = ${d.confirmationPercent}%`}
              inputMode="numeric"
              placeholder={String(d.confirmationPercent)}
              className="min-h-12 text-base"
              readOnly={readOnly}
            />
            <Input
              label="A part payment holds the date for (days)"
              value={form.holdWindowDays}
              onChange={(e) => set('holdWindowDays', e.target.value)}
              error={errors.holdWindowDays}
              helperText={`${L.daysMin}–${L.daysMax}. Blank = ${d.holdWindowDays} days`}
              inputMode="numeric"
              placeholder={String(d.holdWindowDays)}
              className="min-h-12 text-base"
              readOnly={readOnly}
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">A change applies to new bookings only. A booking already agreed keeps the rule it was made with.</p>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <Input
            label="UPI ID for payments"
            value={form.upiId}
            onChange={(e) => set('upiId', e.target.value)}
            error={errors.upiId}
            helperText="Optional. Added to the payment details you send a customer after they accept your quotation."
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="yourname@okhdfcbank"
            className="min-h-12 text-base"
            readOnly={readOnly}
          />
          <Input
            label="Name on the UPI account"
            value={form.upiName}
            onChange={(e) => set('upiName', e.target.value)}
            error={errors.upiName}
            helperText="Optional. So your customer can check they are paying the right account."
            placeholder={settings.businessName}
            className="min-h-12 text-base"
            readOnly={readOnly}
          />
        </div>
      </Card>

      {settings.numberPrefix && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Your document code is <span className="font-semibold text-[var(--color-text-primary)]">{settings.numberPrefix}</span> — your quotations and invoices are numbered {settings.numberPrefix}-QTN-… and {settings.numberPrefix}-INV-…
        </p>
      )}

      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      {saved && <p role="status" className="text-sm text-[var(--color-text-primary)]">Saved.</p>}
      {!readOnly && (
        <button type="submit" disabled={busy} className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[var(--primary)] text-base font-semibold text-[var(--color-on-primary)] disabled:opacity-50">
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      )}
    </form>
  );
}
