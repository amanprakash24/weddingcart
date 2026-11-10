'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ENQUIRY_PAGE_PLACES } from '@/lib/venue/enquiry';

// "Your enquiry page" on Enquiries (11 Nov 2026, Vivah OS phase 1). One link per place the venue puts it — each carries ?src= so an
// enquiry from it records where it came from, and nobody has to type the enquiry in. Folded by default once seen, so the list stays
// first on a phone.

export default function EnquiryPageCard() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/enquiry-page')
      .then((r) => r.json())
      .then((b) => {
        if (!live) return;
        if (b.success) setUrl(`${window.location.origin}${b.data.path}`);
        else setError(b.error ?? 'Your enquiry page could not be loaded.');
      })
      .catch(() => live && setError('Could not reach Vivah OS — please check your connection.'));
    return () => {
      live = false;
    };
  }, []);

  async function copy(src: string, link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(src);
      setTimeout(() => setCopied((c) => (c === src ? null : c)), 2000);
    } catch {
      setError('Could not copy — press and hold the link to copy it yourself.');
    }
  }

  if (error) return <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>;
  if (!url) return null;

  return (
    <Card>
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
          <Link2 className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
          <span className="flex-1">Your enquiry page — get enquiries without typing</span>
        </summary>
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-[var(--color-text-secondary)]">
            Put these links where couples find you. When someone fills in the page, the enquiry appears here by itself, with where it came from.
          </p>
          <ul className="divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
            {ENQUIRY_PAGE_PLACES.map((p) => {
              const link = `${url}?src=${p.src}`;
              return (
                <li key={p.src} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--color-text-primary)]">{p.label}</p>
                    <p className="select-all break-all text-xs text-[var(--color-text-muted)]">{link}</p>
                  </div>
                  <button type="button" onClick={() => copy(p.src, link)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--color-border-default)] px-3 font-medium text-[var(--color-text-primary)]">
                    {copied === p.src ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied === p.src ? 'Copied' : 'Copy'}
                  </button>
                </li>
              );
            })}
          </ul>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-[var(--primary)] underline underline-offset-2">
            <ExternalLink className="h-4 w-4" aria-hidden /> See your page as couples see it
          </a>
        </div>
      </details>
    </Card>
  );
}
