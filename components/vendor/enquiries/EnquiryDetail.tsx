'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, MessageCircle, Phone } from 'lucide-react';
import { Card, CardSkeleton } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { whatsappTo } from '@/lib/venue/enquiry';
import type { VenueEnquiryDetail } from '@/services/venueEnquiry.service';
import EnquiryQuotation from './EnquiryQuotation';

// One of the venue's own enquiries (Phase C). The top card answers "what should I do next?" with ONE primary action (audit brief
// §13); calling, WhatsApp, a follow-up date and a note are always one tap away below it.

const dayWords = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
const dateWords = (d: string | null) => (d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${d}T12:00:00+05:30`)) : 'Date not decided');
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const big = 'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold';

export default function EnquiryDetail({ id, justAdded }: { id: string; justAdded: boolean }) {
  const [e, setE] = useState<VenueEnquiryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<'none' | 'followup' | 'note' | 'close'>('none');
  const [date, setDate] = useState('');
  const [text, setText] = useState('');
  const [version, setVersion] = useState(0); // bumped when the quotation below changes — the next step and history follow it

  useEffect(() => {
    let live = true;
    fetch(`/api/vendor-os/enquiries/${id}`)
      .then((r) => r.json())
      .then((b) => live && (b.success ? setE(b.data) : setError(b.error ?? 'This enquiry could not be loaded.')))
      .catch(() => live && setError('Could not reach Vivah OS — please check your connection.'));
    return () => {
      live = false;
    };
  }, [id, version]);

  async function send(path: string, body: unknown, method = 'POST') {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendor-os/enquiries/${id}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        setE(b.data);
        setPanel('none');
        setText('');
        setDate('');
      } else setError(b.error ?? 'Something went wrong. It was not saved — please try again.');
    } catch {
      setError('Could not reach Vivah OS. It was not saved — please check your connection.');
    }
    setBusy(false);
  }

  if (!e) return error ? <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p> : <CardSkeleton lines={4} />;

  const first = e.name.split(' ')[0];
  const wa = whatsappTo(e.phone, `Namaste ${first}, thank you for your enquiry about your wedding.`);
  const next = e.next;
  const openFollowUps = e.followUps.filter((f) => !f.done);
  const closed = next.kind === 'CLOSED';

  return (
    <div className="space-y-4">
      <Link href="/vendor/enquiries" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Your Enquiries
      </Link>
      {justAdded && <p role="status" className="rounded-lg bg-[var(--color-success-bg)] p-3 text-sm text-[var(--color-success-text)]">Enquiry saved.</p>}

      <div>
        <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">{e.name}</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {[dateWords(e.weddingDate), e.guestCount ? `${e.guestCount.toLocaleString('en-IN')} guests` : null, e.channel].filter(Boolean).join(' · ')}
        </p>
        {e.need && <p className="mt-2 whitespace-pre-line text-sm text-[var(--color-text-primary)]">{e.need}</p>}
      </div>
      {e.viaShaadiShopping && (
        <p className="rounded-lg bg-[var(--color-info-bg)] p-3 text-sm text-[var(--color-info-text)]">
          This couple came to you through Shaadi Shopping, so Shaadi Shopping’s commission applies when they book. You can work the enquiry here as usual.
        </p>
      )}

      {/* The one next step */}
      <Card variant={next.kind === 'FOLLOW_UP_OVERDUE' ? 'attention' : 'highlighted'} className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Next</p>
        <p className="font-playfair text-xl font-bold text-[var(--color-text-primary)]">{next.label}</p>
        {next.kind === 'CALL' && (
          <div className="grid gap-2">
            <a href={`tel:+91${e.phone}`} className={`${big} bg-[var(--primary)] text-[var(--color-on-primary)]`}><Phone className="h-5 w-5" aria-hidden /> Call {first}</a>
            <button type="button" disabled={busy} onClick={() => send('/log', { kind: 'CALL' })} className={`${big} border border-[var(--color-border-default)] text-[var(--color-text-primary)]`}>I have called {first}</button>
          </div>
        )}
        {(next.kind === 'FOLLOW_UP_OVERDUE' || next.kind === 'FOLLOW_UP_TODAY' || next.kind === 'FOLLOW_UP_LATER') && (
          <div className="grid gap-2">
            <a href={`tel:+91${e.phone}`} className={`${big} bg-[var(--primary)] text-[var(--color-on-primary)]`}><Phone className="h-5 w-5" aria-hidden /> Call {first}</a>
            <button type="button" disabled={busy} onClick={() => send(`/follow-ups/${next.followUpId}`, {}, 'PATCH')} className={`${big} border border-[var(--color-border-default)] text-[var(--color-text-primary)]`}><CheckCircle2 className="h-5 w-5" aria-hidden /> Follow-up done</button>
          </div>
        )}
        {next.kind === 'SCHEDULE' && (
          <button type="button" onClick={() => setPanel('followup')} className={`${big} w-full bg-[var(--primary)] text-[var(--color-on-primary)]`}>Schedule a follow-up</button>
        )}
        {(next.kind === 'BOOKED' || next.kind === 'QUOTE_ACCEPTED' || next.kind === 'QUOTE_CHANGES' || next.kind === 'QUOTE_DRAFT' || next.kind === 'QUOTE_WAITING') && (
          <a href="#quotation" className={`${big} w-full ${next.kind === 'QUOTE_WAITING' || next.kind === 'BOOKED' ? 'border border-[var(--color-border-default)] text-[var(--color-text-primary)]' : 'bg-[var(--primary)] text-[var(--color-on-primary)]'}`}>{next.kind === 'BOOKED' || next.kind === 'QUOTE_ACCEPTED' ? 'See the booking and payments' : 'See the quotation'}</a>
        )}
        {closed && <p className="text-sm text-[var(--color-text-muted)]">This enquiry is closed — it is kept here for your records.</p>}
      </Card>

      {!closed && (
        <div className="grid grid-cols-2 gap-2">
          <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => send('/log', { kind: 'WHATSAPP' })} className={`${big} border border-[var(--color-border-default)] text-[var(--color-text-primary)]`}><MessageCircle className="h-5 w-5" aria-hidden /> WhatsApp</a>
          <a href={`tel:+91${e.phone}`} className={`${big} border border-[var(--color-border-default)] text-[var(--color-text-primary)]`}><Phone className="h-5 w-5" aria-hidden /> Call</a>
          <button type="button" onClick={() => setPanel(panel === 'followup' ? 'none' : 'followup')} className={`${big} border border-[var(--color-border-default)] text-[var(--color-text-primary)]`}>Follow-up date</button>
          <button type="button" onClick={() => setPanel(panel === 'note' ? 'none' : 'note')} className={`${big} border border-[var(--color-border-default)] text-[var(--color-text-primary)]`}>Add note</button>
        </div>
      )}

      <div id="quotation" className="scroll-mt-4">
        <EnquiryQuotation enquiryId={id} closed={closed} onChanged={() => setVersion((v) => v + 1)} />
      </div>

      {panel === 'followup' && (
        <Card className="space-y-3">
          <Input label="Follow up on" type="date" min={today()} value={date} onChange={(ev) => setDate(ev.target.value)} className="min-h-12 text-base" />
          <Input label="What about? (optional)" value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Share the package, site visit…" className="min-h-12 text-base" />
          <button type="button" disabled={busy || !date} onClick={() => send('/follow-ups', { date, title: text })} className={`${big} w-full bg-[var(--primary)] text-[var(--color-on-primary)] disabled:opacity-50`}>Save follow-up</button>
        </Card>
      )}
      {panel === 'note' && (
        <Card className="space-y-3">
          <Textarea label="Note" value={text} onChange={(ev) => setText(ev.target.value)} rows={3} placeholder="Wants the lawn, budget around ₹5 lakh…" />
          <button type="button" disabled={busy || !text.trim()} onClick={() => send('/log', { kind: 'NOTE', text })} className={`${big} w-full bg-[var(--primary)] text-[var(--color-on-primary)] disabled:opacity-50`}>Save note</button>
        </Card>
      )}
      {panel === 'close' && (
        <Card className="space-y-3">
          <Input label="Why? (optional)" value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Booked elsewhere, date not available…" className="min-h-12 text-base" />
          <button type="button" disabled={busy} onClick={() => send('/close', { reason: text })} className={`${big} w-full border border-[var(--color-danger-default)] text-[var(--color-danger-text)]`}>Mark as not going ahead</button>
        </Card>
      )}

      {error && <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>}

      {openFollowUps.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Follow-ups</h2>
          <ul className="space-y-2">
            {openFollowUps.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] p-3 text-sm">
                <span>{f.title}{f.dueAt && <span className="text-[var(--color-text-muted)]"> · {dayWords(f.dueAt)}</span>}</span>
                <button type="button" disabled={busy} onClick={() => send(`/follow-ups/${f.id}`, {}, 'PATCH')} className="min-h-10 rounded-lg px-3 text-sm font-medium text-[var(--primary)]">Done</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">History</h2>
        <ul className="space-y-2 text-sm">
          {e.history.map((h) => (
            <li key={h.id} className="border-l-2 border-[var(--color-border-subtle)] pl-3">
              <p className="text-[var(--color-text-primary)]">{h.summary}</p>
              {h.detail && <p className="whitespace-pre-line text-[var(--color-text-secondary)]">{h.detail}</p>}
              <p className="text-xs text-[var(--color-text-muted)]">{dayWords(h.at)}</p>
            </li>
          ))}
        </ul>
      </section>

      {!closed && (
        <button type="button" onClick={() => setPanel(panel === 'close' ? 'none' : 'close')} className="text-sm text-[var(--color-text-muted)] underline underline-offset-2">
          Not going ahead?
        </button>
      )}
    </div>
  );
}
