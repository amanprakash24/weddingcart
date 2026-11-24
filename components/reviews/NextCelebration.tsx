'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarHeart, Gift, Users } from 'lucide-react';
import { NEXT_EVENT_KINDS, RETURNING_OFFER, checkNextEvent } from '@/lib/reviews/nextEvent';

// "This is not goodbye" on /review (24 Nov 2026): tell us about your next celebration (with the returning-family offer), or refer a
// relative or friend. Each request reaches the Shaadi Shopping team as a consultation to call back.

type Mode = 'NEXT' | 'REFERRAL';
const field = 'min-h-12 w-full rounded-xl border border-[#E8DCC8] bg-[#FFFCF7] px-3.5 text-base outline-none focus:border-[#C5A46D] focus:ring-2 focus:ring-[#C5A46D]/25';
const serif = { fontFamily: 'var(--font-playfair), serif' };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const empty = { name: '', phone: '', eventType: 'anniversary', month: '', note: '', referrerName: '', referrerPhone: '', website: '' };

export default function NextCelebration() {
  const [mode, setMode] = useState<Mode>('NEXT');
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Mode | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...f, kind: mode };
    const checked = checkNextEvent(body, today());
    if (!checked.ok) return setError(checked.error);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reviews/next-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not send. Please try again.');
      setDone(mode);
      setF(empty);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const tab = (m: Mode, label: string, short: string, Icon: typeof Users) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); setDone(null); }}
      className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold transition sm:gap-2 sm:px-4 sm:text-sm ${mode === m ? 'bg-[#7A1238] text-white shadow' : 'text-[#7A1238] hover:bg-white/70'}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden /><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <section id="next" data-depth aria-labelledby="next-title" className="scroll-mt-20 bg-[#F4ECDF] px-4 py-14 sm:py-20">
      <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8A6A2F]">This is not goodbye</p>
          <h2 id="next-title" className="mt-3 text-3xl leading-tight sm:text-4xl" style={serif}>You are part of the Shaadi Shopping family now</h2>
          <p className="mt-4 text-base leading-relaxed text-[#4D3E36]">
            The wedding was the first celebration we planned together — not the last. Anniversaries, a Griha Pravesh, a Janeu, a birthday,
            the next wedding in the family: welcome back, every time.
          </p>
          <div data-tilt className="mt-6 rounded-[22px] bg-gradient-to-br from-[#7A1238] to-[#4A0B22] p-5 text-white shadow-[0_24px_50px_rgba(122,18,56,0.28)]">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#E7CFA0]"><Gift className="h-4 w-4" aria-hidden />Returning families</p>
            <p className="mt-2 text-2xl" style={serif}>{RETURNING_OFFER.headline}*</p>
            <p className="mt-2 text-xs text-white/75">*{RETURNING_OFFER.terms ?? RETURNING_OFFER.termsNote}</p>
          </div>
          <p className="mt-5 text-sm text-[#4D3E36]">
            Know many families and businesses planning events? <Link href="/growth-partner" className="font-semibold text-[#7A1238] underline underline-offset-4">Become a Growth Partner</Link>.
          </p>
        </div>

        <div data-tilt className="rounded-[26px] border border-[#E8DCC8] bg-white p-5 shadow-[0_24px_60px_rgba(34,23,20,0.10)] sm:p-7">
          <div role="tablist" aria-label="What would you like to tell us?" className="flex gap-1 rounded-full bg-[#F4ECDF] p-1">
            {tab('NEXT', 'Our next celebration', 'Next event', CalendarHeart)}
            {tab('REFERRAL', 'Refer family & friends', 'Refer someone', Users)}
          </div>

          {done ? (
            <div role="status" className="mt-6 rounded-2xl bg-[#F3EBDD] p-5 text-[#4D3E36]">
              <p className="text-lg font-semibold text-[#7A1238]">{done === 'NEXT' ? 'Wonderful — we will call you soon.' : 'Thank you for thinking of us!'}</p>
              <p className="mt-1 text-sm">{done === 'NEXT' ? 'Your Wedding Expert will get in touch to plan your next celebration together.' : 'We will reach out to them gently and tell them you sent us.'}</p>
              <button type="button" onClick={() => setDone(null)} className="mt-3 min-h-11 text-sm font-semibold text-[#7A1238] underline underline-offset-4">Tell us about another</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-5 grid gap-4">
              <p className="text-sm text-[#6B5A50]">{mode === 'NEXT' ? 'Planning something next? We will call you to plan it together.' : 'A relative or friend planning a celebration? We will take good care of them.'}</p>
              <label className="grid gap-1 text-sm font-semibold">{mode === 'NEXT' ? 'What are you celebrating next?' : 'What are they celebrating?'}
                <select value={f.eventType} onChange={(e) => setF({ ...f, eventType: e.target.value })} className={field}>
                  {NEXT_EVENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">{mode === 'NEXT' ? 'Your name' : 'Their name'}
                  <input value={f.name} maxLength={60} autoComplete={mode === 'NEXT' ? 'name' : 'off'} onChange={(e) => setF({ ...f, name: e.target.value })} className={field} />
                </label>
                <label className="grid gap-1 text-sm font-semibold">{mode === 'NEXT' ? 'Your mobile' : 'Their mobile'}
                  <input value={f.phone} inputMode="tel" autoComplete={mode === 'NEXT' ? 'tel' : 'off'} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="10-digit mobile" className={field} />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-semibold">Around when? <span className="font-normal text-[#8A7A70]">(optional)</span>
                <input type="month" value={f.month} min={today().slice(0, 7)} onChange={(e) => setF({ ...f, month: e.target.value })} className={field} />
              </label>
              {mode === 'REFERRAL' && (
                <div className="grid gap-4 rounded-2xl bg-[#FBF7F1] p-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-semibold">Your name
                    <input value={f.referrerName} maxLength={60} autoComplete="name" onChange={(e) => setF({ ...f, referrerName: e.target.value })} className={field} />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">Your mobile <span className="font-normal text-[#8A7A70]">(optional)</span>
                    <input value={f.referrerPhone} inputMode="tel" autoComplete="tel" onChange={(e) => setF({ ...f, referrerPhone: e.target.value })} placeholder="10-digit mobile" className={field} />
                  </label>
                </div>
              )}
              <label className="grid gap-1 text-sm font-semibold">Anything we should know? <span className="font-normal text-[#8A7A70]">(optional)</span>
                <textarea value={f.note} maxLength={500} rows={3} onChange={(e) => setF({ ...f, note: e.target.value })} className={`${field} py-3`} />
              </label>
              <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} name="website" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              {error && <p role="alert" className="text-sm text-[#B42318]">{error}</p>}
              <button type="submit" disabled={busy} className="min-h-12 rounded-full bg-[#7A1238] px-6 text-base font-semibold text-white hover:bg-[#5E0D2B] disabled:opacity-50">
                {busy ? 'Sending…' : mode === 'NEXT' ? 'Plan our next celebration' : 'Send their details'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
