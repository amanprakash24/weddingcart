'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { trackEvent } from '@/lib/analytics/events';

// A link on the (server-rendered) Vivah OS page that records one `vivah_os_cta_click` when it is pressed — the same event the
// homepage section sends, with `location: 'vivah-os-page'`, so interest from both places is counted together.
export default function TrackedLink({ href, audience, cta, className, children }: { href: string; audience: 'couples' | 'business'; cta: string; className: string; children: ReactNode }) {
  const onClick = () => trackEvent('vivah_os_cta_click', { location: 'vivah-os-page', audience, cta });
  if (href.startsWith('#')) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
