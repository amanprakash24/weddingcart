'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { SHAADI_PHONE } from '@/lib/shaadiContact';

// Phone only: after the first screen, a bar with the two main actions (same as the old homepage's bar).
export default function HomeStickyBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 border-t border-[var(--soft-sand)] bg-white/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-md sm:hidden">
      <Link href="/plan" className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[var(--maroon)] text-sm font-semibold text-white">
        Begin your journey
      </Link>
      <a href={`tel:${SHAADI_PHONE}`} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-[var(--soft-sand)] px-4 text-sm font-semibold text-[var(--deep-dark)]">
        <Phone className="h-4 w-4" aria-hidden /> Call
      </a>
    </div>
  );
}
