'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { ArrowLeft, MessageCircle } from 'lucide-react';

// "Forgot your code?" on the couple's sign-in (29 Oct 2026). Step 1: their mobile number → a one-time code on WhatsApp.
// Step 2: that code + a new 6-digit login code twice → saved, and they are signed in with it. Rules live on the server
// (services/coupleCodeReset.service.ts): only a couple's own sign-in, same answer for every number, 5 wrong tries pause it.
type Errors = Partial<Record<'mobile' | 'otp' | 'next' | 'confirm', string>>;
const RESEND_SECONDS = 60; // services/otp.service.ts: one WhatsApp code a minute
const spaced = (phone: string) => (phone.length > 5 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone);
const digitsOnly = (v: string) => v.replace(/\D/g, '').slice(0, 6);
const box = 'h-14 w-full rounded-[14px] border-[1.5px] border-[#D9C9B2] bg-white px-4 text-lg tracking-[0.3em] outline-none focus:border-[#7A1238]';

export default function CoupleResetCode({ initialPhone, redirectPath, onBack, helpLink }: { initialPhone: string; redirectPath: string; onBack: () => void; helpLink: string }) {
  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [phone, setPhone] = useState(initialPhone);
  const [v, setV] = useState({ otp: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function post(path: string, body: object) {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: res.ok, body: await res.json().catch(() => ({})) };
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setError('');
    try {
      const { ok, body } = await post('/api/customer/reset-code/send', { mobile: phone });
      if (ok && body.success) {
        setStep('code');
        setWait(RESEND_SECONDS);
        setDevCode(body.devCode ?? null);
      } else if (body.fieldErrors) {
        setErrors(body.fieldErrors);
      } else {
        setError(body.error ?? 'Could not send the code. Please try again.');
      }
    } catch {
      setError('No internet connection. Please try again.');
    }
    setBusy(false);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setError('');
    try {
      const { ok, body } = await post('/api/customer/reset-code/confirm', { mobile: phone, ...v });
      if (ok && body.success) {
        const res = await signIn('code', { phone, code: v.next, redirect: false });
        if (res?.ok) {
          window.location.href = redirectPath;
          return;
        }
        // Saved, but signing in did not go through: send them back to sign in with the new code.
        onBack();
        return;
      }
      if (body.fieldErrors) setErrors(body.fieldErrors);
      else setError(body.error ?? 'Could not save your code. Please try again.');
    } catch {
      setError('No internet connection. Please try again.');
    }
    setBusy(false);
  }

  const codeField = (key: keyof typeof v, label: string, hint?: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <input
        type={key === 'otp' ? 'text' : 'password'}
        inputMode="numeric"
        autoComplete={key === 'otp' ? 'one-time-code' : 'new-password'}
        autoFocus={key === 'otp'}
        maxLength={6}
        value={v[key]}
        onChange={(e) => setV((s) => ({ ...s, [key]: digitsOnly(e.target.value) }))}
        aria-invalid={!!errors[key]}
        className={box}
      />
      {hint && !errors[key] && <span className="text-[13px] text-[#6B5A4E]">{hint}</span>}
      {errors[key] && <span className="text-sm text-rose-700">{errors[key]}</span>}
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-[#7A1238]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
      </button>

      <div>
        <h1 className="font-cormorant text-[2rem] font-semibold leading-[1.1] lg:text-[2.75rem]">Choose a new code</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B5A4E]">
          {step === 'mobile'
            ? 'We will send a one-time code on WhatsApp to the mobile number you sign in with.'
            : <>If +91 {spaced(phone)} has a My Wedding sign-in, a 6-digit code is on its way on WhatsApp. It works for 5 minutes.</>}
        </p>
      </div>

      {step === 'mobile' ? (
        <form onSubmit={send} className="flex flex-col gap-3.5 lg:rounded-[20px] lg:border lg:border-[#EADFCF] lg:bg-white lg:p-7">
          <label htmlFor="reset-mobile" className="text-[13px] font-semibold">Mobile number</label>
          <div className="flex h-14 items-center overflow-hidden rounded-[14px] border-[1.5px] border-[#D9C9B2] bg-white focus-within:border-[#7A1238]">
            <span className="flex h-full items-center border-r border-[#EADFCF] bg-[#F7F0E6] px-4 text-base font-semibold text-[#6B5A4E]">+91</span>
            <input
              id="reset-mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              autoFocus
              value={spaced(phone)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10})/, '').slice(0, 10))}
              placeholder="98765 43210"
              className="h-full min-w-0 flex-1 bg-transparent px-4 text-lg tracking-[0.04em] outline-none placeholder:text-[#B8A898]"
            />
          </div>
          {errors.mobile && <p className="text-sm text-rose-700">{errors.mobile}</p>}
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
          <button type="submit" disabled={busy || phone.length !== 10} className="mt-1 h-[54px] rounded-[14px] bg-[#7A1238] text-base font-semibold text-white transition hover:bg-[#5A0D29] disabled:opacity-55">
            {busy ? 'Sending…' : 'Send code on WhatsApp'}
          </button>
        </form>
      ) : (
        <form onSubmit={confirm} className="flex flex-col gap-4 lg:rounded-[20px] lg:border lg:border-[#EADFCF] lg:bg-white lg:p-7">
          {devCode && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">Test computer, WhatsApp not set up — the code is {devCode}</p>}
          {codeField('otp', 'Code from WhatsApp')}
          {codeField('next', 'New 6-digit login code', 'Not easy to guess — no 123456 or 111111.')}
          {codeField('confirm', 'New code again')}
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
          <button type="submit" disabled={busy || v.otp.length !== 6 || v.next.length !== 6 || v.confirm.length !== 6} className="mt-1 h-[54px] rounded-[14px] bg-[#7A1238] text-base font-semibold text-white transition hover:bg-[#5A0D29] disabled:opacity-55">
            {busy ? 'Saving…' : 'Save and open my wedding'}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button type="button" disabled={busy || wait > 0} onClick={() => send()} className="min-h-11 font-semibold text-[#7A1238] disabled:text-[#9C8B7E]">
              {wait > 0 ? `Send again in ${wait}s` : 'Send the code again'}
            </button>
            <button type="button" onClick={() => { setStep('mobile'); setV({ otp: '', next: '', confirm: '' }); setErrors({}); setError(''); }} className="min-h-11 font-semibold text-[#6B5A4E]">
              Change number
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#EFE4D3] px-5 py-4">
        <p className="text-sm font-semibold">No WhatsApp on this number?</p>
        <a href={helpLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#7A1238] hover:bg-[#FBF6EE]">
          <MessageCircle className="h-[18px] w-[18px]" aria-hidden /> WhatsApp us
        </a>
      </div>
    </div>
  );
}
