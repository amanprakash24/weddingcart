'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import s from './home3d.module.css';

// "Venues in Patna" in 3D: the real venue cards (rendered on the server and passed in) stand on a turning ring. As the
// visitor scrolls, the ring turns and brings each venue to the front; the arrows do the same one step at a time.
// Only the front card can be clicked; tabbing to a card turns the ring to it. Visitors who ask for reduced motion get
// the plain grid.
const STEP_VH = 45; // scroll length per venue

export default function VenueRing({ items, labels, header }: { items: ReactNode[]; labels: string[]; header: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const slots = useRef<(HTMLLIElement | null)[]>([]);
  const [front, setFront] = useState(0);
  const n = items.length;
  const step = 360 / n;

  const scrollToIndex = (i: number) => {
    const el = outer.current;
    if (!el) return;
    const k = Math.max(0, Math.min(n - 1, i));
    const top = el.getBoundingClientRect().top + window.scrollY;
    const y = top + (k / (n - 1)) * (el.offsetHeight - window.innerHeight);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const frame = () => {
      raf = 0;
      const el = outer.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, -r.top / (el.offsetHeight - window.innerHeight)));
      const f = p * (n - 1);
      const narrow = window.innerWidth < 860;
      const R = narrow ? 230 : 460;
      slots.current.forEach((li, i) => {
        if (!li) return;
        let a = (i - f) * step;
        a = ((((a + 180) % 360) + 360) % 360) - 180;
        const abs = Math.abs(a);
        li.style.transform = `translate3d(-50%, -50%, 0) rotateY(${a}deg) translateZ(${R}px) rotateY(${-a * 0.35}deg)`;
        li.style.opacity = String(abs < 70 ? 1 - (abs / 70) * 0.35 : Math.max(0.12, 0.65 - ((abs - 70) / 110) * 0.55));
        li.style.pointerEvents = abs < 20 ? 'auto' : 'none';
        li.style.zIndex = String(Math.round(200 - abs));
      });
      // Shrink the ring when the window is short, so the front card always fits under the heading.
      const ring = el.querySelector<HTMLElement>(`.${s.ring}`);
      const wrap = ring?.parentElement;
      const tallest = Math.max(...slots.current.map((li) => li?.offsetHeight ?? 0));
      const fit = wrap && tallest ? Math.min(1, ((wrap.clientHeight - 16) / tallest) * 0.97) : 1;
      if (ring) ring.style.transform = `scale(${fit.toFixed(3)}) translateZ(${-R}px) rotateX(${narrow ? 4 : 6}deg)`;
      setFront(Math.round(f));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    frame();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [n, step]);

  return (
    <div ref={outer} className={s.vOuter} style={{ height: `${100 + (n - 1) * STEP_VH}vh` }}>
      <div className={s.vStage}>
        <div className={s.ringHead}>{header}</div>
        <div className={s.ringWrap}>
          <ul className={s.ring} aria-label="Venues">
            {items.map((it, i) => (
              <li
                key={`${i}-${labels[i]}`}
                ref={(el) => {
                  slots.current[i] = el;
                }}
                className={s.slot}
                onFocus={() => {
                  if (i !== front) scrollToIndex(i);
                }}
              >
                {it}
              </li>
            ))}
          </ul>
          <div aria-hidden className={s.ringFloor} />
        </div>
        <div className={s.ringNav}>
          <button type="button" className={s.ringBtn} onClick={() => scrollToIndex(front - 1)} disabled={front === 0} aria-label="Previous venue">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <p className={s.ringCount}>
            <span className="sr-only">Showing </span>
            {labels[front]} <span className={s.ringOf}>· {front + 1} of {n}</span>
          </p>
          <button type="button" className={s.ringBtn} onClick={() => scrollToIndex(front + 1)} disabled={front === n - 1} aria-label="Next venue">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
