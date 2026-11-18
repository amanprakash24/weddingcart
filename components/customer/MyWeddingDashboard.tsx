'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { CalendarDays, CheckCircle2, CreditCard, FileText, Home, KeyRound, LogOut, MapPin, Phone, ShoppingBag, Users } from 'lucide-react';
import type { ClientPortalEvent } from '@/services/clientPortal.service';
import GuestRsvp from '@/components/wedding/workspace/GuestRsvp';
import VivahOsLogo from '@/components/vivah-os/VivahOsLogo';
import ChangeLoginCode from '@/components/customer/ChangeLoginCode';
import OsBackdrop from '@/components/os/OsBackdrop';
import { osFontClasses } from '@/app/fonts/osFonts';
import { contactPhone, dateRangeWords, daysToGo, daysToGoWords, rupeesShort, serviceStatus, weddingStatusWords, whatsappTo } from '@/lib/customer/myWedding';

// My Wedding — the couple's own dashboard on Vivah OS (design approved 28 Oct 2026: canvas "My Wedding Couple Dashboard").
// Everything shown is the couple's real wedding (services/clientPortal.service.ts), whether Shaadi Shopping or a venue on Vivah OS
// runs it. Desktop: a side menu that stays in place; phone: a bottom tab bar.
// Client OS in the approved liquid glass look (11 Nov 2026): the same theme as Venue OS (.os-theme, app/globals.css).

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const dayWords = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
const weekday = (iso: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
const card = 'os-glass rounded-[22px] border bg-white p-5 sm:p-6';
const tone = { good: 'bg-[#DCF3E5] text-[#14532D]', wait: 'bg-[#FEF3C7] text-[#78350F]', off: 'bg-white/70 text-[#374151]' } as const;
const theme = `os-theme ${osFontClasses} relative isolate min-h-screen`;

const MENU = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'functions', label: 'Functions', icon: CalendarDays },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'vendors', label: 'Vendors', icon: ShoppingBag },
  { id: 'guests', label: 'Guests & RSVP', icon: Users },
  { id: 'documents', label: 'Documents', icon: FileText },
] as const;

function Approvals({ approvals, onDecision }: { approvals: ClientPortalEvent['approvals']; onDecision: (id: string, decision: 'APPROVED' | 'CHANGES_REQUESTED', comment?: string) => Promise<void> }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = approvals.filter((a) => a.status === 'PENDING_CLIENT' || a.status === 'CHANGES_REQUESTED');
  if (open.length === 0) return <p className="text-sm text-[var(--color-text-muted)]">Nothing is waiting for you right now.</p>;
  const decide = async (id: string, decision: 'APPROVED' | 'CHANGES_REQUESTED') => {
    setSaving(id);
    setError(null);
    try {
      await onDecision(id, decision, notes[id]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(null);
    }
  };
  return (
    <ul className="space-y-3">
      {open.map((a) => (
        <li key={a.id} className="rounded-2xl border border-white/70 bg-white/60 p-4">
          <p className="font-semibold text-[var(--color-text-primary)]">{a.title}</p>
          {a.description && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{a.description}</p>}
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {[a.functionName, a.amount !== null ? inr(a.amount) : null, a.deadline ? `by ${dayWords(a.deadline)}` : null].filter(Boolean).join(' · ')}
          </p>
          <label className="mt-3 block text-xs font-semibold text-[var(--color-text-secondary)]">
            Note (needed if you want changes)
            <textarea value={notes[a.id] ?? ''} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2 text-sm font-normal" />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={saving === a.id} onClick={() => decide(a.id, 'APPROVED')} className="min-h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white disabled:opacity-50">Approve</button>
            <button type="button" disabled={saving === a.id || !notes[a.id]?.trim()} onClick={() => decide(a.id, 'CHANGES_REQUESTED')} className="os-glass-btn min-h-11 rounded-xl border border-[var(--color-border-default)] bg-white/70 px-4 text-sm font-semibold text-[var(--color-text-primary)] disabled:opacity-40">Ask for changes</button>
          </div>
        </li>
      ))}
      {error && <li role="alert" className="text-sm text-[#B42318]">{error}</li>}
    </ul>
  );
}

// The "choose your own code" reminder (29 Oct 2026): shown while the couple still signs in with the code Shaadi Shopping or their
// venue gave them (User.loginCodeGiven). A reminder only — the whole dashboard still works.
function CodeReminder({ onChoose }: { onChoose: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-[18px] border border-[#FCD34D]/70 bg-[#FEF3C7]/85 px-4 py-3 text-[#78350F] backdrop-blur-md">
      <KeyRound className="h-5 w-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-[1_1_220px] text-sm leading-snug">
        <span className="font-bold">Choose your own login code.</span> You are signing in with the code you were given, so the person who gave it can still use it.
      </p>
      <button type="button" onClick={onChoose} className="min-h-11 shrink-0 rounded-full bg-[var(--primary)] px-4 text-sm font-bold text-white">Choose my own code</button>
    </div>
  );
}

export default function MyWeddingDashboard({ events, phone, codeGiven }: { events: ClientPortalEvent[]; phone: string | null; codeGiven: boolean }) {
  const [remind, setRemind] = useState(codeGiven);
  const [codeOpen, setCodeOpen] = useState(false);
  const chooseCode = () => {
    setCodeOpen(true);
    requestAnimationFrame(() => document.getElementById('sign-in')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const codeBox = <ChangeLoginCode open={codeOpen} onOpenChange={setCodeOpen} onChanged={() => setRemind(false)} />;
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? '');
  const [approvals, setApprovals] = useState<Record<string, ClientPortalEvent['approvals']>>(() => Object.fromEntries(events.map((e) => [e.id, e.approvals])));
  const event = events.find((e) => e.id === selectedId) ?? events[0];

  const header = (
    <header className="os-glass-bar sticky top-0 z-30 !rounded-none !border-x-0 !border-t-0">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
        <VivahOsLogo size={38} product="CLIENT" />
        <span className="hidden border-l border-[var(--color-border-default)] pl-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary-text)] sm:inline">My Wedding</span>
        <span className="flex-1" />
        {event && (
          <a href={whatsappTo(contactPhone(event.business), `Hi, this is about our wedding ${event.weddingNumber}.`)} target="_blank" rel="noopener noreferrer" className="hidden min-h-11 items-center rounded-full bg-[#DCF3E5] px-4 text-sm font-bold text-[#14532D] sm:inline-flex">
            WhatsApp {event.business.isShaadiShopping ? 'your expert' : event.business.name}
          </a>
        )}
        <button type="button" onClick={() => signOut({ callbackUrl: '/customer/login' })} aria-label="Sign out" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/80 bg-white/60 text-[var(--color-text-secondary)]">
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );

  if (!event) {
    return (
      <div className={theme}>
        <OsBackdrop />
        {header}
        <main className="mx-auto max-w-xl px-4 py-20 text-center">
          {remind && <div className="mb-8 text-left"><CodeReminder onChoose={chooseCode} /></div>}
          <h1 className="text-3xl font-semibold text-[var(--color-text-primary)]">Your wedding will appear here</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
            We could not find a booked wedding for {phone ? `+91 ${phone}` : 'this number'} yet. It appears here once your venue or Shaadi Shopping links it to this mobile number.
          </p>
          <a href={whatsappTo('+917646028228', `Hi, I signed in to My Wedding with ${phone ?? 'my number'} but cannot see our wedding.`)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[var(--primary)] px-6 font-bold text-white">
            Ask us on WhatsApp
          </a>
          <div className="mt-10 text-left">{codeBox}</div>
        </main>
      </div>
    );
  }

  const decide = async (approvalId: string, decision: 'APPROVED' | 'CHANGES_REQUESTED', comment?: string) => {
    const res = await fetch(`/api/customer/approvals/${approvalId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, comment }) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) throw new Error(body?.error || 'Could not save. Please try again.');
    setApprovals((cur) => ({ ...cur, [event.id]: (cur[event.id] ?? []).map((a) => (a.id === approvalId ? { ...a, status: decision, clientComment: comment ?? null } : a)) }));
  };

  const names = event.couple && (event.couple.brideName || event.couple.groomName) ? [event.couple.brideName, event.couple.groomName].filter(Boolean).join(' & ') : event.clientName;
  const days = daysToGo(event.primaryDate);
  const m = event.money;
  const paidPercent = m.agreed > 0 ? Math.min(100, Math.round((m.received / m.agreed) * 100)) : 0;
  const expert = event.business.isShaadiShopping ? event.coordinatorName || 'Shaadi Shopping' : event.business.name;
  const call = contactPhone(event.business);
  const guests = event.guests;
  const coming = guests.filter((g) => g.rsvpStatus === 'ATTENDING').length;
  const declined = guests.filter((g) => g.rsvpStatus === 'NOT_ATTENDING').length;
  const waiting = guests.length - coming - declined;
  const answeredPct = guests.length ? Math.round(((coming + declined) / guests.length) * 100) : 0;
  const open = (approvals[event.id] ?? []).filter((a) => a.status === 'PENDING_CLIENT' || a.status === 'CHANGES_REQUESTED');
  const services = event.services;

  return (
    <div className={`${theme} pb-28 lg:pb-10`}>
      <OsBackdrop />
      {header}
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-6 px-4 py-5 sm:px-6">
        {/* Side menu — stays in place while the page scrolls (desktop) */}
        <nav aria-label="My wedding" className="os-glass-dark sticky top-20 hidden max-h-[calc(100vh-6rem)] w-[240px] shrink-0 overflow-y-auto rounded-[22px] border border-white/10 bg-[var(--color-bg-inverse)] p-3 lg:block">
          {MENU.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] text-[#CBD5E1] hover:bg-white/[0.08] hover:text-white">
              <Icon className="h-[18px] w-[18px]" aria-hidden /> {label}
              {id === 'overview' && open.length > 0 && <span className="ml-auto rounded-full bg-[var(--color-accent-pink)] px-2 text-xs font-bold text-[#111827]">{open.length}</span>}
            </a>
          ))}
          <div className="mt-3 border-t border-white/10 pt-3">
            <a href={`tel:${call}`} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] text-[#CBD5E1] hover:bg-white/[0.08] hover:text-white"><Phone className="h-[18px] w-[18px]" aria-hidden /> Call {event.business.isShaadiShopping ? 'your expert' : 'the venue'}</a>
          </div>
        </nav>

        <main id="overview" className="min-w-0 flex-[999_1_640px] space-y-5 scroll-mt-4">
          {remind && <CodeReminder onChoose={chooseCode} />}
          {events.length > 1 && (
            <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              Your weddings
              <select value={event.id} onChange={(e) => setSelectedId(e.target.value)} className="min-h-11 rounded-xl border border-[var(--color-border-default)] bg-white px-3">
                {events.map((e) => <option key={e.id} value={e.id}>{e.eventType} · {dayWords(e.primaryDate)} · {e.weddingNumber}</option>)}
              </select>
            </label>
          )}

          {/* Banner */}
          <section aria-label="Your wedding" className="os-glass-dark relative isolate flex min-h-[260px] overflow-hidden rounded-[28px] border border-white/15 bg-[var(--color-bg-inverse)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand mark behind the glass */}
            <img src="/images/vivah-os/mark-large.png" alt="" aria-hidden className="pointer-events-none absolute -right-6 top-4 -z-20 h-[62%] w-auto max-w-none opacity-50 sm:-right-4 sm:-top-20 sm:h-[160%] sm:opacity-60" />
            <div aria-hidden className="absolute -left-24 bottom-[-40%] -z-20 h-80 w-80 rounded-full bg-[var(--primary)] opacity-35 blur-3xl" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(15,23,42,0.85)_0%,rgba(15,23,42,0.55)_55%,rgba(15,23,42,0.35)_100%)]" />
            <div className="relative mt-auto flex max-w-[560px] flex-col gap-2.5 p-6 text-white sm:p-9">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4C1D95]">{weddingStatusWords(event.status)}</span>
                <span className="rounded-full border border-white/40 px-3 py-1 text-xs font-bold">{event.eventType}</span>
              </div>
              <h1 className="text-[2.2rem] font-semibold leading-tight sm:text-5xl">{names}</h1>
              <p className="text-lg text-white/85">Our wedding, all in one place</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/80">
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{event.city}</span>
                <span>{dateRangeWords(event.functions.map((f) => f.date), event.primaryDate)}</span>
                {event.guestCount ? <span>{event.guestCount.toLocaleString('en-IN')} guests</span> : null}
                {event.budget ? <span>Budget {rupeesShort(event.budget)}</span> : null}
              </p>
            </div>
          </section>

          {/* Status strip */}
          <section aria-label="Where things stand" className="os-glass grid grid-cols-2 overflow-hidden rounded-[22px] border bg-white sm:grid-cols-4">
            <div className="border-b border-r border-white/70 p-4 sm:border-b-0"><p className="flex items-center gap-2 text-[15px] font-bold text-[#15803D]"><CheckCircle2 className="h-4 w-4" aria-hidden />{weddingStatusWords(event.status)}</p><p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Wedding ID {event.weddingNumber}</p></div>
            <div className="border-b border-white/70 p-4 sm:border-b-0 sm:border-r"><p className="text-xs text-[var(--color-text-muted)]">Wedding day</p><p className="os-display text-[1.7rem] font-semibold leading-tight">{days > 1 ? <>{days} <span className="text-base font-normal text-[var(--color-text-muted)]">days to go</span></> : daysToGoWords(days)}</p></div>
            <div className="border-r border-white/70 p-4"><p className="text-xs text-[var(--color-text-muted)]">Paid so far</p><p className="text-lg font-bold">{rupeesShort(m.received)} <span className="text-sm font-medium text-[var(--color-text-muted)]">of {rupeesShort(m.agreed)}</span></p></div>
            <div className="p-4"><p className="text-xs text-[var(--color-text-muted)]">{event.business.isShaadiShopping ? 'Your Wedding Expert' : 'Your venue'}</p><p className="text-lg font-bold">{expert}</p></div>
          </section>

          {/* Three cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <section aria-labelledby="c-guests" className={`${card} flex flex-col gap-3`}>
              <h2 id="c-guests" className="flex items-center gap-2 text-[17px] font-bold"><Users className="h-5 w-5 text-[var(--color-primary-text)]" aria-hidden />Guests</h2>
              {guests.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">No guests added yet. Add them below and send each one their own invite link.</p>
              ) : (
                <>
                  <p><span className="os-display text-[2.2rem] font-semibold leading-none">{guests.length}</span> <span className="text-sm text-[var(--color-text-muted)]">invited · {answeredPct}% answered</span></p>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className={`rounded-xl py-2 ${tone.good}`}><p className="text-lg font-bold">{coming}</p><p className="text-xs">Coming</p></div>
                    <div className={`rounded-xl py-2 ${tone.wait}`}><p className="text-lg font-bold">{waiting}</p><p className="text-xs">Waiting</p></div>
                    <div className={`rounded-xl py-2 ${tone.off}`}><p className="text-lg font-bold">{declined}</p><p className="text-xs">Can&apos;t come</p></div>
                  </div>
                </>
              )}
              <a href="#guests" className="mt-auto text-sm font-bold text-[var(--color-primary-text)]">Guests &amp; RSVP →</a>
            </section>

            <section id="payments" aria-labelledby="c-pay" className={`${card} flex scroll-mt-4 flex-col gap-3`}>
              <h2 id="c-pay" className="flex items-center gap-2 text-[17px] font-bold"><CreditCard className="h-5 w-5 text-[#15803D]" aria-hidden />Payments</h2>
              {m.agreed === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Your payments appear here once your quotation is accepted.</p>
              ) : (
                <>
                  <p><span className="os-display text-[2.2rem] font-semibold leading-none">{rupeesShort(m.agreed)}</span> <span className="text-sm text-[var(--color-text-muted)]">agreed</span></p>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${paidPercent}%` }} /></div>
                  <p className="flex justify-between text-sm text-[var(--color-text-secondary)]"><span>Paid {inr(m.received)}</span><span>Due {inr(m.due)}</span></p>
                  {m.next && (
                    <div className="mt-auto space-y-2 border-t border-white/70 pt-3">
                      <p className="text-sm">Next: <b>{inr(m.next)}</b></p>
                      {m.payTo ? (
                        <>
                          <a href={m.payTo.link} className="flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold text-white">Pay by UPI</a>
                          <p className="text-xs text-[var(--color-text-muted)]">To {m.payTo.payee} · {m.payTo.upiId}. After paying, tell us on WhatsApp so we can confirm it.</p>
                        </>
                      ) : (
                        <p className="text-xs text-[var(--color-text-muted)]">Ask {expert} how to pay.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            <section aria-labelledby="c-wait" className={`${card} flex flex-col gap-3`}>
              <h2 id="c-wait" className="flex items-center gap-2 text-[17px] font-bold"><CheckCircle2 className="h-5 w-5 text-[var(--color-primary-text)]" aria-hidden />Waiting for you</h2>
              <Approvals approvals={approvals[event.id] ?? []} onDecision={decide} />
            </section>
          </div>

          {/* Functions + contact */}
          <div className="flex flex-wrap gap-4">
            <section id="functions" aria-labelledby="c-fn" className={`${card} min-w-0 flex-[999_1_460px] scroll-mt-4`}>
              <h2 id="c-fn" className="text-[17px] font-bold">Your functions</h2>
              {event.functions.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Your functions appear here as the plan is made.</p>
              ) : (
                <ol className="mt-3 divide-y divide-white/70">
                  {event.functions.map((f) => (
                    <li key={f.id} className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-3.5 py-3 sm:grid-cols-[76px_minmax(0,1fr)]">
                      <span className="rounded-xl bg-[var(--color-primary-subtle-bg)] py-1.5 text-center"><b className="block text-lg">{new Intl.DateTimeFormat('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(f.date))}</b><span className="text-xs text-[var(--color-text-muted)]">{new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(f.date))} · {weekday(f.date)}</span></span>
                      <span className="min-w-0">
                        <b className="block text-base capitalize">{f.name.toLowerCase()}</b>
                        <span className="text-sm text-[var(--color-text-muted)]">{[f.startTime, f.location].filter(Boolean).join(' · ')}</span>
                        {f.services.length > 0 && (
                          <span className="mt-1.5 flex flex-wrap gap-1.5">
                            {f.services.map((s, i) => {
                              const st = serviceStatus(s.status);
                              return <span key={i} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[st.tone]}`}>{s.name}: {st.words}</span>;
                            })}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <aside aria-labelledby="c-expert" className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
              <section className="os-glass-dark rounded-[22px] border border-white/10 bg-[var(--color-bg-inverse)] p-5 text-white sm:p-6">
                <h2 id="c-expert" className="text-xs font-bold tracking-[0.16em] text-[#C4B5FD]">{event.business.isShaadiShopping ? 'YOUR WEDDING EXPERT' : 'YOUR VENUE'}</h2>
                <p className="mt-3 text-[1.5rem] font-semibold leading-tight">{expert}</p>
                <p className="text-sm text-[#CBD5E1]">{event.business.isShaadiShopping ? 'Shaadi Shopping, Patna · Mon–Sat, 10am–7pm' : 'Your venue for this wedding'}</p>
                <div className="mt-4 flex gap-2">
                  <a href={`tel:${call}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-white font-bold text-[#4C1D95]">Call</a>
                  <a href={whatsappTo(call, `Hi, this is about our wedding ${event.weddingNumber}.`)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/25 font-bold">WhatsApp</a>
                </div>
              </section>
            </aside>
          </div>

          {/* Vendors */}
          <section id="vendors" aria-labelledby="c-vendors" className={`${card} scroll-mt-4`}>
            <h2 id="c-vendors" className="text-[17px] font-bold">Your vendors</h2>
            {services.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">The vendors for each function appear here once they are booked.</p>
            ) : (
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {services.map((s, i) => {
                  const st = serviceStatus(s.status);
                  return (
                    <li key={`${s.name}-${s.functionName}-${i}`} className="rounded-2xl border border-white/70 bg-white/55 p-3.5">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-primary-text)]">{s.name}</p>
                      <p className="mt-1 font-semibold">{s.provider ?? 'Being chosen'}</p>
                      <p className="mt-0.5 text-sm text-[var(--color-text-muted)]"><span className="capitalize">{s.functionName.toLowerCase()}</span> · <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone[st.tone]}`}>{st.words}</span></p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Guests & RSVP (the existing guest list — step 2 redesigns it) */}
          <section id="guests" aria-labelledby="c-guestlist" className="scroll-mt-4">
            <h2 id="c-guestlist" className="sr-only">Guests and RSVP</h2>
            <GuestRsvp weddingId={event.id} events={event.functions.map((f) => ({ id: f.id, type: f.name, label: f.name }))} initialGuests={event.guests} clientMode />
          </section>

          {/* Documents */}
          <section id="documents" aria-labelledby="c-docs" className={`${card} scroll-mt-4`}>
            <h2 id="c-docs" className="text-[17px] font-bold">Documents</h2>
            {event.finance.invoices.length === 0 && event.documents.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Your invoices and documents appear here.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {event.finance.invoices.map((inv) => (
                  <li key={inv.id} className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl border border-white/70 bg-white/55 px-3.5 py-2 text-sm">
                    <span><b>Invoice {inv.number}</b> · {inr(inv.total)} · {inv.pending > 0 ? `${inr(inv.pending)} due` : 'paid'}</span>
                    {inv.paymentUrl && inv.pending > 0 && <a href={inv.paymentUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--color-primary-text)]">Pay</a>}
                  </li>
                ))}
                {event.documents.map((d) => (
                  <li key={d.id}><a href={d.url} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-white/70 bg-white/55 px-3.5 text-sm text-[var(--color-text-primary)]"><span><b>{d.fileName}</b> · {d.category.toLowerCase()}</span><span className="font-bold text-[var(--color-primary-text)]">Open</span></a></li>
                ))}
              </ul>
            )}
          </section>

          {codeBox}
        </main>
      </div>

      {/* Phone: bottom tabs */}
      <nav aria-label="My wedding" className="os-glass-bar fixed inset-x-3 z-40 grid grid-cols-5 rounded-[28px] px-1 lg:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}>
        {MENU.filter((x) => x.id !== 'vendors').map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#${id}`} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-[var(--color-text-secondary)]">
            <Icon className="h-[21px] w-[21px]" aria-hidden />{label.split(' ')[0]}
          </a>
        ))}
      </nav>
    </div>
  );
}
