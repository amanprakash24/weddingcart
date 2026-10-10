'use client';

import { useEffect, useState } from 'react';
import { Building2, Camera, Eye, EyeOff, Flower2, type LucideIcon, MoreHorizontal, Package, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { Card, CardSkeleton } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import {
  allowsPerPlate,
  FUNCTION_TYPES,
  FUNCTION_TYPE_LABELS,
  OFFERING_KINDS,
  OFFERING_KIND_EXAMPLES,
  OFFERING_KIND_LABELS,
  OFFERING_LIMITS,
  offeringPriceWords,
  type Catalog,
  type FunctionType,
  type Offering,
  type OfferingErrors,
  type OfferingKind,
} from '@/lib/venue/offering';

// "What we offer" — the business's ONE price list, sorted by kind: the space and things it rents out, food, decoration, services,
// packages. Each item has a starting price, may say what is provided, and may be for one wedding function (Haldi, Reception …) or
// any. The list feeds the quotation form as one-tap lines, and a couple sees it when they ask to add a function.
// Phone-first: one kind per card; add, change, hide and remove in place. A business is shown the kinds that fit it first
// (a caterer is not asked about halls) — the others are one tap away.

type Form = { id: string | null; kind: OfferingKind; function: FunctionType | ''; name: string; description: string; price: string; perPlate: boolean; active: boolean };

const ICON: Record<OfferingKind, LucideIcon> = { RENTAL: Building2, CATERING: UtensilsCrossed, DECORATION: Flower2, SERVICE: Camera, PACKAGE: Package, OTHER: MoreHorizontal };

const big = 'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold';
const primary = `${big} w-full bg-[var(--primary)] text-[var(--color-on-primary)] disabled:opacity-50`;
const secondary = `${big} w-full border border-[var(--color-border-default)] text-[var(--color-text-primary)] disabled:opacity-50`;
const iconButton = 'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-text-muted)] disabled:opacity-40';
const tag = 'rounded-full border border-[var(--color-border-subtle)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]';

const KIND_OPTIONS = OFFERING_KINDS.map((kind) => ({ value: kind, label: OFFERING_KIND_LABELS[kind] }));
const FUNCTION_OPTIONS = [{ value: '', label: 'Any function' }, ...FUNCTION_TYPES.map((fn) => ({ value: fn, label: FUNCTION_TYPE_LABELS[fn] }))];
const blank = (kind: OfferingKind): Form => ({ id: null, kind, function: '', name: '', description: '', price: '', perPlate: false, active: true });
const formOf = (o: Offering): Form => ({ id: o.id, kind: o.kind, function: o.function ?? '', name: o.name, description: o.description ?? '', price: String(o.price), perPlate: o.perPlate, active: o.active });

export default function OfferingsScreen() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<OfferingErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<OfferingKind[]>([]); // kinds the business asked to see, beyond the ones that fit it

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/offerings')
      .then((r) => r.json())
      .then((b) => live && (b.success ? setCatalog(b.data) : setError(b.error ?? 'Your list could not be loaded. Please try again.')))
      .catch(() => live && setError('Could not reach Vivah OS — please check your connection.'));
    return () => {
      live = false;
    };
  }, []);

  async function call(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendor-os/offerings${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        setCatalog(b.data);
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
    const body = { kind: form.kind, function: form.function, name: form.name, description: form.description, price: form.price, perPlate: form.perPlate, active: form.active };
    if (await (form.id ? call(`/${form.id}`, 'PUT', body) : call('', 'POST', body))) setForm(null);
  }

  const open = (next: Form) => {
    setForm(next);
    setErrors({});
    setError(null);
  };

  const title = (
    <div>
      <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">What we offer</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Your price list — everything you sell, in one place. Each item becomes a one-tap line when you make a quotation, and your customers see it when they ask to add a function.
      </p>
    </div>
  );

  if (!catalog) {
    return (
      <div className="space-y-4">
        {title}
        {error ? <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p> : <CardSkeleton />}
      </div>
    );
  }

  const { items, listingPackages } = catalog;
  const has = (kind: OfferingKind) => items.some((o) => o.kind === kind) || (kind === 'PACKAGE' && listingPackages.length > 0);
  // Shown: the kinds that fit this business first, in its own order; then any other kind that already has something or that the
  // business opened.
  const extra = (kind: OfferingKind) => has(kind) || opened.includes(kind) || (form?.id === null && form.kind === kind);
  const shown = [...catalog.kinds, ...OFFERING_KINDS.filter((kind) => !catalog.kinds.includes(kind) && extra(kind))];
  const more = OFFERING_KINDS.filter((kind) => !shown.includes(kind));
  const offered = items.filter((o) => o.active).length;

  const editor = form && (
    <div className="space-y-3 rounded-lg border border-[var(--color-border-subtle)] p-3">
      {form.id && <Select label="Kind" value={form.kind} onChange={(ev) => setForm({ ...form, kind: ev.target.value as OfferingKind })} error={errors.kind} options={KIND_OPTIONS} className="min-h-12 text-base" />}
      <Input label="What you offer" value={form.name} onChange={(ev) => setForm({ ...form, name: ev.target.value })} error={errors.name} placeholder={`${OFFERING_KIND_EXAMPLES[form.kind].split(',')[0]}…`} maxLength={OFFERING_LIMITS.nameMax} className="min-h-12 text-base" />
      <Textarea label="What is provided (optional)" value={form.description} onChange={(ev) => setForm({ ...form, description: ev.target.value })} error={errors.description} rows={2} maxLength={OFFERING_LIMITS.descriptionMax} placeholder="What the customer gets — size, timings, what comes with it" />
      <Input label="Starting price (₹)" inputMode="numeric" value={form.price} onChange={(ev) => setForm({ ...form, price: ev.target.value })} error={errors.price} placeholder="25000" className="min-h-12 text-base" />
      {allowsPerPlate(form.kind) && (
        <label className="flex min-h-11 items-center gap-3 text-sm text-[var(--color-text-primary)]">
          <input type="checkbox" checked={form.perPlate} onChange={(ev) => setForm({ ...form, perPlate: ev.target.checked })} className="h-5 w-5" />
          This price is per plate
        </label>
      )}
      <Select label="For which function?" value={form.function} onChange={(ev) => setForm({ ...form, function: ev.target.value as Form['function'] })} error={errors.function} options={FUNCTION_OPTIONS} className="min-h-12 text-base" />
      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
      <button type="button" disabled={busy} onClick={save} className={primary}>{busy ? 'Saving…' : 'Save'}</button>
      <button type="button" disabled={busy} onClick={() => setForm(null)} className={secondary}>Cancel</button>
    </div>
  );

  return (
    <div className="space-y-5">
      {title}

      {items.length > 0 && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          {items.length} {items.length === 1 ? 'item' : 'items'}
          {offered < items.length ? ` · ${offered} offered, ${items.length - offered} hidden` : ''}
        </p>
      )}

      {shown.map((kind) => {
        const Icon = ICON[kind];
        const mine = items.filter((o) => o.kind === kind);
        const adding = form && form.id === null && form.kind === kind;
        return (
          <Card key={kind} className="space-y-3">
            <section aria-label={OFFERING_KIND_LABELS[kind]} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-surface-muted)] text-[var(--primary)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="font-playfair text-lg font-bold text-[var(--color-text-primary)]">{OFFERING_KIND_LABELS[kind]}</h2>
                  {mine.length === 0 && !adding && <p className="text-sm text-[var(--color-text-muted)]">{OFFERING_KIND_EXAMPLES[kind]}</p>}
                </div>
              </div>

              {mine.length > 0 && (
                <ul className="divide-y divide-[var(--color-border-subtle)]">
                  {mine.map((o) =>
                    form?.id === o.id ? (
                      <li key={o.id} className="py-3">{editor}</li>
                    ) : (
                      <li key={o.id} className={`flex items-start justify-between gap-2 py-3 ${o.active ? '' : 'opacity-60'}`}>
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{o.name}</p>
                          {o.description && <p className="whitespace-pre-line text-sm text-[var(--color-text-secondary)]">{o.description}</p>}
                          <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-primary)]">
                            <span className="font-medium tabular-nums">{offeringPriceWords(o)}</span>
                            <span className={tag}>{o.function ? FUNCTION_TYPE_LABELS[o.function] : 'Any function'}</span>
                            {!o.active && <span className={tag}>Hidden</span>}
                          </p>
                        </div>
                        <span className="flex shrink-0">
                          <button type="button" aria-label={`Change ${o.name}`} disabled={busy} onClick={() => open(formOf(o))} className={iconButton}>
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button type="button" aria-label={o.active ? `Hide ${o.name}` : `Offer ${o.name} again`} title={o.active ? 'Hide — keep it, but stop offering it' : 'Offer it again'} disabled={busy} onClick={() => call(`/${o.id}`, 'PATCH', { active: !o.active })} className={iconButton}>
                            {o.active ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
                          </button>
                          <button type="button" aria-label={`Remove ${o.name}`} disabled={busy} onClick={() => call(`/${o.id}`, 'DELETE')} className={iconButton}>
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </span>
                      </li>
                    )
                  )}
                </ul>
              )}

              {/* Packages on the public Shaadi Shopping page: shown here so there is one place to look; copied in with one tap. */}
              {kind === 'PACKAGE' && listingPackages.length > 0 && (
                <div className="space-y-2 rounded-lg bg-[var(--color-bg-surface-muted)] p-3">
                  <p className="text-xs font-medium text-[var(--color-text-muted)]">On your Shaadi Shopping page</p>
                  <ul className="space-y-2">
                    {listingPackages.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 text-[var(--color-text-primary)]">
                          {p.name}
                          <span className="text-[var(--color-text-secondary)]"> · {offeringPriceWords(p)}</span>
                        </span>
                        {p.copied ? (
                          <span className={tag}>In your list</span>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => call('/from-listing', 'POST', { packageId: p.id })} className="min-h-10 shrink-0 rounded-lg border border-[var(--color-border-default)] px-3 text-sm font-medium text-[var(--color-text-primary)] disabled:opacity-50">
                            Add to my list
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-[var(--color-text-muted)]">Shaadi Shopping looks after what your public page shows. A copy in your list is yours to change.</p>
                </div>
              )}

              {adding ? (
                editor
              ) : (
                <button type="button" disabled={busy} onClick={() => open(blank(kind))} className={secondary}>
                  <Plus className="h-5 w-5" aria-hidden /> Add to {OFFERING_KIND_LABELS[kind]}
                </button>
              )}
            </section>
          </Card>
        );
      })}

      {more.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-text-muted)]">Do you also offer something else?</p>
          <div className="flex flex-wrap gap-2">
            {more.map((kind) => (
              <button key={kind} type="button" disabled={busy} onClick={() => setOpened((k) => [...k, kind])} className="min-h-10 rounded-full border border-[var(--color-border-default)] px-3 text-sm text-[var(--color-text-primary)] disabled:opacity-50">
                + {OFFERING_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && !form && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}
    </div>
  );
}
