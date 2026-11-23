'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import type { ClientPortalEvent } from '@/services/clientPortal.service';
import { ownVendorProblem, QUOTE_STATUS_WORDS, type OwnVendorInput } from '@/lib/wedding/coupleVendors';
import { serviceStatus, whatsappTo } from '@/lib/customer/myWedding';
import { functionDisplayName } from '@/lib/wedding/coupleFunctions';

// My Wedding → Vendors (22 Nov 2026): booked through the planner, the couple's own outside vendors (clearly not partners), finding
// vendors listed on Shaadi Shopping with "Ask for a quote", and what happened to each request.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const field = 'min-h-11 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 text-base';
const tone = { good: 'bg-[#DCF3E5] text-[#14532D]', wait: 'bg-[#FEF3C7] text-[#78350F]', off: 'bg-white/70 text-[#374151]' } as const;
const REQUEST_TONE: Record<string, string> = { REQUESTED: tone.wait, QUOTED: 'bg-[#E0E7FF] text-[#3730A3]', NOT_AVAILABLE: 'bg-[#FDE8E7] text-[#B42318]', BOOKED: tone.good, CLOSED: tone.off };

interface Listed { id: string; slug: string; name: string; city: string; area: string | null; priceMin: number; priceUnit: string | null; rating: number; reviewCount: number; image: string; category: { name: string } }
type Form = { id: string | null; v: OwnVendorInput & { priceText: string } };

const emptyForm = (): Form => ({ id: null, v: { name: '', category: '', phone: '', price: null, priceText: '', notes: '', weddingEventId: '' } });

export default function CoupleVendors({ event }: { event: ClientPortalEvent }) {
  const router = useRouter();
  // editable: the wedding is still being planned, and this person may change the plan (family access, 23 Nov 2026)
  const open = event.access.canPlan && event.status !== 'COMPLETED' && event.status !== 'CANCELLED';
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ slug: string; name: string }[] | null>(null);
  const [category, setCategory] = useState('');
  const [results, setResults] = useState<{ city: string; inCity: boolean; vendors: Listed[] } | null>(null);
  const [asking, setAsking] = useState<{ vendor: Listed; note: string; fns: string[] } | null>(null);
  const [relinking, setRelinking] = useState<{ id: string; fns: string[] } | null>(null);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const fnPicker = (selected: string[], onChange: (next: string[]) => void) => (
    <fieldset className="grid gap-1">
      <legend className="text-sm text-[var(--color-text-secondary)]">For which functions? <span className="text-xs text-[var(--color-text-muted)]">(none = the whole wedding)</span></legend>
      <div className="flex flex-wrap gap-1.5">
        {event.functions.map((f) => (
          <label key={f.id} className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${selected.includes(f.id) ? 'border-[var(--primary)] bg-[var(--color-primary-subtle-bg)] text-[var(--color-primary-text)]' : 'border-[var(--color-border-default)] bg-white text-[var(--color-text-secondary)]'}`}>
            <input type="checkbox" className="h-4 w-4" checked={selected.includes(f.id)} onChange={() => onChange(toggle(selected, f.id))} />{fnLabel(f)}
          </label>
        ))}
      </div>
    </fieldset>
  );
  // "Mehndi", or the couple's own name for it (never the stored MEHNDI)
  const fnLabel = (f: { type: string; label: string | null }) => functionDisplayName(f);
  const fnName = (id: string | null) => { const f = event.functions.find((x) => x.id === id); return f ? fnLabel(f) : null; };
  const base = `/api/customer/weddings/${event.id}`;

  const call = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save. Please try again.');
    return json.data;
  };
  const act = async (fn: () => Promise<unknown>, done: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await fn();
      setNotice(done);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // The services to choose from load with the section: loading them on the first tap left a phone's picker empty (22 Nov 2026).
  useEffect(() => {
    if (!open) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${base}/vendor-search`);
        const json = await res.json().catch(() => null);
        if (live && res.ok && json?.success) setCategories(json.data);
      } catch {
        /* the picker shows 'Loading…' and the couple can reload */
      }
    }, 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [base, open]);
  const search = async (slug: string) => {
    setCategory(slug);
    setResults(null);
    if (!slug) return;
    try {
      setResults(await call(`${base}/vendor-search?category=${encodeURIComponent(slug)}`, 'GET'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    }
  };

  const v = form?.v;
  const price = v?.priceText.trim() ? Number(v.priceText.replace(/[,\s₹]/g, '')) : null;
  const formProblem = v ? ownVendorProblem({ ...v, price }) : null;
  const requested = new Map(event.quoteRequests.map((r) => [r.vendorSlug, r]));

  return (
    <section id="vendors" aria-labelledby="c-vendors" className="os-glass scroll-mt-4 rounded-[22px] border bg-white p-5 sm:p-6">
      <h2 id="c-vendors" className="text-[17px] font-bold">Your vendors</h2>
      {notice && <p role="status" className="mt-3 rounded-xl bg-[#DCF3E5] px-3 py-2 text-sm text-[#14532D]">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-[#B42318]">{error}</p>}

      {/* Booked through the planner */}
      {/* Who plans the wedding (23 Nov 2026). Shown from the wedding's business; not a vendor booking, price or commission. */}
      {event.business.isShaadiShopping && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--color-primary-border,#DDD6FE)] bg-[var(--color-primary-subtle-bg)] px-3.5 py-3">
          <div className="min-w-0">
            <p className="font-semibold">Shaadi Shopping <span className="font-normal text-[var(--color-text-muted)]">· Wedding planning &amp; coordination</span></p>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{event.functions.length ? `All functions: ${event.functions.map(fnLabel).join(', ')}` : 'Your whole wedding'}</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary-text)]">Your planner</span>
        </div>
      )}

      <h3 className="mt-4 text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-primary-text)]">Booked through {event.business.isShaadiShopping ? 'Shaadi Shopping' : event.business.name}</h3>
      {event.services.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">The vendors for each function appear here once they are booked.</p>
      ) : (
        <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
          {event.services.map((s, i) => {
            const st = serviceStatus(s.status);
            return (
              <li key={`${s.name}-${i}`} className="rounded-2xl border border-white/70 bg-white/55 p-3.5">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-primary-text)]">{s.name}</p>
                <p className="mt-1 font-semibold">{s.provider ?? 'Being chosen'}</p>
                <p className="mt-0.5 text-sm text-[var(--color-text-muted)]"><span className="capitalize">{s.functionName.toLowerCase()}</span> · <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone[st.tone]}`}>{st.words}</span></p>
              </li>
            );
          })}
        </ul>
      )}

      {/* The couple's own vendors */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-primary-text)]">Your own vendors</h3>
        {open && !form && (
          <button type="button" onClick={() => { setNotice(null); setError(null); setForm(emptyForm()); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-white/70 px-4 text-sm font-bold text-[var(--color-primary-text)]">
            <Plus className="h-4 w-4" aria-hidden />Add my own vendor
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Vendors you found and hired yourselves. They are not Shaadi Shopping partners and are not checked by us; we keep them here so the day can be planned together.</p>
      {form && v && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (formProblem) return;
            const body = { name: v.name, category: v.category, phone: v.phone || null, price, notes: v.notes || null, weddingEventId: v.weddingEventId || null };
            void act(() => call(form.id ? `${base}/vendors/${form.id}` : `${base}/vendors`, form.id ? 'PATCH' : 'POST', body), 'Saved.').then((ok) => ok && setForm(null));
          }}
          className="mt-3 grid gap-3 rounded-2xl border border-white/70 bg-white/60 p-4 sm:grid-cols-2"
        >
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Name
            <input aria-label="Vendor name" value={v.name} maxLength={100} onChange={(e) => setForm({ ...form, v: { ...v, name: e.target.value } })} placeholder="e.g. Raju Photo Studio" className={field} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">What they do
            <input aria-label="Service" value={v.category} maxLength={60} onChange={(e) => setForm({ ...form, v: { ...v, category: e.target.value } })} placeholder="e.g. Photographer" className={field} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Mobile <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
            <input aria-label="Mobile" inputMode="tel" value={v.phone ?? ''} onChange={(e) => setForm({ ...form, v: { ...v, phone: e.target.value } })} className={field} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Price agreed ₹ <span className="text-xs text-[var(--color-text-muted)]">(optional, for your own record)</span>
            <input aria-label="Price agreed" inputMode="numeric" value={v.priceText} onChange={(e) => setForm({ ...form, v: { ...v, priceText: e.target.value } })} className={field} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">For which function <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
            <select aria-label="For which function" value={v.weddingEventId ?? ''} onChange={(e) => setForm({ ...form, v: { ...v, weddingEventId: e.target.value } })} className={field}>
              <option value="">All / not sure</option>
              {event.functions.map((f) => <option key={f.id} value={f.id}>{fnLabel(f)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Notes <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
            <input aria-label="Vendor notes" value={v.notes ?? ''} maxLength={500} onChange={(e) => setForm({ ...form, v: { ...v, notes: e.target.value } })} className={field} />
          </label>
          {formProblem && (v.name || v.category) && <p className="text-sm text-[#78350F] sm:col-span-2">{formProblem}</p>}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={busy || !!formProblem} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" disabled={busy} onClick={() => setForm(null)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[var(--color-text-secondary)]">Cancel</button>
          </div>
        </form>
      )}
      {event.ownVendors.length > 0 && (
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {event.ownVendors.map((o) => (
            <li key={o.id} className="rounded-2xl border border-white/70 bg-white/55 p-3.5">
              <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-primary-text)]">{o.category}<span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[#374151]">Added by you · not a Shaadi Shopping partner</span></p>
              <p className="mt-1 font-semibold">{o.name}</p>
              <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{[fnName(o.weddingEventId), o.phone ? `+91 ${o.phone}` : null, o.price !== null ? inr(o.price) : null].filter(Boolean).join(' · ') || ' '}</p>
              {o.notes && <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{o.notes}</p>}
              {open && !form && (
                <span className="mt-1 flex gap-1">
                  <button type="button" onClick={() => { setNotice(null); setForm({ id: o.id, v: { name: o.name, category: o.category, phone: o.phone ?? '', price: o.price, priceText: o.price !== null ? String(o.price) : '', notes: o.notes ?? '', weddingEventId: o.weddingEventId ?? '' } }); }} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--color-primary-text)]"><Pencil className="h-4 w-4" aria-hidden />Change</button>
                  <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Remove ${o.name}?`)) void act(() => call(`${base}/vendors/${o.id}`, 'DELETE'), 'Removed.'); }} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#B42318]"><Trash2 className="h-4 w-4" aria-hidden />Remove</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Find on Shaadi Shopping */}
      <h3 className="mt-6 text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-primary-text)]">Find on Shaadi Shopping</h3>
      {open && (
        <label className="mt-2 grid max-w-sm gap-1 text-sm text-[var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-1"><Search className="h-4 w-4" aria-hidden />What do you need?</span>
          <select aria-label="Vendor type" value={category} onChange={(e) => void search(e.target.value)} className={field}>
            <option value="">{categories ? 'Choose a service…' : 'Loading…'}</option>
            {(categories ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
      )}
      {results && (
        <>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">{results.vendors.length === 0 ? 'No vendors listed for this yet.' : results.inCity ? `Listed in ${results.city}` : `None listed in ${results.city} yet — these are from other cities`}</p>
          <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
            {results.vendors.map((l) => {
              const r = requested.get(l.slug);
              return (
                <li key={l.id} className="flex gap-3 rounded-2xl border border-white/70 bg-white/55 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the vendor's own listing photo, any host */}
                  {l.image && <img src={l.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{l.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{[l.area, l.city].filter(Boolean).join(', ')} · From {inr(l.priceMin)}{l.priceUnit === 'PER_PLATE' ? ' per plate' : ''}{l.rating ? <> · <Star className="inline h-3 w-3" aria-hidden /> {l.rating.toFixed(1)}</> : null}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <a href={`/vendors/${l.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--color-primary-text)]">View <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
                      {r && r.status !== 'CLOSED' && r.status !== 'NOT_AVAILABLE' ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 text-xs font-semibold ${REQUEST_TONE[r.status]}`}>{QUOTE_STATUS_WORDS[r.status]}</span>
                      ) : event.canAskForQuotes ? (
                        <button type="button" onClick={() => setAsking({ vendor: l, note: '', fns: [] })} className="min-h-11 rounded-xl bg-[var(--primary)] px-3 text-sm font-bold text-white">Ask for a quote</button>
                      ) : (
                        <a href={whatsappTo('+917646028228', `Hi, we are planning our wedding ${event.weddingNumber} and would like a quote from ${l.name} (${l.category.name}).`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-[#DCF3E5] px-3 text-sm font-bold text-[#14532D]">Ask Shaadi Shopping</a>
                      )}
                    </div>
                    {asking?.vendor.id === l.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void act(() => call(`${base}/quote-requests`, 'POST', { vendorId: l.id, weddingEventIds: asking.fns, note: asking.note || null }), `Enquiry sent to your expert about ${l.name}. It is not booked yet.`).then((ok) => ok && setAsking(null));
                        }}
                        className="mt-2 grid gap-2"
                      >
                        {fnPicker(asking.fns, (fns) => setAsking({ ...asking, fns }))}
                        <input aria-label="Note for the quote" value={asking.note} maxLength={500} onChange={(e) => setAsking({ ...asking, note: e.target.value })} placeholder="Anything they should know (optional)" className={field} />
                        <div className="flex gap-2">
                          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Sending…' : 'Send request'}</button>
                          <button type="button" onClick={() => setAsking(null)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--color-text-secondary)]">Cancel</button>
                        </div>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Quote requests */}
      {event.quoteRequests.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-primary-text)]">Your vendor enquiries</h3>
          <ul className="mt-2 divide-y divide-white/70 rounded-2xl border border-white/70 bg-white/55">
            {event.quoteRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{r.vendorName} <span className="font-normal text-[var(--color-text-muted)]">· {r.category} · {r.functionIds.length ? r.functionIds.map(fnName).filter(Boolean).join(', ') : 'Whole wedding'}</span></p>
                  <span className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${REQUEST_TONE[r.status]}`}>{QUOTE_STATUS_WORDS[r.status]}</span>
                  {r.staffNote && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{r.staffNote}</p>}
                </div>
                {open && (r.status === 'REQUESTED' || r.status === 'QUOTED') && relinking?.id !== r.id && (
                  <button type="button" onClick={() => setRelinking({ id: r.id, fns: r.functionIds })} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[var(--color-primary-text)]">Change functions</button>
                )}
                {relinking?.id === r.id && (
                  <div className="grid w-full gap-2">
                    {fnPicker(relinking.fns, (fns) => setRelinking({ id: r.id, fns }))}
                    <div className="flex gap-2">
                      <button type="button" disabled={busy} onClick={() => void act(() => call(`${base}/quote-requests/${r.id}`, 'PATCH', { weddingEventIds: relinking.fns }), 'Functions updated. It is still an enquiry.').then((ok) => ok && setRelinking(null))} className="min-h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white disabled:opacity-40">Save</button>
                      <button type="button" onClick={() => setRelinking(null)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--color-text-secondary)]">Cancel</button>
                    </div>
                  </div>
                )}
                {open && (r.status === 'REQUESTED' || r.status === 'QUOTED') && (
                  <button type="button" disabled={busy} onClick={() => void act(() => call(`${base}/quote-requests/${r.id}`, 'DELETE'), 'Request closed.')} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-[var(--color-text-secondary)]">No longer needed</button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
