'use client';

import { useEffect } from 'react';

// Bends the moving service row (ServicePills) like a curved TV screen: the middle sits further back and both ends
// wrap towards the visitor, so pills near the edges turn inwards and come forward (and look bigger).
// Runs only while the row is on screen, and not at all with reduced motion.
export default function PillsCurve({ selector }: { selector: string }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const row = document.querySelector<HTMLElement>(selector);
    if (!row) return;
    const pills = [...row.querySelectorAll<HTMLElement>('a')];
    let raf = 0;
    let visible = false;
    const frame = () => {
      raf = 0;
      if (!visible) return;
      const mid = window.innerWidth / 2;
      for (const p of pills) {
        // Measure the list item, which is not transformed, so the curve does not feed back into itself.
        const r = (p.parentElement ?? p).getBoundingClientRect();
        const d = Math.max(-1.3, Math.min(1.3, (r.left + r.width / 2 - mid) / mid));
        p.style.transform = `perspective(800px) translateZ(${d * d * 170 - 60}px) rotateY(${d * 46}deg)`;
      }
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    io.observe(row);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      pills.forEach((p) => (p.style.transform = ''));
    };
  }, [selector]);
  return null;
}
