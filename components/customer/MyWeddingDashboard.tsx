'use client';

import { useState } from 'react';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import { CalendarDays, CheckCircle2, CreditCard, FileText, Home, KeyRound, LogOut, MapPin, Phone, ShoppingBag, Users } from 'lucide-react';
import type { ClientPortalEvent } from '@/services/clientPortal.service';
import GuestRsvp from '@/components/wedding/workspace/GuestRsvp';
import VivahOsLogo from '@/components/vivah-os/VivahOsLogo';
import ChangeLoginCode from '@/components/customer/ChangeLoginCode';
import { contactPhone, dateRangeWords, daysToGo, daysToGoWords, rupeesShort, serviceStatus, weddingStatusWords, whatsappTo } from '@/lib/customer/myWedding';

// My Wedding — the couple's own dashboard on Vivah OS (design approved 28 Oct 2026: canvas "My Wedding Couple Dashboard").
// Everything shown is the couple's real wedding (services/clientPortal.service.ts), whether Shaadi Shopping or a venue on Vivah OS
// runs it. Desktop: a side menu that stays in place; phone: a bottom tab bar.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const dayWords = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
const weekday = (iso: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
const card = 'rounded-[22px] border border-[#EADFCC] bg-white p-5 sm:p-6';
const tone = { good: 'bg-[#E6F0E9] text-[#1F5C37]', wait: 'bg-[#F5EEDD] text-[#7A5410]', off: 'bg-[#F0ECE7] text-[#4D3E36]' } as const;

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
  if (open.length === 0) return <p className="text-sm text-[#6B5A4E]">Nothing is waiting for you right now.</p>;
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
        <li key={a.id} className="rounded-2xl bg-[#FBF6EE] p-4">
          <p className="font-semibold text-[#221714]">{a.title}</p>
          {a.description && <p className="mt-1 text-sm text-[#4D3E36]">{a.description}</p>}
          <p className="mt-1 text-xs text-[#6B5A4E]">
            {[a.functionName, a.amount !== null ? inr(a.amount) : null, a.deadline ? `by ${dayWords(a.deadline)}` : null].filter(Boolean).join(' · ')}
          </p>
          <label className="mt-3 block text-xs font-semibold text-[#4D3E36]">
            Note (needed if you want changes)
            <textarea value={notes[a.id] ?? ''} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-[#E2D3BC] bg-white px-3 py-2 text-sm font-normal" />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={saving === a.id} onClick={() => decide(a.id, 'APPROVED')} className="min-h-11 rounded-xl bg-[#7A1238] px-4 text-sm font-bold text-white disabled:opacity-50">Approve</button>
            <button type="button" disabled={saving === a.id || !notes[a.id]?.trim()} onClick={() => decide(a.id, 'CHANGES_REQUESTED')} className="min-h-11 rounded-xl border border-[#D9C7AA] px-4 text-sm font-semibold text-[#221714] disabled:opacity-40">Ask for changes</button>
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
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-[18px] border border-[#E9D3A6] bg-[#FBF1DC] px-4 py-3 text-[#5C3F0A]">
      <KeyRound className="h-5 w-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-[1_1_220px] text-sm leading-snug">
        <span className="font-bold">Choose your own login code.</span> You are signing in with the code you were given, so the person who gave it can still use it.
      </p>
      <button type="button" onClick={onChoose} className="min-h-11 shrink-0 rounded-full bg-[#7A1238] px-4 text-sm font-bold text-white">Choose my own code</button>
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
    <header className="border-b border-[#EADFCC] bg-white">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
        <VivahOsLogo size={38} />
        <span className="hidden border-l border-[#EADFCC] pl-4 text-xs font-bold uppercase tracking-[0.14em] text-[#8A6A2F] sm:inline">My Wedding</span>
        <span className="flex-1" />
        {event && (
          <a href={whatsappTo(contactPhone(event.business), `Hi, this is about our wedding ${event.weddingNumber}.`)} target="_blank" rel="noopener noreferrer" className="hidden min-h-11 items-center rounded-full bg-[#E6F0E9] px-4 text-sm font-bold text-[#1F5C37] sm:inline-flex">
            WhatsApp {event.business.isShaadiShopping ? 'your expert' : event.business.name}
          </a>
        )}
        <button type="button" onClick={() => signOut({ callbackUrl: '/customer/login' })} aria-label="Sign out" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#EADFCC] text-[#6B5A4E]">
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );

  if (!event) {
    return (
      <div className="min-h-screen bg-[#F7F1E8]">
        {header}
        <main className="mx-auto max-w-xl px-4 py-20 text-center">
          {remind && <div className="mb-8 text-left"><CodeReminder onChoose={chooseCode} /></div>}
          <h1 className="font-cormorant text-4xl font-semibold text-[#221714]">Your wedding will appear here</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#4D3E36]">
            We could not find a booked wedding for {phone ? `+91 ${phone}` : 'this number'} yet. It appears here once your venue or Shaadi Shopping links it to this mobile number.
          </p>
          <a href={whatsappTo('+917646028228', `Hi, I signed in to My Wedding with ${phone ?? 'my number'} but cannot see our wedding.`)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#7A1238] px-6 font-bold text-white">
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
    <div className="min-h-screen bg-[#F7F1E8] pb-24 text-[#221714] lg:pb-10">
      {header}
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-6 px-4 py-5 sm:px-6">
        {/* Side menu — stays in place while the page scrolls (desktop) */}
        <nav aria-label="My wedding" className="sticky top-4 hidden max-h-[calc(100vh-2rem)] w-[240px] shrink-0 overflow-y-auto rounded-[20px] border border-[#EADFCC] bg-white p-3 lg:block">
          {MENU.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] text-[#221714] hover:bg-[#F4E6EC] hover:text-[#7A1238]">
              <Icon className="h-[18px] w-[18px]" aria-hidden /> {label}
              {id === 'overview' && open.length > 0 && <span className="ml-auto rounded-full bg-[#7A1238] px-2 text-xs font-bold text-white">{open.length}</span>}
            </a>
          ))}
          <div className="mt-3 border-t border-[#F0E6D6] pt-3">
            <a href={`tel:${call}`} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] text-[#221714] hover:bg-[#F4E6EC]"><Phone className="h-[18px] w-[18px]" aria-hidden /> Call {event.business.isShaadiShopping ? 'your expert' : 'the venue'}</a>
          </div>
        </nav>

        <main id="overview" className="min-w-0 flex-[999_1_640px] space-y-5 scroll-mt-4">
          {remind && <CodeReminder onChoose={chooseCode} />}
          {events.length > 1 && (
            <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              Your weddings
              <select value={event.id} onChange={(e) => setSelectedId(e.target.value)} className="min-h-11 rounded-xl border border-[#E2D3BC] bg-white px-3">
                {events.map((e) => <option key={e.id} value={e.id}>{e.eventType} · {dayWords(e.primaryDate)} · {e.weddingNumber}</option>)}
              </select>
            </label>
          )}

          {/* Banner */}
          <section aria-label="Your wedding" className="relative flex min-h-[260px] overflow-hidden rounded-[28px] bg-[#2A0614]">
            <div aria-hidden className="absolute inset-y-0 right-0 w-full sm:w-[60%]">
              <Image src="/images/homepage-poster.jpg" alt="" fill sizes="(max-width: 640px) 100vw, 60vw" className="object-cover" priority />
            </div>
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#2A0614] via-[#2A0614]/80 to-[#2A0614]/20 sm:bg-gradient-to-r sm:from-[#2A0614] sm:via-[#2A0614]/85 sm:to-transparent" />
            <div className="relative mt-auto flex max-w-[560px] flex-col gap-2.5 p-6 text-white sm:p-9">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#E9C98E] px-3 py-1 text-xs font-bold text-[#2A0614]">{weddingStatusWords(event.status)}</span>
                <span className="rounded-full border border-white/40 px-3 py-1 text-xs font-bold">{event.eventType}</span>
              </div>
              <h1 className="font-cormorant text-[2.6rem] font-semibold leading-none sm:text-6xl">{names}</h1>
              <p className="font-cormorant text-xl italic text-[#F3E3C3]">Our wedding, all in one place</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#EADCCB]">
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{event.city}</span>
                <span>{dateRangeWords(event.functions.map((f) => f.date), event.primaryDate)}</span>
                {event.guestCount ? <span>{event.guestCount.toLocaleString('en-IN')} guests</span> : null}
                {event.budget ? <span>Budget {rupeesShort(event.budget)}</span> : null}
              </p>
            </div>
          </section>

          {/* Status strip */}
          <section aria-label="Where things stand" className="grid grid-cols-2 overflow-hidden rounded-[20px] border border-[#EADFCC] bg-white sm:grid-cols-4">
            <div className="border-b border-r border-[#F0E6D6] p-4 sm:border-b-0"><p className="flex items-center gap-2 text-[15px] font-bold text-[#2F6B45]"><CheckCircle2 className="h-4 w-4" aria-hidden />{weddingStatusWords(event.status)}</p><p className="mt-0.5 text-xs text-[#6B5A4E]">Wedding ID {event.weddingNumber}</p></div>
            <div className="border-b border-[#F0E6D6] p-4 sm:border-b-0 sm:border-r"><p className="text-xs text-[#6B5A4E]">Wedding day</p><p className="font-cormorant text-[1.9rem] font-semibold leading-tight">{days > 1 ? <>{days} <span className="text-base font-normal text-[#6B5A4E]">days to go</span></> : daysToGoWords(days)}</p></div>
            <div className="border-r border-[#F0E6D6] p-4"><p className="text-xs text-[#6B5A4E]">Paid so far</p><p className="text-lg font-bold">{rupeesShort(m.received)} <span className="text-sm font-medium text-[#6B5A4E]">of {rupeesShort(m.agreed)}</span></p></div>
            <div className="p-4"><p className="text-xs text-[#6B5A4E]">{event.business.isShaadiShopping ? 'Your Wedding Expert' : 'Your venue'}</p><p className="text-lg font-bold">{expert}</p></div>
          </section>

          {/* Three cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <section aria-labelledby="c-guests" className={`${card} flex flex-col gap-3`}>
              <h2 id="c-guests" className="flex items-center gap-2 text-[17px] font-bold"><Users className="h-5 w-5 text-[#7A1238]" aria-hidden />Guests</h2>
              {guests.length === 0 ? (
                <p className="text-sm text-[#4D3E36]">No guests added yet. Add them below and send each one their own invite link.</p>
              ) : (
                <>
                  <p><span className="font-cormorant text-[2.6rem] font-semibold leading-none">{guests.length}</span> <span className="text-sm text-[#6B5A4E]">invited · {answeredPct}% answered</span></p>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className={`rounded-xl py-2 ${tone.good}`}><p className="text-lg font-bold">{coming}</p><p className="text-xs">Coming</p></div>
                    <div className={`rounded-xl py-2 ${tone.wait}`}><p className="text-lg font-bold">{waiting}</p><p className="text-xs">Waiting</p></div>
                    <div className={`rounded-xl py-2 ${tone.off}`}><p className="text-lg font-bold">{declined}</p><p className="text-xs">Can&apos;t come</p></div>
                  </div>
                </>
              )}
              <a href="#guests" className="mt-auto text-sm font-bold text-[#7A1238]">Guests &amp; RSVP →</a>
            </section>

            <section id="payments" aria-labelledby="c-pay" className={`${card} flex scroll-mt-4 flex-col gap-3`}>
              <h2 id="c-pay" className="flex items-center gap-2 text-[17px] font-bold"><CreditCard className="h-5 w-5 text-[#2F6B45]" aria-hidden />Payments</h2>
              {m.agreed === 0 ? (
                <p className="text-sm text-[#4D3E36]">Your payments appear here once your quotation is accepted.</p>
              ) : (
                <>
                  <p><span className="font-cormorant text-[2.6rem] font-semibold leading-none">{rupeesShort(m.agreed)}</span> <span className="text-sm text-[#6B5A4E]">agreed</span></p>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#F0E6D6]"><div className="h-full bg-[#2F6B45]" style={{ width: `${paidPercent}%` }} /></div>
                  <p className="flex justify-between text-sm text-[#4D3E36]"><span>Paid {inr(m.received)}</span><span>Due {inr(m.due)}</span></p>
                  {m.next && (
                    <div className="mt-auto space-y-2 border-t border-[#F0E6D6] pt-3">
                      <p className="text-sm">Next: <b>{inr(m.next)}</b></p>
                      {m.payTo ? (
                        <>
                          <a href={m.payTo.link} className="flex min-h-11 items-center justify-center rounded-xl bg-[#7A1238] text-sm font-bold text-white">Pay by UPI</a>
                          <p className="text-xs text-[#6B5A4E]">To {m.payTo.payee} · {m.payTo.upiId}. After paying, tell us on WhatsApp so we can confirm it.</p>
                        </>
                      ) : (
                        <p className="text-xs text-[#6B5A4E]">Ask {expert} how to pay.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            <section aria-labelledby="c-wait" className={`${card} flex flex-col gap-3`}>
              <h2 id="c-wait" className="flex items-center gap-2 text-[17px] font-bold"><CheckCircle2 className="h-5 w-5 text-[#8A6A2F]" aria-hidden />Waiting for you</h2>
              <Approvals approvals={approvals[event.id] ?? []} onDecision={decide} />
            </section>
          </div>

          {/* Functions + contact */}
          <div className="flex flex-wrap gap-4">
            <section id="functions" aria-labelledby="c-fn" className={`${card} min-w-0 flex-[999_1_460px] scroll-mt-4`}>
              <h2 id="c-fn" className="text-[17px] font-bold">Your functions</h2>
              {event.functions.length === 0 ? (
                <p className="mt-3 text-sm text-[#4D3E36]">Your functions appear here as the plan is made.</p>
              ) : (
                <ol className="mt-3 divide-y divide-[#F0E6D6]">
                  {event.functions.map((f) => (
                    <li key={f.id} className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-3.5 py-3 sm:grid-cols-[76px_minmax(0,1fr)]">
                      <span className="rounded-xl bg-[#FBF6EE] py-1.5 text-center"><b className="block text-lg">{new Intl.DateTimeFormat('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(f.date))}</b><span className="text-xs text-[#6B5A4E]">{new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(f.date))} · {weekday(f.date)}</span></span>
                      <span className="min-w-0">
                        <b className="block text-base capitalize">{f.name.toLowerCase()}</b>
                        <span className="text-sm text-[#6B5A4E]">{[f.startTime, f.location].filter(Boolean).join(' · ')}</span>
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
              <section className="rounded-[22px] bg-[#221714] p-5 text-[#FBF6EE] sm:p-6">
                <h2 id="c-expert" className="text-xs font-bold tracking-[0.16em] text-[#E9C98E]">{event.business.isShaadiShopping ? 'YOUR WEDDING EXPERT' : 'YOUR VENUE'}</h2>
                <p className="mt-3 font-cormorant text-[1.7rem] font-semibold leading-tight">{expert}</p>
                <p className="text-sm text-[#CDBCA8]">{event.business.isShaadiShopping ? 'Shaadi Shopping, Patna · Mon–Sat, 10am–7pm' : 'Runs your wedding on Vivah OS'}</p>
                <div className="mt-4 flex gap-2">
                  <a href={`tel:${call}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#E9C98E] font-bold text-[#221714]">Call</a>
                  <a href={whatsappTo(call, `Hi, this is about our wedding ${event.weddingNumber}.`)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#5A433B] font-bold">WhatsApp</a>
                </div>
              </section>
            </aside>
          </div>

          {/* Vendors */}
          <section id="vendors" aria-labelledby="c-vendors" className={`${card} scroll-mt-4`}>
            <h2 id="c-vendors" className="text-[17px] font-bold">Your vendors</h2>
            {services.length === 0 ? (
              <p className="mt-3 text-sm text-[#4D3E36]">The vendors for each function appear here once they are booked.</p>
            ) : (
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {services.map((s, i) => {
                  const st = serviceStatus(s.status);
                  return (
                    <li key={`${s.name}-${s.functionName}-${i}`} className="rounded-2xl border border-[#EADFCC] p-3.5">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8A6A2F]">{s.name}</p>
                      <p className="mt-1 font-semibold">{s.provider ?? 'Being chosen'}</p>
                      <p className="mt-0.5 text-sm text-[#6B5A4E]"><span className="capitalize">{s.functionName.toLowerCase()}</span> · <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone[st.tone]}`}>{st.words}</span></p>
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
              <p className="mt-3 text-sm text-[#4D3E36]">Your invoices and documents appear here.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {event.finance.invoices.map((inv) => (
                  <li key={inv.id} className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FBF6EE] px-3.5 py-2 text-sm">
                    <span><b>Invoice {inv.number}</b> · {inr(inv.total)} · {inv.pending > 0 ? `${inr(inv.pending)} due` : 'paid'}</span>
                    {inv.paymentUrl && inv.pending > 0 && <a href={inv.paymentUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#7A1238]">Pay</a>}
                  </li>
                ))}
                {event.documents.map((d) => (
                  <li key={d.id}><a href={d.url} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-[#FBF6EE] px-3.5 text-sm text-[#221714]"><span><b>{d.fileName}</b> · {d.category.toLowerCase()}</span><span className="font-bold text-[#7A1238]">Open</span></a></li>
                ))}
              </ul>
            )}
          </section>

          {codeBox}
        </main>
      </div>

      {/* Phone: bottom tabs */}
      <nav aria-label="My wedding" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#EADFCC] bg-white px-1 pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5 lg:hidden">
        {MENU.filter((x) => x.id !== 'vendors').map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#${id}`} className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-[#6B5A4E]">
            <Icon className="h-[21px] w-[21px]" aria-hidden />{label.split(' ')[0]}
          </a>
        ))}
      </nav>
    </div>
  );
}
