'use client';

import { useEffect } from 'react';

// The homepage in 3D, without changing what any section does. Mounted once on the homepage, it adds three effects:
//  1. Each <section data-depth> swings up as it scrolls into view, hinged on its own top edge like a lid, and settles
//     flat. It never moves outside its own box, so it cannot overlap the sections around it (no transform at all once in place, so text stays sharp and nothing fixed inside is affected).
//  2. Any element with data-tilt leans towards the mouse pointer (mouse and trackpad only; touch screens skip it).
//  3. The hero picture ([data-hero-3d]) turns gently with the pointer, so its layers (each with its own translateZ)
//     separate in depth.
// Nothing happens for visitors who ask for reduced motion.
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => 1 - (1 - t) ** 3;

export default function Home3D() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sections = [...document.querySelectorAll<HTMLElement>('section[data-depth]')];
    sections.forEach((el) => {
      el.style.transformOrigin = '50% 0';
    });

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const heroEl = document.querySelector<HTMLElement>('[data-hero-3d]');
    let raf = 0;
    const depth = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of sections) {
        const top = el.getBoundingClientRect().top;
        if (top > vh * 1.2) {
          el.style.transform = 'perspective(1100px) rotateX(-42deg)';
          el.style.opacity = '0.15';
          continue;
        }
        const e = ease(clamp((vh - top) / (vh * 0.85), 0, 1));
        if (e >= 0.999) {
          el.style.transform = '';
          el.style.opacity = '';
          continue;
        }
        el.style.transform = `perspective(1100px) rotateX(${(1 - e) * -42}deg)`;
        el.style.opacity = String(0.15 + 0.85 * e);
      }
      // The bottom tips away (negative rotateX), so the section only ever looks smaller than its box, never larger.
      // Touch screens have no pointer: the hero turns as the visitor starts to scroll instead.
      if (heroEl && !finePointer) {
        const t = clamp(window.scrollY / vh, 0, 1);
        heroEl.style.transform = `perspective(1000px) rotateY(${-8 + t * 16}deg) rotateX(${t * -8}deg)`;
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(depth);
    };
    depth();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    // Pointer effects: only for a real mouse or trackpad.
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let tilted: HTMLElement | null = null;
    const hero = document.querySelector<HTMLElement>('[data-hero-3d]');
    const untilt = (el: HTMLElement) => {
      el.style.transform = '';
    };
    const onMove = (ev: PointerEvent) => {
      const card = (ev.target as Element | null)?.closest<HTMLElement>('[data-tilt]') ?? null;
      if (tilted && tilted !== card) untilt(tilted);
      tilted = card;
      if (card) {
        const r = card.getBoundingClientRect();
        const x = (ev.clientX - r.left) / r.width - 0.5;
        const y = (ev.clientY - r.top) / r.height - 0.5;
        card.style.transition = 'transform 120ms ease-out';
        card.style.transform = `perspective(800px) rotateX(${-y * 16}deg) rotateY(${x * 20}deg) translateZ(30px)`;
      }
      if (hero) {
        const mx = ev.clientX / window.innerWidth - 0.5;
        const my = ev.clientY / window.innerHeight - 0.5;
        hero.style.transform = `perspective(1000px) rotateY(${mx * 12}deg) rotateX(${-my * 8}deg)`;
      }
    };
    const onLeave = () => {
      if (tilted) untilt(tilted);
      tilted = null;
    };
    if (fine) {
      document.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      sections.forEach((el) => {
        el.style.transform = '';
        el.style.opacity = '';
      });
    };
  }, []);

  return null;
}
