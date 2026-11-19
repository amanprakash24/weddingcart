'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import s from './home3d.module.css';

// Vivah OS in 3D: a laptop with the venue's Today screen and a phone with the couple's proposal turn to face the visitor
// as they scroll, while the story moves on in three steps. The phone swaps to the couple's hall at step two.
const STEPS = [
  {
    kicker: 'Vivah OS',
    title: (
      <>
        Shaadi Shopping brings it together. <em>Vivah OS runs it.</em>
      </>
    ),
    text: 'Every enquiry, quotation, hall and payment in one workspace. This is a venue’s Today screen, as it is in the app.',
  },
  {
    kicker: 'For the couple',
    title: (
      <>
        Your hall, <em>held for you</em>
      </>
    ),
    text: 'The couple’s own proposal shows their hall, date and shift, and how long it is held. No other couple can book it until then.',
  },
  {
    kicker: 'One connected wedding',
    title: (
      <>
        Accept on your phone. <em>Pay by UPI.</em>
      </>
    ),
    text: 'The family, the venue and every vendor work from the same plan: functions, payments and receipts in one place.',
  },
] as const;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => t * t * (3 - 2 * t);

export default function Devices3D() {
  const section = useRef<HTMLElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const phone = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (rig.current) rig.current.style.transform = 'rotateY(-10deg) rotateX(6deg)';
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser setting
      setStill(true);
      return;
    }
    let mx = 0;
    let my = 0;
    let raf = 0;
    let visible = false;

    const frame = () => {
      raf = 0;
      const sec = section.current;
      if (!sec || !rig.current || !phone.current) return;
      const r = sec.getBoundingClientRect();
      const o = clamp(-r.top / (r.height - window.innerHeight), 0, 1);
      const t = ease(clamp(o / 0.45, 0, 1));
      rig.current.style.transform = `rotateY(${-34 + t * 26 + mx * 6}deg) rotateX(${14 - t * 10 - my * 4}deg) translateZ(${-120 + t * 120}px)`;
      const pf = ease(clamp((o - 0.3) / 0.4, 0, 1));
      phone.current.style.transform = `translate3d(${-pf * 40}px, ${-pf * 30}px, ${180 + pf * 120}px) rotateY(${-18 + pf * 10}deg)`;
      setStep(o < 0.34 ? 0 : o < 0.67 ? 1 : 2);
    };
    const schedule = () => {
      if (visible && !raf) raf = requestAnimationFrame(frame);
    };
    const onPointer = (e: PointerEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      schedule();
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    if (section.current) io.observe(section.current);
    frame();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);

  return (
    <section ref={section} className={s.os} aria-labelledby="vivah-os-3d">
      <div className={s.oStage}>
        <div className={s.copy}>
          {STEPS.map((st, i) => (
            <div key={st.kicker} className={`${s.step} ${still || i === step ? s.on : ''}`} aria-hidden={!still && i !== step}>
              <p className={s.kicker}>{st.kicker}</p>
              <h2 id={i === 0 ? 'vivah-os-3d' : undefined}>{st.title}</h2>
              <p>{st.text}</p>
              {i === STEPS.length - 1 && (
                <Link href="/vivah-os" className={s.cta} tabIndex={still || i === step ? 0 : -1}>
                  See Vivah OS
                </Link>
              )}
            </div>
          ))}
          <div className={s.dots} aria-hidden>
            {STEPS.map((st, i) => (
              <i key={st.kicker} className={i === step ? s.dotOn : undefined} />
            ))}
          </div>
        </div>

        <div className={s.scene} aria-hidden>
          <div className={s.glow} />
          <div ref={rig} className={s.rig}>
            <div className={s.shadow} />
            <div className={s.laptop}>
              <div className={s.lid}>
                <div className={s.screen}>
                  <Image src="/images/home3d/screen-venue-today.png" alt="" fill sizes="612px" className="object-cover object-left-top" />
                </div>
              </div>
              <div className={s.deck} />
            </div>
            <div ref={phone} className={s.phone} style={{ transform: 'translate3d(0,0,180px) rotateY(-18deg)' }}>
              <div className={s.back} />
              <div className={s.face}>
                <div className={s.scr}>
                  <span className={s.notch} />
                  <Image src="/images/home3d/screen-couple-proposal.png" alt="" fill sizes="210px" className="object-cover object-top" style={{ opacity: step === 1 ? 0 : 1 }} />
                  <Image src="/images/home3d/screen-couple-hall.png" alt="" fill sizes="210px" className="object-cover object-top" style={{ opacity: step === 1 ? 1 : 0 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
