'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, MessageCircle } from 'lucide-react';
import { whatsappTo } from '@/lib/venue/enquiry';
import type { CoupleLoginStatus, GiveResult } from '@/services/coupleLogin.service';

// The couple's My Wedding sign-in, on a wedding's page (28 Oct 2026) — the venue's (Vendor OS) and Shaadi Shopping's (Command
// Center). `apiPath` is that side's /couple-login route. The rules are on the server (services/coupleLogin.service.ts): a code is made
// only for a number with no login yet, and shown once; an existing login keeps its own code; only the founder replaces one.

const spaced = (m: string) => `${m.slice(0, 5)} ${m.slice(5)}`;
const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-55';
const primary = `${btn} bg-[#7A1238] text-white hover:bg-[#5A0D29]`;
const secondary = `${btn} border border-[#D9C9B2] bg-white text-[#7A1238] hover:bg-[#FBF6EE]`;

export default function CoupleSignInCard({ apiPath, coupleName }: { apiPath: string; coupleName?: string }) {
  const [status, setStatus] = useState<CoupleLoginStatus | null>(null);
  const [shown, setShown] = useState<{ mobile: string; code: string } | null>(null);
  const [linkedNow, setLinkedNow] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(apiPath)
      .then((r) => r.json())
      .then((b) => (b.success ? setStatus(b.data) : setError(b.error ?? 'Could not load the sign-in.')))
      .catch(() => setError('Could not reach the server. Please try again.'));
  }, [apiPath]);
  useEffect(load, [load]);

  async function post(action: 'give' | 'replace') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setError(body.error ?? 'Something went wrong. Please try again.');
      } else {
        const data = body.data as GiveResult;
        if (data.kind === 'NEW_CODE') setShown({ mobile: data.mobile, code: data.code });
        else setLinkedNow(true);
        setAsking(false);
        load();
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
    } catch {
      setError('Could not copy — please select the code and copy it yourself.');
    }
  }

  const first = coupleName?.trim().split(' ')[0];
  const message = (mobile: string, code: string) =>
    `Namaste${first ? ` ${first} ji` : ''}! Your wedding is now on My Wedding (Vivah OS): functions, guests and payments in one place.\n\nOpen ${window.location.origin}/customer/login\nMobile: ${spaced(mobile)}\nLogin code: ${code}\n\nAfter signing in, please choose your own code.`;

  let body: React.ReactNode = <p className="text-sm text-[#6B5A4E]">Loading…</p>;
  if (shown) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-[#4A3B32]">The couple signs in at <strong>/customer/login</strong> with <strong>+91 {spaced(shown.mobile)}</strong> and this code:</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="select-all rounded-lg bg-white px-3 py-1.5 font-mono text-2xl font-bold tracking-[0.3em] text-[#221714] ring-1 ring-[#EADFCF]">{shown.code}</span>
          <button type="button" onClick={() => copy(shown.code)} className={secondary}>
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <a href={whatsappTo(shown.mobile, message(shown.mobile, shown.code))} target="_blank" rel="noopener noreferrer" className={`${primary} w-full`}>
          <MessageCircle className="h-4 w-4" aria-hidden /> Send it to the couple on WhatsApp
        </a>
        <p className="text-xs font-medium text-amber-800">Shown only now. Send it before you leave this page — it cannot be shown again, only replaced by Shaadi Shopping.</p>
      </div>
    );
  } else if (status?.state === 'NO_MOBILE') {
    body = <p className="text-sm text-[#6B5A4E]">This wedding has no 10-digit mobile number for the couple yet. Add it to give them My Wedding.</p>;
  } else if (status?.state === 'OTHER_LOGIN') {
    body = <p className="text-sm text-[#6B5A4E]">This wedding is linked to a different sign-in than +91 {spaced(status.mobile)}. Please ask Shaadi Shopping to check it.</p>;
  } else if (status?.state === 'NOT_SET_UP') {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-[#4A3B32]">Give the couple their own My Wedding page — functions, guests and payments — with a 6-digit login code for +91 {spaced(status.mobile)}.</p>
        <button type="button" disabled={busy} onClick={() => post('give')} className={primary}>
          <KeyRound className="h-4 w-4" aria-hidden /> {busy ? 'Making the code…' : 'Give the couple a login code'}
        </button>
      </div>
    );
  } else if (status?.state === 'HAS_LOGIN') {
    const s = status;
    body = (
      <div className="space-y-3">
        {s.linked ? (
          <p className="text-sm text-[#4A3B32]">
            {linkedNow ? 'Done — this wedding now shows on their My Wedding. ' : 'This wedding shows on the couple’s My Wedding. '}
            {s.hasCode ? <>They sign in with +91 {spaced(s.mobile)} and the code they already have.</> : <>+91 {spaced(s.mobile)} has no login code yet{s.canReplace ? '' : ' — please ask Shaadi Shopping to give them one'}.</>}
          </p>
        ) : (
          <>
            <p className="text-sm text-[#4A3B32]">+91 {spaced(s.mobile)} already has a sign-in on Vivah OS. Show this wedding there? They keep the code they have.</p>
            <button type="button" disabled={busy} onClick={() => post('give')} className={primary}>{busy ? 'Linking…' : 'Show this wedding on their My Wedding'}</button>
          </>
        )}
        {s.canReplace && (asking ? (
          <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-[#EADFCF]">
            <p className="text-sm text-[#4A3B32]">{s.hasCode ? 'Make a new code? Their current code stops working and they are signed out on every device.' : 'Make a login code for them?'}</p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => post('replace')} className={primary}>{busy ? 'Making…' : 'Make the code'}</button>
              <button type="button" disabled={busy} onClick={() => setAsking(false)} className={secondary}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAsking(true)} className={secondary}>{s.hasCode ? 'Lost code? Make a new one' : 'Make a login code'}</button>
        ))}
      </div>
    );
  }

  return (
    <section aria-label="Couple's My Wedding sign-in" className="space-y-3 rounded-2xl border border-[#EADFCF] bg-[#FBF6EE] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#6B5A4E]">
        <KeyRound className="h-4 w-4" aria-hidden /> Couple&apos;s My Wedding sign-in
      </h2>
      {body}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </section>
  );
}
