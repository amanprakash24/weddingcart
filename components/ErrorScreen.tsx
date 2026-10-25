'use client';

import { useEffect } from 'react';
import { reportBrowserError } from '@/lib/siteErrors/browser';
import { RefreshCw } from 'lucide-react';

// What a person sees when a screen fails, instead of a bare error page: what happened in plain words, "Try again", and who to
// contact. Used by the error.tsx files (app/error.tsx, app/vendor/error.tsx, app/proposal/[token]/error.tsx).
//
// The reference is the framework's own error id (`digest`): it is in the server log beside the real error, so someone who is told
// "reference 1234" can find what went wrong. The error's message is never shown — on the server it could carry details that are
// not for the person looking at the screen.
export interface ErrorScreenProps {
  error: Error & { digest?: string };
  retry: () => void;
  // Where this happened, for the log line ("vendor-os", "proposal" …).
  where: string;
  title?: string;
  // Who to contact: a ready link (Shaadi Shopping's number), or plain words when the number is not known here.
  contact: { href: string; label: string } | { words: string };
  compact?: boolean; // inside a shell that already has its own page frame
}

export default function ErrorScreen({ error, retry, where, title = 'Something went wrong', contact, compact = false }: ErrorScreenProps) {
  useEffect(() => {
    // The one line a person looking at the browser gets to see; the error also goes to /admin/errors.
    console.error(`[screen-error] ${where}${error.digest ? ` ref ${error.digest}` : ''}:`, error);
    reportBrowserError(error);
  }, [error, where]);

  return (
    <div role="alert" className={`flex items-center justify-center bg-[#FFFAF5] px-4 ${compact ? 'min-h-[60vh] py-10' : 'min-h-screen'}`}>
      <div className="w-full max-w-md text-center">
        <h1 className="font-playfair text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-3 leading-relaxed text-gray-600">This screen could not be shown just now. Nothing you had already saved is lost. Please try again.</p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#8B1A4A] px-6 text-base font-semibold text-white hover:opacity-90 sm:w-auto"
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Try again
        </button>
        <p className="mt-6 text-sm leading-relaxed text-gray-600">
          If it keeps happening,{' '}
          {'href' in contact ? (
            <a href={contact.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-[#8B1A4A] underline underline-offset-2">
              {contact.label}
            </a>
          ) : (
            contact.words
          )}
        </p>
        {error.digest && <p className="mt-2 text-xs text-gray-400">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
