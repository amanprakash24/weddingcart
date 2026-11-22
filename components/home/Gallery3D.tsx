'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { categoryHref } from '@/lib/home/categoryTiles';
import s from './home3d.module.css';

// "Our services": as the visitor scrolls, the camera walks down an arcade of gold arches, one per service we arrange,
// left and right, each fading in from the dark and out as it passes. Each arch opens that service's page. Moving the
// mouse tilts the view a little. Same services, order and photos as the service row under the hero (ServicePills),
// except Decor and Band & DJ, which use the founder's own photos. The 3D arcade is hidden from screen readers; they get
// the same links as a plain list.
const SERVICES: { name: string; text: string; href: string; photo: string; pos?: string }[] = [
  { name: 'Venues', text: 'Banquet halls, lawns and hotels across Patna', href: categoryHref('venue'), photo: '/cat-venue-guides.jpg' },
  { name: 'Catering', text: 'Menus for every function, priced per plate', href: categoryHref('catering'), photo: '/images/pill-catering.jpg' },
  { name: 'Decor', text: 'Mandap, stage and flowers for every function', href: categoryHref('decorator'), photo: '/images/home3d/haldi-mandap.jpg', pos: '50% 62%' },
  { name: 'Photo & Video', text: 'Photographers and films for every function', href: categoryHref('photo-video'), photo: '/cat-photography.jpg' },
  { name: 'Bridal Makeup', text: 'Bridal and family makeup artists', href: categoryHref('makeup'), photo: '/cat-bridal-fashion.jpg', pos: '70% 30%' },
  { name: 'Mehndi', text: 'Mehndi artists for the bride and family', href: categoryHref('mehndi'), photo: '/images/pill-mehndi.jpg' },
  { name: 'Band & DJ', text: 'Baraat bands, DJs and the sangeet stage', href: categoryHref('band'), photo: '/images/home3d/led-stage.jpg' },
  { name: 'Pandits', text: 'Pandits for every ritual', href: '/categories/planning', photo: '/cat-wedding-tips.jpg' },
  { name: 'Invitations', text: 'Wedding cards and e-invites', href: '/categories/invitations', photo: '/images/pill-invitations.jpg' },
];

const GAP = 760;
const DEPTH = GAP * (SERVICES.length - 1) + 600;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => t * t * (3 - 2 * t);

export default function Gallery3D() {
  const section = useRef<HTMLElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const floor = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const frames = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let mx = 0;
    let my = 0;
    let raf = 0;
    let visible = false;

    const layout = () => {
      const narrow = window.innerWidth < 860;
      const side = narrow ? 150 : 330;
      frames.current.forEach((el, i) => {
        if (!el) return;
        const left = i % 2 === 0;
        el.style.transform = `translate3d(${left ? -side : side}px, 0, ${-i * GAP - 300}px) rotateY(${left ? 22 : -22}deg)`;
      });
      if (floor.current) floor.current.style.transform = `translate3d(0, ${narrow ? 210 : 270}px, 0) rotateX(90deg)`;
    };

    const frame = () => {
      raf = 0;
      const sec = section.current;
      if (!sec || !world.current) return;
      const r = sec.getBoundingClientRect();
      const g = clamp(-r.top / (r.height - window.innerHeight), 0, 1);
      const camZ = ease(g) * DEPTH;
      world.current.style.transform = `translate3d(${-mx * 40}px, ${-my * 24}px, ${camZ}px) rotateY(${mx * 4}deg)`;
      frames.current.forEach((el, i) => {
        if (!el) return;
        const z = -i * GAP - 300 + camZ; // positive = already passed the camera
        // Fade out before an arch gets close enough to grow into the heading band.
        const op = z > 120 ? 0 : z > -180 ? 1 - (z + 180) / 300 : z < -2600 ? 0 : z < -1700 ? 1 - (-1700 - z) / 900 : 1;
        el.style.opacity = String(op);
        el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
      });
      if (bar.current) bar.current.style.width = `${g * 100}%`;
      if (hint.current) hint.current.style.opacity = g < 0.04 ? '1' : '0';
      if (end.current) end.current.dataset.on = g > 0.9 ? '1' : '0';
    };
    const schedule = () => {
      if (visible && !raf) raf = requestAnimationFrame(frame);
    };
    const onPointer = (e: PointerEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      schedule();
    };
    const onResize = () => {
      layout();
      schedule();
    };

    // Only work while the section is on screen.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    if (section.current) io.observe(section.current);
    layout();
    frame();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);

  return (
    <section ref={section} className={s.gallery} aria-labelledby="our-services">
      <div className={s.gStage}>
        <div className={s.gCopy}>
          <p className={s.kicker}>Our services</p>
          <h2 id="our-services">
            Everything for your wedding, <em>arranged by us</em>
          </h2>
        </div>
        <nav aria-labelledby="our-services" className="sr-only">
          <ul>
            {SERVICES.map((sv) => (
              <li key={sv.name}>
                <Link href={sv.href}>{sv.name}: {sv.text}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div ref={world} className={s.world} aria-hidden>
          <div ref={floor} className={s.floor} />
          {SERVICES.map((sv, i) => (
            <Link
              key={sv.name}
              href={sv.href}
              tabIndex={-1}
              ref={(el) => {
                frames.current[i] = el;
              }}
              className={s.frame}
              style={{ opacity: i < 3 ? 1 : 0 }}
            >
              <div className={s.arch}>
                <Image src={sv.photo} alt="" fill sizes="(max-width: 859px) 270px, 360px" className="object-cover" style={sv.pos ? { objectPosition: sv.pos } : undefined} />
                <div className={s.shade} />
                <p className={s.text}>{sv.text}</p>
              </div>
              <span className={s.cap}>{sv.name}</span>
            </Link>
          ))}
        </div>
        <p ref={hint} className={s.hint} aria-hidden>
          Scroll to walk through
        </p>
        <div ref={end} className={s.end} data-on="0">
          <Link href="/plan" className={s.endBtn}>
            Get a free Wedding Expert
          </Link>
        </div>
        <div className={s.progress} aria-hidden>
          <i ref={bar} />
        </div>
      </div>
    </section>
  );
}
