'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, CardSkeleton } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { FUNCTION_TYPES, FUNCTION_TYPE_LABELS, offeringPriceWords, type FunctionType, type Offering, type OfferingErrors } from '@/lib/venue/offering';

// "What we offer" (Phase C) — the venue's own price list, function by function: Haldi → lawn, decoration, veg plate … with a
// starting price. These become one-tap lines in the quotation form, and what a couple sees when they ask to add a function.
// Phone-first: one function per card, add / change / remove in place.

type Form = { id: string | null; function: FunctionType; name: string; price: string; perPlate: boolean };

const big = 'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold';
const primary = `${big} w-full bg-[var(--primary)] text-[var(--color-on-primary)] disabled:opacity-50`;
const secondary = `${big} w-full border border-[var(--color-border-default)] text-[var(--color-text-primary)] disabled:opacity-50`;

export default function OfferingsScreen() {
  const [items, setItems] = useState<Offering[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<OfferingErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/offerings')
      .then((r) => r.json())
      .then((b) => live && (b.success ? setItems(b.data) : setError(b.error ?? 'Your list could not be loaded. Please try again.')))
      .catch(() => live && setError('Could not reach Vivah OS — please check your connection.'));
    return () => {
      live = false;
    };
  }, []);

  async function call(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendor-os/offerings${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        setItems(b.data);
        setErrors({});
        setBusy(false);
        return true;
      }
      setErrors(b.fieldErrors ?? {});
      setError(b.fieldErrors ? null : (b.error ?? 'Something went wrong. It was not saved — please try again.'));
    } catch {
      setError('Could not reach Vivah OS. It was not saved — please check your connection.');
    }
    setBusy(false);
    return false;
  }

  async function save() {
    if (!form) return;
    const body = { function: form.function, name: form.name, price: form.price, perPlate: form.perPlate };
    if (await (form.id ? call(`/${form.id}`, 'PUT', body) : call('', 'POST', body))) setForm(null);
  }

  const open = (next: Form) => {
    setForm(next);
    setErrors({});
    setError(null);
  };

  if (!items) {
    return (
      <div className="space-y-4">
        <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">What we offer</h1>
        {error ? <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p> : <CardSkeleton />}
      </div>
    );
  }

  const editor = form && (
    <div className="space-y-3 rounded-lg border border-[var(--color-border-subtle)] p-3">
      <Input label="What you offer" value={form.name} onChange={(ev) => setForm({ ...form, name: ev.target.value })} error={errors.name} placeholder="Lawn, decoration, veg plate…" className="min-h-12 text-base" />
      <Input label="Starting price (₹)" inputMode="numeric" value={form.price} onChange={(ev) => setForm({ ...form, price: ev.target.value })} error={errors.price} placeholder="25000" className="min-h-12 text-base" />
      <label className="flex min-h-11 items-center gap-3 text-sm text-[var(--color-text-primary)]">
        <input type="checkbox" checked={form.perPlate} onChange={(ev) => setForm({ ...form, perPlate: ev.target.checked })} className="h-5 w-5" />
        This price is per plate
      </label>
      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      <button type="button" disabled={busy} onClick={save} className={primary}>{busy ? 'Saving…' : 'Save'}</button>
      <button type="button" disabled={busy} onClick={() => setForm(null)} className={secondary}>Cancel</button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">What we offer</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Your services and starting prices for each function. They appear as one-tap lines when you make a quotation, and your customers see them when they ask to add a function.
        </p>
      </div>

      {FUNCTION_TYPES.map((fn) => {
        const mine = items.filter((o) => o.function === fn);
        const adding = form && form.id === null && form.function === fn;
        return (
          <Card key={fn} className="space-y-3">
            <h2 className="font-playfair text-lg font-bold text-[var(--color-text-primary)]">{FUNCTION_TYPE_LABELS[fn]}</h2>
            {mine.length === 0 && !adding && <p className="text-sm text-[var(--color-text-muted)]">Nothing added yet.</p>}
            <ul className="space-y-2">
              {mine.map((o) =>
                form?.id === o.id ? (
                  <li key={o.id}>{editor}</li>
                ) : (
                  <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-[var(--color-text-primary)]">
                      {o.name}
                      <span className="text-[var(--color-text-secondary)]"> · {offeringPriceWords(o)}</span>
                    </span>
                    <span className="flex shrink-0">
                      <button type="button" aria-label={`Change ${o.name}`} disabled={busy} onClick={() => open({ id: o.id, function: o.function, name: o.name, price: String(o.price), perPlate: o.perPlate })} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-text-muted)]">
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button type="button" aria-label={`Remove ${o.name}`} disabled={busy} onClick={() => call(`/${o.id}`, 'DELETE')} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-text-muted)]">
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </span>
                  </li>
                )
              )}
            </ul>
            {adding ? (
              editor
            ) : (
              <button type="button" disabled={busy} onClick={() => open({ id: null, function: fn, name: '', price: '', perPlate: false })} className={secondary}>
                <Plus className="h-5 w-5" aria-hidden /> Add for {FUNCTION_TYPE_LABELS[fn]}
              </button>
            )}
          </Card>
        );
      })}

      {error && !form && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
    </div>
  );
}
