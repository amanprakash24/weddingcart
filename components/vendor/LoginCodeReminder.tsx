'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, X } from 'lucide-react';
import { LOGIN_CODE_REMINDER_DAYS } from '@/lib/auth/vendorCode';

// The monthly reminder (6 Oct 2026): once a login code is 30 days old, every Vendor OS screen carries one quiet line asking the
// vendor to change it. A reminder only — nothing is blocked — and it can be put away until the browser is closed.
const HIDDEN_KEY = 'vivah-os:login-code-reminder-hidden';

export default function LoginCodeReminder() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let live = true;
    try {
      if (window.sessionStorage.getItem(HIDDEN_KEY)) return;
    } catch {
      // No session storage (private window): the line simply shows again on the next screen.
    }
    fetch('/api/vendor-os/login-code')
      .then((r) => r.json())
      .then((b) => live && setShow(Boolean(b.success && b.data?.reminder)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!show) return null;

  const hide = () => {
    setShow(false);
    try {
      window.sessionStorage.setItem(HIDDEN_KEY, '1');
    } catch {
      // see above
    }
  };

  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 print:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 text-sm text-amber-900 md:px-6">
        <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
        <p className="flex-1">
          Your login code is more than {LOGIN_CODE_REMINDER_DAYS} days old.{' '}
          <Link href="/vendor/settings#login-code" className="font-semibold underline underline-offset-2">
            Change it now
          </Link>
        </p>
        <button type="button" onClick={hide} aria-label="Hide this reminder" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-amber-800">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
