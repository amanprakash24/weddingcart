'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound, MessageCircle, Search } from 'lucide-react';
import { whatsappTo } from '@/lib/venue/enquiry';
import type { CoupleLookup } from '@/services/coupleLogin.service';

// Command Center → More → Couple sign-in (29 Oct 2026, founder only). A couple who forgot their My Wedding code and could not reset
// it on WhatsApp ("Forgot your code?") asks Shaadi Shopping. Their wedding may be a venue's, which no Command Center wedding page
// shows, so the founder finds the sign-in by mobile number: whose it is, which weddings it opens, and — after a confirm — a new
// code, shown once. The server decides everything (/api/admin/couple-logins → services/coupleLogin.service.ts).

const field = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100';
const card = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm';
const dark = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-gray-900 px-5 text-sm font-semibold text-white disabled:opacity-50';
const light = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 disabled:opacity-50';
const spaced = (m: string) => `${m.slice(0, 5)} ${m.slice(5)}`;
const day = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

async function call(url: string, method: 'GET' | 'POST', body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const b = await res.json().catch(() => ({}));
  return { ok: res.ok && b.success === true, b };
}

export default function CoupleSignInSearch() {
  const [mobile, setMobile] = useState('');
  const [result, setResult] = useState<CoupleLookup | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [issued, setIssued] = useState<{ mobile: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setConfirming(false);
    setIssued(null);
    try {
      const { ok, b } = await call(`/api/admin/couple-logins?mobile=${encodeURIComponent(mobile)}`, 'GET');
      if (ok) setResult(b.data);
      else setError(b.error ?? 'Could not search. Please try again.');
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  }

  async function giveNewCode() {
    if (busy || !result?.found) return;
    setBusy(true);
    setError(null);
    try {
      const { ok, b } = await call('/api/admin/couple-logins', 'POST', { mobile: result.mobile });
      if (ok) {
        setIssued(b.data);
        setConfirming(false);
        setResult({ ...result, hasCode: true });
      } else {
        setError(b.error ?? 'Could not make a new code. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — please select the code and copy it yourself.');
    }
  }

  const first = result?.found ? result.name?.trim().split(' ')[0] : undefined;
  const message = (m: string, code: string) =>
    `Namaste${first ? ` ${first} ji` : ''}! Here is your new My Wedding (Vivah OS) login code.\n\nOpen ${window.location.origin}/customer/login\nMobile: ${spaced(m)}\nLogin code: ${code}\n\nAfter signing in, please choose your own code. Next time you can also use "Forgot your code?" on the sign-in page.`;

  return (
    <div className="max-w-2xl space-y-4">
      <form onSubmit={find} className={`${card} space-y-3`}>
        <label htmlFor="couple-search" className="block text-xs font-semibold text-gray-600">Couple&apos;s mobile number</label>
        <div className="flex flex-wrap gap-2">
          <input
            id="couple-search"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10})/, '').slice(0, 10))}
            placeholder="98765 43210"
            className={`${field} min-w-0 flex-[1_1_200px]`}
          />
          <button type="submit" disabled={busy || mobile.length !== 10} className={dark}>
            <Search className="h-4 w-4" aria-hidden /> {busy && !result ? 'Finding…' : 'Find'}
          </button>
        </div>
        <p className="text-xs text-gray-500">Couples can reset their own code on WhatsApp with &quot;Forgot your code?&quot; on the sign-in page. Use this when that did not work.</p>
      </form>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      {result && !result.found && (
        <div className={card}>
          <p className="text-sm font-semibold text-gray-900">No couple sign-in has +91 {spaced(result.mobile)}.</p>
          <p className="mt-1 text-sm text-gray-600">Their wedding may have a different number, or My Wedding was never given to them. Open the wedding and use its &quot;My Wedding sign-in&quot; card.</p>
        </div>
      )}

      {result?.found && (
        <div className={`${card} space-y-4`}>
          <div>
            <p className="text-base font-bold text-gray-900">{result.name?.trim() || 'No name on this sign-in'}</p>
            <p className="text-sm text-gray-600">
              +91 {spaced(result.mobile)} · {result.hasCode ? 'has a login code' : 'no login code yet'}
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-gray-600">Weddings this sign-in opens</p>
            {result.weddings.length === 0 ? (
              <p className="text-sm text-gray-600">None yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {result.weddings.map((w) => (
                  <li key={w.weddingNumber} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 px-3.5 py-2.5 text-sm">
                    <span className="font-semibold text-gray-900">{w.weddingNumber}</span>
                    <span className="text-gray-600">{day(w.date)} · {w.businessName}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {issued ? (
            <div className="space-y-3 rounded-xl bg-amber-50 p-4">
              <p className="text-sm text-gray-800">New code for +91 {spaced(issued.mobile)}. The old code no longer works.</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="select-all rounded-lg bg-white px-3 py-1.5 font-mono text-2xl font-bold tracking-[0.3em] text-gray-900 ring-1 ring-amber-200">{issued.code}</span>
                <button type="button" onClick={() => copy(issued.code)} className={light}>
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <a href={whatsappTo(issued.mobile, message(issued.mobile, issued.code))} target="_blank" rel="noopener noreferrer" className={`${dark} w-full`}>
                <MessageCircle className="h-4 w-4" aria-hidden /> Send it to the couple on WhatsApp
              </a>
              <p className="text-xs font-medium text-amber-800">Shown only now. Send it before you leave this page — it cannot be shown again, only replaced.</p>
            </div>
          ) : !result.canReplace ? (
            <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">This number is also a vendor or team sign-in. Only that person can change its code.</p>
          ) : confirming ? (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-gray-800">
                <strong>Is this the right couple?</strong> {result.hasCode ? 'Their current code stops working, and they are signed out everywhere.' : 'This gives them their first login code.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={giveNewCode} disabled={busy} className={dark}>{busy ? 'Making…' : 'Yes, give a new code'}</button>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={light}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={dark}>
              <KeyRound className="h-4 w-4" aria-hidden /> Give a new code
            </button>
          )}
        </div>
      )}
    </div>
  );
}
