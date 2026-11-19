import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import HowDepth from './HowDepth';
import s3 from './home3d.module.css';
import { accent, btnOutline, btnPrimary, container, eyebrow, h2, sectionPad, serif } from './styles';

// For venues and wedding businesses: why list with us, and the registration steps that exist today (/vendor-onboarding).
// Only claims we can back up: no "free", no numbers. Growth Partner has its own section (GrowthPartnerSection).
// In 3D (19 Nov 2026): the photo and the registration card turn and separate in depth, the three registration steps
// float forward one by one, and the four point cards stand up one after another. HowDepth drives it from the scroll.
const POINTS = [
  { title: 'Your own listing page', text: 'Photos, menu, prices and your venue tour video.' },
  { title: 'Matched enquiries', text: 'Families by date, guest count and budget, sent to you.' },
  { title: 'Vivah OS for your team', text: 'Quotations, payments and your team in one place. In early access.' },
  { title: 'Reviewed by our team', text: 'We read every registration and get in touch.' },
];
const STEPS = ['Business details and contact', 'Menu card, 3 photos and a tour video', 'We review it and get in touch'];

export default function ForBusinesses() {
  return (
    <section id="for-vendors" aria-labelledby="home-vendors" className={`${s3.biz} scroll-mt-28 overflow-hidden bg-[#FBF6EE] ${sectionPad}`}>
      <div className={`${container} grid items-center gap-12 lg:grid-cols-2 lg:gap-16`}>
        <div data-biz-scene className={`${s3.bizStage} relative order-2 h-[420px] sm:h-[520px] lg:order-1`}>
          <div className={s3.bizScene}>
            <div className={`${s3.bizPhoto} absolute left-0 top-0 h-[85%] w-[80%] overflow-hidden rounded-[26px] shadow-[0_40px_80px_rgba(34,23,20,0.22)] sm:w-[72%]`}>
              <Image src="/cat-venue-guides.jpg" alt="A wedding lawn set up with a floral mandap and seating" fill sizes="(max-width: 1024px) 80vw, 40vw" className="object-cover" />
            </div>
            <div className={`${s3.bizCard} absolute bottom-0 right-0 w-[78%] rounded-[22px] border border-[#EADFCC] bg-white p-5 shadow-[0_40px_80px_rgba(34,23,20,0.22)] sm:w-[60%] sm:p-6`}>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#8A6A2F]">How registration works</p>
              <ol className="mt-3 space-y-2.5 text-sm text-[#221714] [transform-style:preserve-3d]">
                {STEPS.map((s, i) => (
                  <li key={s} className={`${s3.bizStep} flex items-center gap-2.5`} style={{ '--i': i } as CSSProperties}>
                    <span className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-[#7A1238] text-[13px] font-bold text-white">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className={eyebrow}>For venues &amp; wedding businesses</p>
          <h2 id="home-vendors" className={h2} style={serif}>Grow your wedding business <span className={accent}>with Shaadi Shopping</span></h2>
          <p className="mt-5 text-base leading-relaxed text-[#4D3E36] sm:text-lg">
            Families in Patna come to us to plan their weddings. List your venue or service and we bring you enquiries that match what you offer.
          </p>
          <ul data-biz-points className={`${s3.bizPoints} mt-8 grid gap-3.5 sm:grid-cols-2`}>
            {POINTS.map((p, i) => (
              <li key={p.title} className={s3.bizPoint} style={{ '--i': i } as CSSProperties}>
                <div data-tilt className="h-full rounded-[20px] border border-[#EADFCC] bg-white p-5 shadow-[0_18px_40px_rgba(34,23,20,0.08)]">
                  <h3 className="font-bold text-[#221714]">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#4D3E36]">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/vendor-onboarding" className={btnPrimary}>List your business</Link>
            <Link href="/vendor/login" className={btnOutline}>Vendor sign-in</Link>
          </div>
        </div>
      </div>
      <HowDepth
        sectionId="for-vendors"
        vars={[
          { sel: '[data-biz-scene]', name: '--b', start: 0.95, span: 0.7 },
          { sel: '[data-biz-points]', name: '--p', start: 0.95, span: 0.55 },
        ]}
      />
    </section>
  );
}
