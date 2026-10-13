'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Camera, Check, Copy, KeyRound, MessageCircle, Pencil, Trash2, UserPlus } from 'lucide-react';
import Avatar from './Avatar';
import { TEAM_ROLE_HELP, TEAM_ROLE_LABELS, TEAM_ROLES, teamLoginMessage, type OurTeamErrors, type OurTeamMember, type TeamRole } from '@/lib/admin/ourTeam';

// "Our team" (13 Oct 2026): the founder first — their own name and sign-in — then the people who work at Shaadi Shopping: add
// someone (name, mobile number, role), name them, give a new code or a corrected number, change their role, take them out.
// The server decides everything (services/adminTeam.service.ts); a founder's own number and code are changed in My sign-in.

const field = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100';
const label = 'mb-1.5 block text-xs font-semibold text-gray-600';
const card = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm';
const dark = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-gray-900 px-5 text-sm font-semibold text-white disabled:opacity-50';
const light = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700 disabled:opacity-50';
const digits = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);
const shown = (mobile: string | null) => (mobile ? `${mobile.slice(0, 5)} ${mobile.slice(5)}` : null);

type Issued = { name: string; mobile: string; code: string };
type Editing = { id: string; what: 'name' | 'code' | 'remove' | 'role' } | null;

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const b = await res.json().catch(() => ({}));
  return { ok: res.ok && b.success === true, b };
}

export default function OurTeam() {
  const [team, setTeam] = useState<OurTeamMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [value, setValue] = useState('');
  const [rowError, setRowError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<{ name: string; mobile: string; role: TeamRole }>({ name: '', mobile: '', role: 'SALES' });
  const [formErrors, setFormErrors] = useState<OurTeamErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    call('/api/admin/team', 'GET')
      .then(({ ok, b }) => live && (ok ? setTeam(b.data) : setLoadError(b.error ?? 'Could not load the team.')))
      .catch(() => live && setLoadError('Could not reach the server. Please try again.'));
    return () => {
      live = false;
    };
  }, []);

  const open = (id: string, what: NonNullable<Editing>['what'], start = '') => {
    setEditing({ id, what });
    setValue(start);
    setRowError(null);
  };
  const close = () => {
    setEditing(null);
    setValue('');
    setRowError(null);
  };
  const replace = (m: OurTeamMember) => setTeam((t) => (t ? t.map((x) => (x.id === m.id ? m : x)) : t));
  const showCode = (m: OurTeamMember, code: string) => {
    setIssued({ name: m.name ?? 'there', mobile: m.mobile ?? '', code });
    setCopied(false);
  };

  // One row action at a time; the server's answer is the row as it now is.
  async function act(run: () => Promise<{ ok: boolean; b: Record<string, unknown> }>, done: (b: Record<string, unknown>) => void) {
    if (busy) return;
    setBusy(true);
    setRowError(null);
    try {
      const { ok, b } = await run();
      if (ok) {
        done(b);
        close();
      } else {
        const fe = (b.fieldErrors ?? {}) as OurTeamErrors;
        setRowError(fe.name ?? fe.mobile ?? fe.role ?? (b.error as string) ?? 'That did not work. Please try again.');
      }
    } catch {
      setRowError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  }

  async function add() {
    if (busy) return;
    setBusy(true);
    setFormErrors({});
    setFormError(null);
    try {
      const { ok, b } = await call('/api/admin/team', 'POST', form);
      if (ok) {
        setTeam((t) => (t ? [...t, b.data] : t));
        showCode(b.data, b.loginCode);
        setForm({ name: '', mobile: '', role: 'SALES' });
      } else {
        setFormErrors(b.fieldErrors ?? {});
        if (!b.fieldErrors) setFormError(b.error ?? 'That did not work. Please try again.');
      }
    } catch {
      setFormError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  }

  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (loadError) return <p role="alert" className="text-sm text-red-600">{loadError}</p>;
  if (!team) return <p className="text-sm text-gray-500">Loading…</p>;

  const you = team.find((m) => m.isYou);
  const others = team.filter((m) => !m.isYou);
  const site = typeof window === 'undefined' ? '' : window.location.origin;

  const nameEditor = (m: OurTeamMember) => (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void act(() => call(`/api/admin/team/${m.id}`, 'PUT', { name: value }), (b) => replace(b.data as OurTeamMember));
      }}
    >
      <div className="min-w-0 flex-1 basis-56">
        <label htmlFor={`name-${m.id}`} className={label}>{m.isYou ? 'Your name' : 'Their name'}</label>
        <input id={`name-${m.id}`} autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} className={field} />
      </div>
      <button type="submit" disabled={busy || value.trim().length < 2} className={dark}>{busy ? 'Saving…' : 'Save'}</button>
      <button type="button" onClick={close} className={light}>Cancel</button>
    </form>
  );

  return (
    <div className="max-w-2xl space-y-5">
      {issued && (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 text-sm text-gray-700" role="status">
          <p className="flex items-center gap-1.5 font-semibold text-gray-900"><KeyRound className="h-4 w-4" aria-hidden /> Login code for {issued.name}</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="select-all rounded-lg bg-white px-3 py-1.5 font-mono text-xl font-bold tracking-[0.3em] text-gray-900 ring-1 ring-amber-200">{issued.code}</span>
            <button type="button" onClick={copy} className={light}>{copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />} {copied ? 'Copied' : 'Copy code'}</button>
            <a href={`https://wa.me/91${issued.mobile}?text=${encodeURIComponent(teamLoginMessage({ personName: issued.name, mobile: issued.mobile, code: issued.code, site }))}`} target="_blank" rel="noopener noreferrer" className={light}>
              <MessageCircle className="h-3 w-3" aria-hidden /> Send on WhatsApp
            </a>
          </div>
          <p>They sign in at <span className="font-medium">/admin/login</span> with mobile <span className="font-medium">{shown(issued.mobile)}</span> and this code.</p>
          <p className="font-medium text-amber-800">Shown only now. It cannot be shown again, only replaced.</p>
          <button type="button" onClick={() => setIssued(null)} className={dark}>I have noted it</button>
        </div>
      )}

      {you && (
        <section className={card} aria-labelledby="you-heading">
          <h2 id="you-heading" className="text-xs font-bold uppercase tracking-wide text-gray-500">You · {TEAM_ROLE_LABELS[you.role]}</h2>
          <div className="mt-2 flex items-center gap-3">
            <Avatar name={you.name} photoUrl={you.photoUrl} size={56} />
            <div className="min-w-0">
              <p className="break-words text-lg font-bold text-gray-900">{you.name ?? 'No name yet'}</p>
              {you.designation && <p className="text-sm text-gray-600">{you.designation}</p>}
            </div>
          </div>
          <dl className="mt-2 space-y-1 text-sm text-gray-700">
            <div className="flex gap-2"><dt className="w-28 shrink-0 text-gray-500">Mobile number</dt><dd className="font-medium">{shown(you.mobile) ?? 'Not registered yet'}</dd></div>
            {you.email && <div className="flex gap-2"><dt className="w-28 shrink-0 text-gray-500">Email</dt><dd className="break-all font-medium">{you.email}</dd></div>}
            <div className="flex gap-2"><dt className="w-28 shrink-0 text-gray-500">Signs in with</dt><dd className="font-medium">{[you.hasCode && 'mobile number + 6-digit code', you.hasPassword && 'email + password'].filter(Boolean).join(', or ') || 'nothing yet'}</dd></div>
          </dl>
          {editing?.id === you.id && editing.what === 'name' ? (
            nameEditor(you)
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => open(you.id, 'name', you.name ?? '')} className={light}><Pencil className="h-3 w-3" aria-hidden /> {you.name ? 'Change your name' : 'Add your name'}</button>
              <Link href="/admin/profile" className={light}><Camera className="h-3 w-3" aria-hidden /> Your photo and designation</Link>
              <Link href="/admin/account" className={light}><KeyRound className="h-3 w-3" aria-hidden /> Change your mobile number or code</Link>
            </div>
          )}
          {editing?.id === you.id && rowError && <p role="alert" className="mt-2 text-sm text-red-600">{rowError}</p>}
        </section>
      )}

      <section className={card} aria-labelledby="team-heading">
        <h2 id="team-heading" className="text-sm font-bold text-gray-900">People in the team</h2>
        {others.length === 0 && <p className="mt-2 text-sm text-gray-600">Nobody else yet. Add the first person below.</p>}
        <ul className="mt-1 divide-y divide-gray-100">
          {others.map((m) => (
            <li key={m.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={m.name} photoUrl={m.photoUrl} size={40} />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-gray-900">{m.name ?? 'No name yet'}</p>
                    {m.designation && <p className="text-xs text-gray-600">{m.designation}</p>}
                  </div>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{TEAM_ROLE_LABELS[m.role]}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{shown(m.mobile) ?? 'No mobile number yet'}{m.email ? ` · ${m.email}` : ''}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {m.hasCode ? 'Signs in with mobile number + code' : m.hasPassword ? 'Signs in with email + password only — no code yet' : 'Cannot sign in yet — give a code'}
              </p>

              {editing?.id === m.id && editing.what === 'name' && nameEditor(m)}

              {editing?.id === m.id && editing.what === 'code' && (
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(() => call(`/api/admin/team/${m.id}/login-code`, 'POST', { mobile: value }), (b) => {
                      replace(b.data as OurTeamMember);
                      showCode(b.data as OurTeamMember, b.loginCode as string);
                    });
                  }}
                >
                  <div>
                    <label htmlFor={`mobile-${m.id}`} className={label}>Their mobile number (correct it here if it is wrong)</label>
                    <input id={`mobile-${m.id}`} type="tel" inputMode="numeric" autoFocus value={value} onChange={(e) => setValue(digits(e.target.value, 10))} placeholder="10-digit mobile number" className={field} />
                  </div>
                  <p className="text-xs text-gray-600">{m.hasCode ? 'Their old code stops working and they are signed out everywhere.' : 'They get their first 6-digit code.'}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={busy || value.length !== 10} className={dark}>{busy ? 'Working…' : 'Give a new code'}</button>
                    <button type="button" onClick={close} className={light}>Cancel</button>
                  </div>
                </form>
              )}

              {editing?.id === m.id && editing.what === 'remove' && (
                <div className="mt-3 space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <p>Take {m.name ?? 'this person'} out of the team? They are signed out at once and can no longer open the Command Center.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => void act(() => call(`/api/admin/team/${m.id}`, 'DELETE'), () => setTeam((t) => (t ? t.filter((x) => x.id !== m.id) : t)))} className="inline-flex min-h-11 items-center rounded-full bg-red-700 px-5 text-sm font-semibold text-white disabled:opacity-50">
                      {busy ? 'Removing…' : 'Yes, remove'}
                    </button>
                    <button type="button" onClick={close} className={light}>Keep</button>
                  </div>
                </div>
              )}

              {editing?.id === m.id && rowError && <p role="alert" className="mt-2 text-sm text-red-600">{rowError}</p>}

              {(editing?.id !== m.id || editing.what === 'role') && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => open(m.id, 'name', m.name ?? '')} className={light}><Pencil className="h-3 w-3" aria-hidden /> {m.name ? 'Change name' : 'Add name'}</button>
                  {m.canManage && (
                    <>
                      <button type="button" onClick={() => open(m.id, 'code', m.mobile ?? '')} className={light}><KeyRound className="h-3 w-3" aria-hidden /> {m.mobile ? 'New code / change mobile' : 'Add mobile and give a code'}</button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditing({ id: m.id, what: 'role' });
                          void act(() => call(`/api/admin/team/${m.id}`, 'PUT', { role: m.role === 'SALES' ? 'OPERATIONS' : 'SALES' }), (b) => replace(b.data as OurTeamMember));
                        }}
                        className={light}
                      >
                        Make {m.role === 'SALES' ? TEAM_ROLE_LABELS.OPERATIONS : TEAM_ROLE_LABELS.SALES}
                      </button>
                      <button type="button" onClick={() => open(m.id, 'remove')} className={`${light} border-red-200 text-red-700`}><Trash2 className="h-3 w-3" aria-hidden /> Remove</button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={card} aria-labelledby="add-heading">
        <h2 id="add-heading" className="flex items-center gap-2 text-sm font-bold text-gray-900"><UserPlus className="h-4 w-4" aria-hidden /> Add a person</h2>
        <p className="mt-1 text-sm text-gray-600">They sign in with their own mobile number and a 6-digit code, which you get once and pass on.</p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div>
            <label htmlFor="new-name" className={label}>Name</label>
            <input id="new-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} autoComplete="off" className={field} aria-invalid={Boolean(formErrors.name)} />
            {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
          </div>
          <div>
            <label htmlFor="new-mobile" className={label}>Mobile number</label>
            <input id="new-mobile" type="tel" inputMode="numeric" autoComplete="off" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: digits(e.target.value, 10) })} placeholder="10-digit mobile number" className={field} aria-invalid={Boolean(formErrors.mobile)} />
            {formErrors.mobile && <p className="mt-1 text-xs text-red-600">{formErrors.mobile}</p>}
          </div>
          <fieldset>
            <legend className={label}>Role</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEAM_ROLES.map((r) => (
                <label key={r} className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border px-3.5 py-3 text-sm ${form.role === r ? 'border-amber-400 bg-amber-50/60' : 'border-gray-200 bg-gray-50'}`}>
                  <input type="radio" name="new-role" checked={form.role === r} onChange={() => setForm({ ...form, role: r })} className="mt-1" />
                  <span><span className="block font-semibold text-gray-900">{TEAM_ROLE_LABELS[r]}</span><span className="block text-xs text-gray-600">{TEAM_ROLE_HELP[r]}</span></span>
                </label>
              ))}
            </div>
            {formErrors.role && <p className="mt-1 text-xs text-red-600">{formErrors.role}</p>}
            <p className="mt-2 text-xs text-gray-500">Both open the same Command Center screens today. Neither can see this page or issue login codes.</p>
          </fieldset>
          <button type="submit" disabled={busy || form.name.trim().length < 2 || form.mobile.length !== 10} className={dark}>{busy ? 'Adding…' : 'Add and get their code'}</button>
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
        </form>
      </section>
    </div>
  );
}
