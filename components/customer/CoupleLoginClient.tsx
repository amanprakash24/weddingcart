'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ChevronLeft, MessageCircle, ShieldCheck } from 'lucide-react';
import VivahOsLogo, { VivahOsMark } from '@/components/vivah-os/VivahOsLogo';
import { shaadiWhatsAppLink } from '@/lib/shaadiContact';

// The couple's sign-in to My Wedding on Vivah OS (28 Oct 2026, design: Couple Login canvas). Mobile number → 6-digit code on WhatsApp.
// Same auth as before (/api/otp/send, then NextAuth's 'otp' provider); only the screen is the couple's own.
const POINTS = ['Every function, date and venue', 'Guests and their RSVPs', 'What you have paid and what is due', 'Quotations, invoices and your vendors'];
const HELP = shaadiWhatsAppLink('Hi, I signed in to My Wedding but my wedding is not showing.');
const spaced = (phone: string) => (phone.length > 5 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone);

export default function CoupleLoginClient({ redirectPath = '/my-wedding' }: { redirectPath?: string }) {
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join('');

  const sendCode = async () => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const res = await fetch('/api/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        setError((data.message || 'We could not send the code. Please try again.').replace('requesting another OTP', 'asking for a new code'));
        return false;
      }
      setDevCode(data.devCode ?? null);
      return true;
    } catch {
      setError('No internet connection. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const onPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await sendCode()) {
      setDigits(['', '', '', '', '', '']);
      setStage('code');
      setTimeout(() => boxes.current[0]?.focus(), 0);
    }
  };

  const onResend = async () => {
    if (await sendCode()) {
      setDigits(['', '', '', '', '', '']);
      setNotice('A new code is on its way.');
      boxes.current[0]?.focus();
    }
  };

  const onCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signIn('otp', { phone, code, redirect: false });
      if (res?.ok) {
        window.location.href = redirectPath;
        return;
      }
      setError('That code is wrong or has expired. Check it, or send a new one.');
    } catch {
      setError('No internet connection. Please try again.');
    }
    setLoading(false);
  };

  // Typing, pasting or autofilling the whole code into any box fills them all.
  const setFrom = (index: number, value: string) => {
    const typed = value.replace(/\D/g, '');
    if (!typed) {
      setDigits((d) => d.map((x, i) => (i === index ? '' : x)));
      return;
    }
    setDigits((d) => {
      const next = [...d];
      typed.slice(0, 6 - index).split('').forEach((ch, k) => { next[index + k] = ch; });
      return next;
    });
    boxes.current[Math.min(index + typed.length, 5)]?.focus();
  };

  const onKey = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) boxes.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft' && index > 0) boxes.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) boxes.current[index + 1]?.focus();
  };

  const backToPhone = () => {
    setStage('phone');
    setError('');
    setNotice('');
  };

  return (
    <div className="min-h-screen bg-[#F7F0E6] text-[#221714] lg:flex">
      {/* Photo side: the top of the page on a phone, the left half on a computer. */}
      <div className="relative overflow-hidden bg-[#2E0A16] text-white lg:sticky lg:top-0 lg:h-screen lg:w-[46%] lg:shrink-0">
        <Image src="/images/homepage-poster.jpg" alt="" fill priority sizes="(min-width: 1024px) 46vw, 100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#2E0A16]/55 to-[#2E0A16]/95" />
        <div className={`relative flex flex-col justify-between px-5 pb-12 pt-6 sm:px-8 lg:h-full lg:p-14 ${stage === 'code' ? 'max-lg:hidden' : ''}`}>
          <div className="lg:hidden"><VivahOsLogo size={40} tone="light" /></div>
          <div className="hidden lg:block">
            <Image src="/images/vivah-os/logo-on-dark.png" alt="Vivah OS — the operating system for celebrations" width={800} height={711} className="h-auto w-[300px]" priority />
          </div>
          <div className="mt-10 lg:mt-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#E9C98E]">MY WEDDING</p>
            <h2 className="mt-2 font-cormorant text-[2.4rem] font-semibold leading-[1.05] lg:text-[3.4rem]">Your wedding,<br />all in one place.</h2>
            <ul className="mt-6 hidden space-y-3 text-[15px] text-[#F3E8DA] lg:block">
              {POINTS.map((p) => (
                <li key={p} className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#C9A05A]" aria-hidden />{p}</li>
              ))}
            </ul>
          </div>
          <p className="hidden text-[13px] text-[#D9CBB8] lg:block">One wedding, one Wedding ID.</p>
        </div>
      </div>

      {/* Form side */}
      <main className={`relative flex flex-1 justify-center px-5 pb-8 sm:px-8 lg:items-center lg:py-12 ${stage === 'phone' ? '-mt-6 rounded-t-3xl bg-[#F7F0E6] pt-7 lg:mt-0 lg:rounded-none' : 'pt-5'}`}>
        <div className="flex w-full max-w-[420px] flex-col gap-6">
          {stage === 'phone' ? (
            <>
              <div>
                <h1 className="font-cormorant text-[2rem] font-semibold leading-[1.1] lg:text-[2.75rem]">Sign in to your wedding</h1>
                <p className="mt-2 text-[15px] leading-relaxed text-[#6B5A4E]">Use the mobile number you gave your venue or your Shaadi Shopping expert. We will send you a 6-digit code on WhatsApp.</p>
              </div>

              <form onSubmit={onPhone} className="flex flex-col gap-3.5 lg:rounded-[20px] lg:border lg:border-[#EADFCF] lg:bg-white lg:p-7">
                <label htmlFor="couple-mobile" className="text-[13px] font-semibold">Mobile number</label>
                <div className="flex h-14 items-center overflow-hidden rounded-[14px] border-[1.5px] border-[#D9C9B2] bg-white focus-within:border-[#7A1238]">
                  <span className="flex h-full items-center border-r border-[#EADFCF] bg-[#F7F0E6] px-4 text-base font-semibold text-[#6B5A4E]">+91</span>
                  <input
                    id="couple-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={spaced(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10})/, '').slice(0, 10))}
                    placeholder="98765 43210"
                    required
                    className="h-full min-w-0 flex-1 bg-transparent px-4 text-lg tracking-[0.04em] outline-none placeholder:text-[#B8A898]"
                  />
                </div>
                {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
                <button type="submit" disabled={loading || phone.length !== 10} className="h-[54px] rounded-[14px] bg-[#7A1238] text-base font-semibold text-white transition hover:bg-[#5A0D29] disabled:opacity-55">
                  {loading ? 'Sending…' : 'Send code'}
                </button>
                <p className="text-center text-xs text-[#6B5A4E]">Check WhatsApp on this number for the code.</p>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#EFE4D3] px-5 py-4">
                <div>
                  <p className="text-sm font-semibold">Wedding not showing?</p>
                  <p className="text-[13px] text-[#6B5A4E]">We will link it for you.</p>
                </div>
                <a href={HELP} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#7A1238] hover:bg-[#FBF6EE]">
                  <MessageCircle className="h-[18px] w-[18px]" aria-hidden /> WhatsApp us
                </a>
              </div>

              <p className="text-[13px] text-[#6B5A4E]">Run a venue or vendor business? <Link href="/vendor/login" className="font-semibold text-[#7A1238] underline-offset-2 hover:underline">Vendor sign in</Link></p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between lg:hidden">
                <button type="button" onClick={backToPhone} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#EADFCF] bg-white">
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <span className="flex items-center gap-2">
                  <VivahOsMark size={30} />
                  <span className="font-cormorant text-[1.35rem] font-bold tracking-[0.04em]"><span className="text-[#7A1238]">VIVAH</span> <span className="text-[#B8873E]">OS</span></span>
                </span>
                <span className="w-11" aria-hidden />
              </div>

              <div className="mt-4 lg:mt-0">
                <h1 className="font-cormorant text-[2.1rem] font-semibold leading-[1.1] lg:text-[2.75rem]">Enter your code</h1>
                <p className="mt-2 text-[15px] leading-relaxed text-[#6B5A4E]">
                  We sent a 6-digit code on WhatsApp to <strong className="text-[#221714]">+91 {spaced(phone)}</strong>.{' '}
                  <button type="button" onClick={backToPhone} className="font-semibold text-[#7A1238] underline-offset-2 hover:underline">Change</button>
                </p>
              </div>

              <form onSubmit={onCode} className="flex flex-col gap-4 lg:rounded-[20px] lg:border lg:border-[#EADFCF] lg:bg-white lg:p-7">
                <fieldset>
                  <legend className="mb-2.5 text-[13px] font-semibold">6-digit code</legend>
                  <div className="grid grid-cols-6 gap-2">
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => { boxes.current[i] = el; }}
                        aria-label={`Digit ${i + 1}`}
                        inputMode="numeric"
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        maxLength={i === 0 ? 6 : 1}
                        value={d}
                        onChange={(e) => setFrom(i, e.target.value)}
                        onKeyDown={(e) => onKey(i, e)}
                        onFocus={(e) => e.target.select()}
                        className="h-[60px] min-w-0 rounded-xl border-[1.5px] border-[#EADFCF] bg-white text-center text-2xl font-semibold outline-none focus:border-2 focus:border-[#7A1238]"
                      />
                    ))}
                  </div>
                </fieldset>
                {devCode && <p className="text-xs text-[#6B5A4E]">Test mode, code: {devCode}</p>}
                {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
                {notice && !error && <p role="status" className="text-sm text-[#2F6B3F]">{notice}</p>}
                <button type="submit" disabled={loading || code.length !== 6} className="h-[54px] rounded-[14px] bg-[#7A1238] text-base font-semibold text-white transition hover:bg-[#5A0D29] disabled:opacity-55">
                  {loading ? 'Opening…' : 'Open my wedding'}
                </button>
                <p className="text-center text-sm text-[#6B5A4E]">
                  Didn&apos;t get it? <button type="button" onClick={onResend} disabled={loading} className="font-semibold text-[#7A1238] underline-offset-2 hover:underline disabled:opacity-55">Send again</button>
                </p>
              </form>

              <div className="flex items-start gap-3 rounded-2xl bg-[#EFE4D3] p-4">
                <ShieldCheck className="mt-px h-5 w-5 shrink-0 text-[#7A1238]" aria-hidden />
                <p className="text-[13px] leading-relaxed text-[#4A3B32]">Keep this code to yourself. No one from Shaadi Shopping or your venue will ask you for it.</p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
