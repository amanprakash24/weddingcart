'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getSession, signIn } from 'next-auth/react';
import { MessageCircle, ShieldCheck } from 'lucide-react';
import VivahOsLogo from '@/components/vivah-os/VivahOsLogo';
import { shaadiWhatsAppLink } from '@/lib/shaadiContact';

// The couple's sign-in to My Wedding on Vivah OS (28 Oct 2026, design: Couple Login canvas): their mobile number + their 6-digit
// login code — the same sign-in as everyone on Vivah OS (NextAuth's 'code' provider). The code comes from their venue or Shaadi
// Shopping (services/coupleLogin.service.ts). One step, no message is sent. Every kind of "no" gets the same sentence, so the page
// never says which numbers have a login.
const POINTS = ['Every function, date and venue', 'Guests and their RSVPs', 'What you have paid and what is due', 'Quotations, invoices and your vendors'];
const HELP = shaadiWhatsAppLink('Hi, I need my My Wedding sign-in code.');
const spaced = (phone: string) => (phone.length > 5 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone);
const EMPTY = ['', '', '', '', '', ''];

export default function CoupleLoginClient({ redirectPath = '/my-wedding' }: { redirectPath?: string }) {
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Signed in, but this number has no couple account (a vendor's or a team member's) — My Wedding would send them straight back
  // here with no word, so say so instead.
  const [notCouple, setNotCouple] = useState<'vendor' | 'other' | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await signIn('code', { phone, code, redirect: false });
      if (res?.ok) {
        const roles = ((await getSession())?.user?.roles ?? []) as string[];
        if (roles.includes('CUSTOMER')) {
          window.location.href = redirectPath;
          return;
        }
        setNotCouple(roles.includes('VENDOR') ? 'vendor' : 'other');
      } else {
        setDigits(EMPTY);
        setError('That mobile number and code do not match. Please check both and try again. After 5 wrong tries, sign-in is paused for 15 minutes.');
      }
    } catch {
      setError('No internet connection. Please try again.');
    }
    setLoading(false);
  };

  // Typing or autofilling into a box fills it and the ones after it.
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

  // Boxes 2–6 hold one character, so the browser would cut a pasted code down to one digit — take the paste here instead.
  const onPaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    e.preventDefault();
    setFrom(pasted.length >= 6 ? 0 : index, pasted); // a whole code fills all six boxes, whichever box it lands in
  };

  const onKey = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) boxes.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft' && index > 0) boxes.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) boxes.current[index + 1]?.focus();
  };

  const startAgain = () => {
    setNotCouple(null);
    setDigits(EMPTY);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#F7F0E6] text-[#221714] lg:flex">
      {/* Photo side: the top of the page on a phone, the left half on a computer. */}
      <div className="relative overflow-hidden bg-[#2E0A16] text-white lg:sticky lg:top-0 lg:h-screen lg:w-[46%] lg:shrink-0">
        <Image src="/images/homepage-poster.jpg" alt="" fill priority sizes="(min-width: 1024px) 46vw, 100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#2E0A16]/55 to-[#2E0A16]/95" />
        <div className="relative flex flex-col justify-between px-5 pb-12 pt-6 sm:px-8 lg:h-full lg:p-14">
          <div className="lg:hidden"><VivahOsLogo size={40} tone="light" /></div>
          <div className="hidden lg:block">
            <Image src="/images/vivah-os/logo-on-dark.png" alt="Vivah OS — the operating system for celebrations" width={800} height={711} className="h-auto w-[300px]" priority />
          </div>
          <div className="mt-8 lg:mt-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#E9C98E]">MY WEDDING</p>
            <h2 className="mt-2 font-cormorant text-[2.2rem] font-semibold leading-[1.05] lg:text-[3.4rem]">Your wedding,<br />all in one place.</h2>
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
      <main className="relative -mt-6 flex flex-1 justify-center rounded-t-3xl bg-[#F7F0E6] px-5 pb-8 pt-7 sm:px-8 lg:mt-0 lg:items-center lg:rounded-none lg:py-12">
        <div className="flex w-full max-w-[420px] flex-col gap-6">
          {notCouple ? (
            <div className="flex flex-col gap-4">
              <h1 className="font-cormorant text-[2.1rem] font-semibold leading-[1.1] lg:text-[2.75rem]">No wedding on this number</h1>
              <p className="text-[15px] leading-relaxed text-[#6B5A4E]">
                {notCouple === 'vendor'
                  ? <>+91 {spaced(phone)} is set up for a business on Vivah OS, not for a wedding. If you meant to open your business, use Vendor OS.</>
                  : <>+91 {spaced(phone)} is not set up for My Wedding.</>}{' '}
                If you are getting married, message us and we will link your wedding.
              </p>
              {notCouple === 'vendor' && (
                <Link href="/vendor" className="flex h-[54px] items-center justify-center rounded-[14px] bg-[#7A1238] text-base font-semibold text-white hover:bg-[#5A0D29]">Open Vendor OS</Link>
              )}
              <a href={HELP} target="_blank" rel="noopener noreferrer" className="flex h-[54px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#D9C9B2] bg-white text-base font-semibold text-[#7A1238] hover:bg-[#FBF6EE]">
                <MessageCircle className="h-[18px] w-[18px]" aria-hidden /> WhatsApp us
              </a>
              <button type="button" onClick={startAgain} className="min-h-11 text-sm font-semibold text-[#7A1238] underline-offset-2 hover:underline">Use a different number</button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-cormorant text-[2rem] font-semibold leading-[1.1] lg:text-[2.75rem]">Sign in to your wedding</h1>
                <p className="mt-2 text-[15px] leading-relaxed text-[#6B5A4E]">Use your mobile number and the 6-digit login code your venue or Shaadi Shopping gave you.</p>
              </div>

              <form onSubmit={onSubmit} className="flex flex-col gap-3.5 lg:rounded-[20px] lg:border lg:border-[#EADFCF] lg:bg-white lg:p-7">
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

                <fieldset className="mt-1.5">
                  <legend className="mb-2.5 text-[13px] font-semibold">6-digit login code</legend>
                  <div className="grid grid-cols-6 gap-2">
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => { boxes.current[i] = el; }}
                        aria-label={`Code digit ${i + 1}`}
                        type="password"
                        inputMode="numeric"
                        autoComplete={i === 0 ? 'current-password' : 'off'}
                        maxLength={i === 0 ? 6 : 1}
                        value={d}
                        onChange={(e) => setFrom(i, e.target.value)}
                        onKeyDown={(e) => onKey(i, e)}
                        onPaste={(e) => onPaste(i, e)}
                        onFocus={(e) => e.target.select()}
                        className="h-[56px] min-w-0 rounded-xl border-[1.5px] border-[#D9C9B2] bg-white text-center text-2xl font-semibold outline-none focus:border-2 focus:border-[#7A1238]"
                      />
                    ))}
                  </div>
                </fieldset>

                {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
                <button type="submit" disabled={loading || phone.length !== 10 || code.length !== 6} className="mt-1 h-[54px] rounded-[14px] bg-[#7A1238] text-base font-semibold text-white transition hover:bg-[#5A0D29] disabled:opacity-55">
                  {loading ? 'Opening…' : 'Open my wedding'}
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#EFE4D3] px-5 py-4">
                <div>
                  <p className="text-sm font-semibold">No code, or wedding not showing?</p>
                  <p className="text-[13px] text-[#6B5A4E]">Ask your venue, or message us.</p>
                </div>
                <a href={HELP} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#7A1238] hover:bg-[#FBF6EE]">
                  <MessageCircle className="h-[18px] w-[18px]" aria-hidden /> WhatsApp us
                </a>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-[#EADFCF] p-4">
                <ShieldCheck className="mt-px h-5 w-5 shrink-0 text-[#7A1238]" aria-hidden />
                <p className="text-[13px] leading-relaxed text-[#4A3B32]">Keep your code to yourself. After you sign in, you can choose your own code in My Wedding.</p>
              </div>

              <p className="text-[13px] text-[#6B5A4E]">Run a venue or vendor business? <Link href="/vendor/login" className="inline-flex min-h-11 items-center font-semibold text-[#7A1238] underline-offset-2 hover:underline">Vendor sign in</Link></p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
