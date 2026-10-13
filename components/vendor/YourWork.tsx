'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { MyWork } from '@/lib/venue/myWork';
import { weddingDateWords } from '@/components/vendor/weddings/YourWeddings';

// "Your work" on Today (lib/venue/myWork.ts): the to-dos on the business's own weddings that were given to the signed-in person —
// what, by when, and for which wedding (its date and each function's day, time and place). They tick their own; nothing else can
// be changed here. Loaded venue-scoped from /api/vendor-os/my-work. With nothing given to them, or on any failure, it shows
// nothing — Today works without it.
export default function YourWork() {
  const [data, setData] = useState<MyWork | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/my-work')
      .then((r) => r.json())
      .then((b) => live && b.success && setData(b.data))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function tick(id: string, done: boolean) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/vendor-os/my-work/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done }) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) setData(b.data);
      else setError(b.error ?? 'Something went wrong. It was not saved — please try again.');
    } catch {
      setError('Could not reach Vivah OS. It was not saved — please check your connection.');
    }
    setBusy(null);
  }

  if (!data || data.items.length === 0) return null;

  return (
    <section aria-label="Your work">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Your work</h2>
        <span className="text-xs text-[var(--color-text-muted)]">{data.open === 0 ? 'All done' : `${data.open} to do`}</span>
      </div>
      <Card className="!p-0">
        <ul>
          {data.items.map((t) => (
            <li key={t.id} className="flex items-start gap-3 border-b border-[var(--color-border-subtle)] px-3 py-3 last:border-b-0">
              <button
                type="button"
                role="checkbox"
                aria-checked={t.done}
                aria-label={t.done ? `Not done: ${t.title}` : `Done: ${t.title}`}
                disabled={busy !== null}
                onClick={() => tick(t.id, !t.done)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${t.done ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--color-on-primary)]' : 'border-[var(--color-border-default)] text-transparent'} disabled:opacity-60`}
              >
                <Check className="h-5 w-5" aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-base font-medium ${t.done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)]'}`}>{t.title}</p>
                {t.dueOn && !t.done && (
                  <p className={`text-xs font-semibold ${t.overdue ? 'text-[var(--color-danger-text)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {t.overdue ? 'Was due' : 'By'} {weddingDateWords(t.dueOn)}
                  </p>
                )}
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {data.canOpenWeddings ? (
                    <Link href={`/vendor/weddings/${t.wedding.id}`} className="font-semibold underline underline-offset-2">
                      {t.wedding.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">{t.wedding.name}</span>
                  )}{' '}
                  · {weddingDateWords(t.wedding.date)}
                </p>
                {!t.done && (
                  <ul className="mt-1 space-y-0.5">
                    {t.wedding.functions.map((f, i) => (
                      <li key={i} className="text-xs text-[var(--color-text-muted)]">
                        {[f.name, weddingDateWords(f.date), f.startTime, f.place].filter(Boolean).join(' · ')}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--color-danger-text)]">{error}</p>}
    </section>
  );
}
