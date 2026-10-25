'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { btnGold, serif } from './styles';

// Vivah OS on the homepage: four features you can tap, each with a sample phone screen. The screens are drawings of the
// layout — grey bars stand in for names and amounts, so no real or invented customer data is shown.
const FEATURES = [
  { key: 'enquiries', title: 'Every enquiry in one place', text: 'Your own and the ones Shaadi Shopping sends, with follow-ups for your team.', screen: 'Enquiries' },
  { key: 'quotation', title: 'Quotations under your name', text: 'From your price list, with your logo, shared as a link the couple opens on their phone.', screen: 'Quotation' },
  { key: 'payments', title: 'Payments you can follow', text: 'Your UPI on the proposal; what is received and what is still due.', screen: 'Payments' },
  { key: 'team', title: 'Your team, each with a sign-in', text: 'Owner, manager, employee: mobile number and code, each sees their own work.', screen: 'Team' },
] as const;
type Key = (typeof FEATURES)[number]['key'];

const Bar = ({ w = 'w-24', dark = false }: { w?: string; dark?: boolean }) => (
  <span aria-hidden className={`block h-2.5 rounded-full ${w} ${dark ? 'bg-[#D9CBB8]' : 'bg-[#EADFCC]'}`} />
);
const Tag = ({ children, cls }: { children: React.ReactNode; cls: string }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}>{children}</span>
);
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-[#EADFCC] bg-white p-3.5">{children}</div>
);

function Screen({ k }: { k: Key }) {
  if (k === 'enquiries')
    return (
      <div className="space-y-2.5">
        {[
          ['NEW', 'bg-[#F4E6EC] text-[#7A1238]', 'Wedding'],
          ['FOLLOW UP TODAY', 'bg-[#F5EEDD] text-[#8A6A2F]', 'Site visit'],
          ['FROM SHAADI SHOPPING', 'bg-[#E6F0E9] text-[#2F6B45]', 'Reception'],
        ].map(([tag, cls, what]) => (
          <Card key={tag}>
            <Tag cls={cls}>{tag}</Tag>
            <div className="mt-2.5 space-y-1.5"><Bar w="w-28" dark /><p className="text-xs text-[#6B5A4E]">{what} · guests · date</p></div>
          </Card>
        ))}
      </div>
    );
  if (k === 'quotation')
    return (
      <Card>
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F4E6EC] text-[11px] font-bold text-[#7A1238]">Logo</span>
          <div className="space-y-1.5"><Bar w="w-24" dark /><p className="text-xs text-[#6B5A4E]">Quotation for the couple</p></div>
        </div>
        <div className="mt-3 space-y-2.5 border-t border-[#F0E6D6] pt-3 text-xs text-[#221714]">
          {['Hall rental · per function', 'Veg menu · per plate', 'Decor package'].map((l) => (
            <div key={l} className="flex items-center justify-between gap-2"><span>{l}</span><Bar w="w-10" /></div>
          ))}
          <div className="flex items-center justify-between border-t border-[#F0E6D6] pt-2.5 font-bold"><span>Total</span><Bar w="w-14" dark /></div>
        </div>
        <p className="mt-3 rounded-xl bg-[#7A1238] py-2.5 text-center text-xs font-bold text-white">Share link on WhatsApp</p>
      </Card>
    );
  if (k === 'payments')
    return (
      <div className="space-y-2.5">
        <Card>
          <p className="text-xs text-[#6B5A4E]">Wedding payments</p>
          <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#F0E6D6]"><div className="h-full w-2/5 bg-[#2F6B45]" /></div>
          <div className="mt-2.5 flex justify-between text-xs text-[#6B5A4E]"><span>Received</span><span>Still due</span></div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E6F0E9] text-[11px] font-bold text-[#2F6B45]">UPI</span>
            <div><p className="text-sm font-bold text-[#221714]">Advance received</p><p className="text-xs text-[#6B5A4E]">Paid on the proposal link</p></div>
          </div>
        </Card>
      </div>
    );
  return (
    <div className="space-y-2.5">
      {[
        ['Owner', 'Sees everything', 'bg-[#7A1238]'],
        ['Manager', 'Enquiries and quotations', 'bg-[#8A6A2F]'],
        ['Employee', 'Their own to-dos', 'bg-[#4B3F7A]'],
      ].map(([role, sees, bg]) => (
        <Card key={role}>
          <div className="flex items-center gap-3">
            <span aria-hidden className={`h-9 w-9 flex-shrink-0 rounded-full ${bg}`} />
            <div><p className="text-sm font-bold text-[#221714]">{role}</p><p className="text-xs text-[#6B5A4E]">{sees}</p></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function VivahOsSection() {
  const [active, setActive] = useState<Key>('enquiries');
  const current = FEATURES.find((f) => f.key === active)!;

  return (
    <section id="vivah-os" aria-labelledby="home-vivah-os" className="relative isolate scroll-mt-28 overflow-hidden bg-[#140A09] px-4 py-16 text-[#FBF6EE] sm:px-6 sm:py-24 lg:py-28">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(900px_500px_at_80%_20%,#3A0A1C_0%,rgba(58,10,28,0)_70%)]" />
      <div className="mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div>
          <p className="flex flex-wrap items-center gap-3">
            <span className="text-[1.9rem] font-semibold text-[#E9C98E]" style={serif}>Vivah OS</span>
            <span className="rounded-full border border-[#E9C98E] px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] text-[#E9C98E]">EARLY ACCESS · BY SHAADI SHOPPING</span>
          </p>
          <h2 id="home-vivah-os" className="mt-4 text-[2.3rem] font-semibold leading-[1.04] sm:text-5xl lg:text-[3.9rem]" style={serif}>
            One wedding. One Wedding ID. <span className="italic text-[#E9C98E]">One connected workspace.</span>
          </h2>
          <p className="mt-5 max-w-[600px] text-base leading-relaxed text-[#D9CBB8] sm:text-lg">
            For venues and wedding businesses: run every enquiry, quotation and booked wedding in one place, with your team, on your phone.
          </p>

          <div role="tablist" aria-label="Vivah OS features" className="mt-8 flex flex-col gap-2.5">
            {FEATURES.map((f) => {
              const on = f.key === active;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  id={`vos-tab-${f.key}`}
                  aria-selected={on}
                  aria-controls="vos-panel"
                  onClick={() => setActive(f.key)}
                  className={`rounded-[18px] border border-l-4 px-5 py-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#E9C98E] ${on ? 'border-[#E9C98E] bg-[#2A1714]' : 'border-[#3A2722] hover:border-[#5A433B]'}`}
                >
                  <span className="flex items-center gap-2 text-[17px] font-bold">{on && <Check className="h-4 w-4 text-[#E9C98E]" aria-hidden />}{f.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-[#CDBCA8]">{f.text}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/vendor-onboarding" className={btnGold}>Request early access</Link>
            <Link href="/vivah-os" className="inline-flex min-h-[50px] items-center justify-center rounded-full border border-[#5A433B] px-6 text-[15px] font-semibold text-[#FBF6EE] transition-colors hover:border-[#E9C98E] outline-none focus-visible:ring-2 focus-visible:ring-[#E9C98E]">
              See everything in Vivah OS
            </Link>
          </div>
        </div>

        <div className="relative flex justify-center">
          <div aria-hidden className="absolute top-14 h-[420px] w-[420px] max-w-full rounded-full bg-[radial-gradient(circle,rgba(233,201,142,0.25),rgba(233,201,142,0)_70%)]" />
          <div
            id="vos-panel"
            role="tabpanel"
            aria-labelledby={`vos-tab-${active}`}
            className="relative w-[300px] rounded-[46px] border border-[#3A2722] bg-[#0A0505] p-3 shadow-[0_40px_90px_rgba(0,0,0,0.6)] sm:w-[340px]"
          >
            <div className="flex h-[560px] flex-col gap-3 rounded-[36px] bg-[#FBF6EE] px-5 py-6 text-[#221714] sm:h-[600px]">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#8A6A2F]">{current.screen}</span>
                <span aria-hidden className="h-8 w-8 rounded-full bg-[#7A1238]" />
              </div>
              <p className="text-[1.7rem] font-semibold leading-tight" style={serif}>{current.title}</p>
              <Screen k={active} />
              <p className="mt-auto text-center text-xs text-[#6B5A4E]">Sample screen</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
