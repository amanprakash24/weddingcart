'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { isProposalPath } from '@/lib/proposalPath';

// Google Analytics for the public site. Never loaded on a proposal page: its URL carries the couple's secret link, and
// gtag would report it as the page address.
export default function GoogleAnalytics({ id }: { id: string }) {
  const pathname = usePathname();
  if (isProposalPath(pathname)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}
