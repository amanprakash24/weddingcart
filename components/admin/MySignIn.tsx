'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Smartphone } from 'lucide-react';

// "My sign-in" (7 Oct 2026): a member of Shaadi Shopping's own team — the founder first — registers their OWN mobile number here
// and gets their own 6-digit code, so they can sign in the way everyone does: mobile number + code. The number is typed here by
// the person; it is not written anywhere in the source code. Email and password keeps working beside it.
type Status = { mobile: string | null; hasCode: boolean; hasPassword: boolean };

const field = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100';
const label = 'mb-1.5 block text-xs font-semibold text-gray-600';

export default function MySignIn() {
  const [status, setStatus] = useState<Status | null>(null);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ mobile: string; belongsTo: string } | null>(null);
  const [issued, setIssued] = useState<{ code: string; mobile: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/admin/account/sign-in')
      .then((r) => r.json())
      .then((b) => live && b.success && setStatus(b.data))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function submit(confirmExisting = false) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await fetch('/api/admin/account/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile, password, confirmExisting }) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        setIssued({ code: b.loginCode, mobile: b.mobile });
        setStatus((s) => (s ? { ...s, mobile: b.mobile, hasCode: true } : s));
        setConfirm(null);
        setPassword('');
        setCopied(false);
      } else if (b.confirm) {
        setConfirm(b.confirm);
      } else {
        setErrors(b.fieldErrors ?? {});
        if (!b.fieldErrors) setError(b.error ?? 'That did not work. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  }

  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopied(true);
    } catch {
      setError('Could not copy — please select the code and copy it yourself.');
    }
  }

  if (!status) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-xl space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Smartphone className="h-4 w-4" aria-hidden /> Sign in with your mobile number</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          {status.mobile && status.hasCode
            ? `Your mobile number ${status.mobile} is registered. At the sign-in page, enter it with your 6-digit code.`
            : 'Register your own mobile number here and you will get a 6-digit code. From then on you sign in with your mobile number and that code.'}
          {status.hasPassword && ' Your email and password keep working as well.'}
        </p>

        {issued ? (
          <div className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-gray-700">
            <p className="flex items-center gap-1.5 font-semibold text-gray-900"><KeyRound className="h-4 w-4" aria-hidden /> Your login code</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="select-all rounded-lg bg-white px-3 py-1.5 font-mono text-xl font-bold tracking-[0.3em] text-gray-900 ring-1 ring-amber-200">{issued.code}</span>
              <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700">
                {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />} {copied ? 'Copied' : 'Copy code'}
              </button>
            </div>
            <p>Sign in at <span className="font-medium">/admin/login</span> with mobile <span className="font-medium">{issued.mobile}</span> and this code.</p>
            <p className="font-medium text-amber-800">Shown only now. Keep it somewhere safe — it cannot be shown again, only replaced. You can change it after you sign in.</p>
          </div>
        ) : confirm ? (
          <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-gray-700">
            <p>
              <span className="font-semibold">{confirm.mobile}</span> is already {confirm.belongsTo}. If that is you, link it: you will then sign in once with that number and choose where to work — it keeps what it has and
              also gets your access here. Its current code is replaced by a new one.
            </p>
            <p className="font-medium text-amber-800">Only do this if the number is your own.</p>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => submit(true)} className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Linking…' : 'Yes, this is my number — link it'}</button>
              <button type="button" disabled={busy} onClick={() => setConfirm(null)} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50">Cancel</button>
            </div>
          </div>
        ) : (
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <label htmlFor="my-mobile" className={label}>{status.mobile ? 'Mobile number (enter it again, or a new one)' : 'Your mobile number'}</label>
              <input id="my-mobile" type="tel" inputMode="numeric" autoComplete="tel-national" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" className={field} aria-invalid={Boolean(errors.mobile)} />
              {errors.mobile && <p className="mt-1 text-xs text-red-600">{errors.mobile}</p>}
            </div>
            {status.hasPassword && (
              <div>
                <label htmlFor="my-password" className={label}>Your current password (to confirm it is you)</label>
                <input id="my-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} aria-invalid={Boolean(errors.password)} />
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              </div>
            )}
            <button type="submit" disabled={busy || mobile.length !== 10 || (status.hasPassword && !password)} className="rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Working…' : status.hasCode ? 'Get a new code' : 'Register and get my code'}
            </button>
          </form>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
