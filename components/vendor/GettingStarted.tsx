'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { GettingStarted as Data } from '@/lib/venue/gettingStarted';

// "Getting started" on Today — for a business that has just set up its profile: the first things to do, in order, each one tap
// away. A line ticks itself off when the thing exists (lib/venue/gettingStarted.ts); when all are done the list is not shown at
// all. Loaded venue-scoped from /api/vendor-os/getting-started. Any failure, or a login that is not a business of its own, shows
// nothing — Today works without it.
export default function GettingStarted() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/getting-started')
      .then((r) => r.json())
      .then((b) => live && b.success && setData(b.data))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!data || data.finished) return null;
  const next = data.steps.find((s) => !s.done);

  return (
    <section aria-label="Getting started">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Getting started</h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {data.doneCount} of {data.steps.length} done
        </span>
      </div>
      <Card className="!p-0">
        <ol>
          {data.steps.map((s, i) => {
            const isNext = s.key === next?.key;
            const row = (
              <div className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.done ? 'bg-[var(--color-success-bg,#DCFCE7)] text-[var(--color-success-text,#166534)]' : isNext ? 'bg-[var(--primary)] text-white' : 'border border-[var(--color-border-default)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {s.done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${s.done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)]'}`}>{s.title}</span>
                  {!s.done && <span className="block text-xs text-[var(--color-text-secondary)]">{s.why}</span>}
                </span>
                {!s.done && <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />}
              </div>
            );
            return (
              <li key={s.key} className="border-b border-[var(--color-border-subtle)] last:border-b-0">
                {s.done ? (
                  <div aria-label={`Done: ${s.title}`}>{row}</div>
                ) : (
                  <Link href={s.href} className="block">
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </section>
  );
}
