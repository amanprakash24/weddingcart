'use client';

import { useEffect } from 'react';
import { reportBrowserError } from '@/lib/siteErrors/browser';

// The last resort: the site's own frame (app/layout.tsx) failed, so nothing of it — styles, fonts, header — can be relied on.
// It must bring its own <html> and <body>, and is styled inline for the same reason.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(`[screen-error] root${error.digest ? ` ref ${error.digest}` : ''}:`, error);
    reportBrowserError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFAF5', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
        <div role="alert" style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, color: '#111827', margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#4B5563', lineHeight: 1.6 }}>This page could not be shown just now. Please try again.</p>
          <button type="button" onClick={() => unstable_retry()} style={{ minHeight: 48, padding: '0 24px', borderRadius: 999, border: 0, background: '#8B1A4A', color: '#fff', fontSize: 16, fontWeight: 600 }}>
            Try again
          </button>
          {error.digest && <p style={{ color: '#9CA3AF', fontSize: 12 }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
