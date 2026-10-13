'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import Textarea from '@/components/ui/Textarea';
import { NOTE_MAX, noteWhen, type MyWork } from '@/lib/venue/myWork';
import { weddingDateWords } from '@/components/vendor/weddings/YourWeddings';

// "Your work" on Today (lib/venue/myWork.ts): the to-dos on the business's own weddings that were given to the signed-in person —
// what, by when, and for which wedding (its date and each function's day, time and place). They tick their own and may write a
// note about it, which whoever manages the wedding reads on the wedding's page; nothing else can be changed here. Loaded venue-scoped from /api/vendor-os/my-work. With nothing given to them, or on any failure, it shows
// nothing — Today works without it.
export default function YourWork() {
  const [data, setData] = useState<MyWork | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The to-do a note is being written on, and the words so far.
  const [noting, setNoting] = useState<string | null>(null);
  const [note, setNote] = useState('');

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

  async function saveNote(id: string) {
    if (busy || !note.trim()) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/vendor-os/my-work/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        setData(b.data);
        setNoting(null);
        setNote('');
      } else setError(b.error ?? 'Something went wrong. The note was not saved — please try again.');
    } catch {
      setError('Could not reach Vivah OS. The note was not saved — please check your connection.');
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
                {t.notes.length > 0 && (
                  <ul aria-label={`Your notes on: ${t.title}`} className="mt-2 space-y-1 border-l-2 border-[var(--color-border-default)] pl-2">
                    {t.notes.map((n) => (
                      <li key={n.id} className="text-sm text-[var(--color-text-secondary)]">
                        <span className="whitespace-pre-line break-words">{n.text}</span> <span className="text-xs text-[var(--color-text-muted)]">· {noteWhen(n.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {noting === t.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea label="Your note" value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={NOTE_MAX} rows={2} placeholder="Done — needs 40 litres more on the day" className="text-base" />
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" disabled={busy !== null || !note.trim()} onClick={() => saveNote(t.id)} className="min-h-11 rounded-lg bg-[var(--primary)] px-3 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-50">
                        {busy === t.id ? 'Saving…' : 'Save the note'}
                      </button>
                      <button type="button" disabled={busy !== null} onClick={() => setNoting(null)} className="min-h-11 rounded-lg border border-[var(--color-border-default)] px-3 text-sm font-semibold text-[var(--color-text-primary)] disabled:opacity-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" disabled={busy !== null} onClick={() => (setNoting(t.id), setNote(''), setError(null))} className="mt-1 flex min-h-11 items-center text-sm font-semibold text-[var(--primary)] underline underline-offset-2 disabled:opacity-50">
                    Add a note
                  </button>
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
