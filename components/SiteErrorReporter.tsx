'use client';

import { useEffect } from 'react';
import { reportBrowserError } from '@/lib/siteErrors/browser';
import { guardBrowserDom } from '@/lib/domGuard';

// Runs when this file loads, before React builds the page, so a translated page cannot crash it (lib/domGuard.ts).
guardBrowserDom();

// Errors in a visitor's browser that nothing else caught (a script error, an unhandled promise) go to /admin/errors.
// Errors caught by an error screen are reported there (components/ErrorScreen.tsx, app/global-error.tsx).
export default function SiteErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportBrowserError(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => reportBrowserError(event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
