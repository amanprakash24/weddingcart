'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';

// My Wedding: the couple chooses their own 6-digit login code (28 Oct 2026). Their first code came from their venue or Shaadi
// Shopping, who can still sign in with it until it is changed. Same rules as everyone's code (lib/auth/vendorCode.ts), checked on
// the server (/api/customer/login-code).
type Errors = Partial<Record<'current' | 'next' | 'confirm', string>>;
const field = 'h-12 w-full rounded-xl border-[1.5px] border-[#D9C9B2] bg-white px-3 text-lg tracking-[0.3em] outline-none focus:border-[#7A1238]';

export default function ChangeLoginCode() {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const res = await fetch('/api/customer/login-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setDone(true);
        setOpen(false);
        setV({ current: '', next: '', confirm: '' });
      } else if (body.fieldErrors) {
        setErrors(body.fieldErrors);
      } else {
        setError(body.error ?? 'Could not change the code. Please try again.');
      }
    } catch {
      setError('No internet connection. Please try again.');
    }
    setBusy(false);
  }

  const box = (key: keyof typeof v, label: string) => (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <input type="password" inputMode="numeric" autoComplete={key === 'current' ? 'current-password' : 'new-password'} maxLength={6} value={v[key]} onChange={(e) => setV((s) => ({ ...s, [key]: e.target.value.replace(/\D/g, '').slice(0, 6) }))} className={field} />
      {errors[key] && <span className="block text-sm text-rose-700">{errors[key]}</span>}
    </label>
  );

  return (
    <section id="sign-in" aria-labelledby="c-signin" className="scroll-mt-4 rounded-[22px] border border-[#EADFCC] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="c-signin" className="flex items-center gap-2 text-[17px] font-bold"><KeyRound className="h-[18px] w-[18px] text-[#7A1238]" aria-hidden /> Your login code</h2>
          <p className="mt-1 text-sm text-[#4D3E36]">{done ? 'Done — use your new code next time you sign in.' : 'Got your code from your venue or Shaadi Shopping? Choose your own, so only you know it.'}</p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-full border border-[#D9C9B2] px-4 text-sm font-bold text-[#7A1238]">Choose my own code</button>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-3">
          {box('current', 'Code you have now')}
          {box('next', 'New 6-digit code')}
          {box('confirm', 'New code again')}
          {error && <p role="alert" className="text-sm text-rose-700 sm:col-span-3">{error}</p>}
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-[#7A1238] px-5 text-sm font-bold text-white disabled:opacity-55">{busy ? 'Saving…' : 'Save my code'}</button>
            <button type="button" disabled={busy} onClick={() => { setOpen(false); setErrors({}); setError(null); }} className="min-h-11 rounded-full border border-[#D9C9B2] px-5 text-sm font-bold text-[#6B5A4E]">Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
