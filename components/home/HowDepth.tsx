'use client';

import { useEffect } from 'react';

// Drives the scroll-linked 3D in a homepage section: for each target inside the section, sets a CSS number from 0 to 1
// on the section as that target scrolls into view. The CSS defaults each number to 1 (the finished layout), so without
// JavaScript or with reduced motion the section simply shows its end state.
//  start: where the target's top must be (as a share of the window height) for the number to start rising from 0
//  span:  how much further it scrolls (as a share of the window height) before the number reaches 1
// Used by How it works (--c, --s) and For businesses (--b, --p).
export type ScrollVar = { sel: string; name: string; start: number; span: number };
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export default function HowDepth({ sectionId, vars }: { sectionId: string; vars: ScrollVar[] }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const section = document.getElementById(sectionId);
    if (!section) return;
    const targets = vars
      .map((v) => ({ ...v, el: section.querySelector<HTMLElement>(v.sel) }))
      .filter((v): v is ScrollVar & { el: HTMLElement } => v.el !== null);
    let raf = 0;
    const frame = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const t of targets) {
        const p = clamp((vh * t.start - t.el.getBoundingClientRect().top) / (vh * t.span));
        section.style.setProperty(t.name, p.toFixed(3));
      }
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
      for (const t of targets) section.style.removeProperty(t.name);
    };
  }, [sectionId, vars]);
  return null;
}
