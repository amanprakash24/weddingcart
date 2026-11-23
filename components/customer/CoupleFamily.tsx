'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { FAMILY_ROLES, FAMILY_ROLE_WORDS, type FamilyRole } from '@/lib/customer/familyAccess';
import type { FamilyMemberView } from '@/services/family.service';

// My Wedding → Family (23 Nov 2026). The couple adds family members and chooses what each can do. A new sign-in's code is shown here
// ONCE, with a WhatsApp message ready to send; a number that already has its own sign-in just gets access (they keep their code).

const field = 'min-h-11 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 text-base';
const whatsappTo = (mobile: string, text: string) => `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;

export default function CoupleFamily({ weddingId, coupleNames }: { weddingId: string; coupleNames: string }) {
  const base = `/api/customer/weddings/${weddingId}/family`;
  const [members, setMembers] = useState<FamilyMemberView[] | null>(null);
  const [form, setForm] = useState<{ name: string; mobile: string; relation: string; role: FamilyRole } | null>(null);
  const [given, setGiven] = useState<{ name: string; mobile: string; code: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) setMembers(json.data);
      else setError(json?.error || 'Could not load your family list');
    } catch {
      setError('Could not load your family list');
    }
  }, [base]);
  // Deferred like the other panels (react-hooks/set-state-in-effect).
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const call = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save. Please try again.');
    return json.data;
  };
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const add = () =>
    run(async () => {
      if (!form) return;
      const data = await call(base, 'POST', { name: form.name, mobile: form.mobile, relation: form.relation || null, role: form.role });
      setGiven({ name: data.member.name, mobile: data.mobile, code: data.code });
      setForm(null);
      await load();
    });

  const message = given
    ? given.code
      ? `Namaste ${given.name} ji! ${coupleNames} have added you to our wedding on My Wedding (Shaadi Shopping).\n\nOpen ${typeof window !== 'undefined' ? window.location.origin : ''}/customer/login\nMobile: ${given.mobile}\nLogin code: ${given.code}\n\nAfter signing in, please choose your own code.`
      : `Namaste ${given.name} ji! ${coupleNames} have added you to our wedding on My Wedding (Shaadi Shopping). Sign in at ${typeof window !== 'undefined' ? window.location.origin : ''}/customer/login with your mobile and your own code.`
    : '';

  return (
    <section id="family" aria-labelledby="c-family" className="os-glass scroll-mt-4 rounded-[22px] border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="c-family" className="text-[17px] font-bold">Family</h2>
        {!form && (
          <button type="button" onClick={() => { setGiven(null); setError(null); setForm({ name: '', mobile: '', relation: '', role: 'PLANNING' }); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-sm font-bold text-white">
            <UserPlus className="h-4 w-4" aria-hidden />Add family
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Family members sign in to My Wedding with their own mobile and code. Only you can add or remove them.</p>

      {given && (
        <div role="status" className="mt-3 space-y-2 rounded-2xl border border-[#FCD34D]/70 bg-[#FEF3C7]/85 p-4 text-sm text-[#78350F]">
          {given.code ? (
            <>
              <p><b>{given.name}</b> can now sign in with mobile <b>{given.mobile}</b> and code <b className="font-mono tracking-widest">{given.code}</b>.</p>
              <p className="text-xs">The code is shown only now. Send it on WhatsApp — they will be asked to choose their own.</p>
            </>
          ) : (
            <p><b>{given.name}</b> already has a sign-in for {given.mobile} — they now see your wedding with their own code.</p>
          )}
          <a href={whatsappTo(given.mobile, message)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-[#1F7A4D] px-4 text-sm font-bold text-white">Send on WhatsApp</a>
        </div>
      )}

      {form && (
        <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border border-white/70 bg-white/60 p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Name
            <input aria-label="Family member name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Mobile
            <input aria-label="Family member mobile" inputMode="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="10-digit mobile" className={field} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Relation <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
            <input aria-label="Relation" value={form.relation} maxLength={60} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="e.g. Bride's sister" className={field} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">What can they do?
            <select aria-label="What can they do" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as FamilyRole })} className={field}>
              {FAMILY_ROLES.map((r) => <option key={r} value={r}>{FAMILY_ROLE_WORDS[r].label}</option>)}
            </select>
            <span className="text-xs text-[var(--color-text-muted)]">{FAMILY_ROLE_WORDS[form.role].explains}</span>
          </label>
          {error && <p role="alert" className="text-sm text-[#B42318] sm:col-span-2">{error}</p>}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={busy || !form.name.trim() || !form.mobile.trim()} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Adding…' : 'Add'}</button>
            <button type="button" disabled={busy} onClick={() => setForm(null)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[var(--color-text-secondary)]">Cancel</button>
          </div>
        </form>
      )}

      {members === null ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : members.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">No family added yet. Add parents, siblings or anyone helping you plan.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/70 rounded-2xl border border-white/70 bg-white/55">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{m.name}{m.relation && <span className="font-normal text-[var(--color-text-muted)]"> · {m.relation}</span>}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{m.mobile ? `+91 ${m.mobile}` : ''}{m.signedInBefore ? ' · has signed in' : ' · not signed in yet'}</p>
              </div>
              <div className="flex items-center gap-1">
                <select aria-label={`What ${m.name} can do`} value={m.role} disabled={busy} onChange={(e) => void run(async () => { await call(`${base}/${m.id}`, 'PATCH', { role: e.target.value }); await load(); })} className="min-h-11 rounded-xl border border-[var(--color-border-default)] bg-white px-2 text-sm">
                  {FAMILY_ROLES.map((r) => <option key={r} value={r}>{FAMILY_ROLE_WORDS[r].label}</option>)}
                </select>
                <button type="button" aria-label={`Remove ${m.name}`} disabled={busy} onClick={() => setRemoving(m.id)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#B42318]"><Trash2 className="h-4 w-4" aria-hidden /></button>
              </div>
              {removing === m.id && (
                <div role="alert" className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm text-[#7F1D1D]">
                  Remove {m.name}? They will no longer see your wedding.
                  <button type="button" disabled={busy} onClick={() => void run(async () => { await call(`${base}/${m.id}`, 'DELETE'); setRemoving(null); await load(); })} className="min-h-11 rounded-xl bg-[#B4232A] px-3 font-bold text-white">Yes, remove</button>
                  <button type="button" disabled={busy} onClick={() => setRemoving(null)} className="min-h-11 rounded-xl px-3 font-semibold">No</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && !form && <p role="alert" className="mt-2 text-sm text-[#B42318]">{error}</p>}
    </section>
  );
}
