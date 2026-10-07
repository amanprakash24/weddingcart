'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import { Building2, ChevronRight, Loader2, LogOut, ShieldCheck } from 'lucide-react';

// "Choose Workspace" (7 Oct 2026): where a person lands right after signing in. One person may be a member of several businesses
// — and of Shaadi Shopping's own team — so they pick the one they are working in now. With exactly one membership there is nothing
// to choose: it opens by itself. The server checks every choice against their memberships (POST /api/workspace); this screen only
// lists what the server said they belong to.
type Workspace = { businessId: string; name: string; kind: 'PLATFORM' | 'VENDOR'; role: string; jobTitle: string | null; home: string };

const ROLE_WORDS: Record<string, string> = { OWNER: 'Owner', MANAGER: 'Manager', EMPLOYEE: 'Employee', STAFF: 'Staff' };

export default function WorkspaceChooser() {
  const [list, setList] = useState<Workspace[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'signedOut' | 'none' | 'error'>('loading');
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(w: Workspace) {
    if (opening) return;
    setOpening(w.businessId);
    setError(null);
    try {
      const res = await fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: w.businessId }) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        window.location.href = b.data.home;
        return;
      }
      setError(b.error ?? 'That workspace could not be opened. Please try again.');
    } catch {
      setError('Could not reach Vivah OS — please check your connection and try again.');
    }
    setOpening(null);
  }

  useEffect(() => {
    let live = true;
    fetch('/api/workspace')
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
      .then(({ status, body }) => {
        if (!live) return;
        if (status === 401) return setState('signedOut');
        if (!body.success) return setState('error');
        const workspaces: Workspace[] = body.data.workspaces;
        setList(workspaces);
        if (workspaces.length === 0) return setState('none');
        // Exactly one: nothing to choose.
        if (workspaces.length === 1) return void open(workspaces[0]);
        setState('ready');
      })
      .catch(() => live && setState('error'));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the screen opens
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1E0510] px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <Image src="/logo.png" alt="Shaadi Shopping" width={240} height={150} priority className="mx-auto h-20 w-auto object-contain" />
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#E8C98A]">Vivah OS</p>
        </div>

        <div className="rounded-[24px] bg-[#FFFAF5] p-6 sm:p-8">
          {(state === 'loading' || (list?.length === 1 && state !== 'error')) && (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-[#6B5B4D]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening your workspace…
            </p>
          )}

          {state === 'ready' && list && (
            <>
              <h1 className="font-playfair text-2xl font-bold text-[#2A1F1B]">Choose workspace</h1>
              <p className="mt-1.5 text-sm text-[#6B5B4D]">You are part of more than one business. Which one are you working in now?</p>
              <ul className="mt-5 space-y-3">
                {list.map((w) => (
                  <li key={w.businessId}>
                    <button
                      type="button"
                      onClick={() => open(w)}
                      disabled={opening !== null}
                      className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[#E8DCC8] bg-white px-4 py-3 text-left transition hover:border-[#C5A46D] disabled:opacity-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#8B1A4A]/10 text-[#8B1A4A]">
                        {w.kind === 'PLATFORM' ? <ShieldCheck className="h-5 w-5" aria-hidden /> : <Building2 className="h-5 w-5" aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold text-[#2A1F1B]">{w.name}</span>
                        <span className="block truncate text-xs text-[#6B5B4D]">{[ROLE_WORDS[w.role] ?? w.role, w.jobTitle].filter((word, i, all) => word && all.indexOf(word) === i).join(' · ')}</span>
                      </span>
                      {opening === w.businessId ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#8B1A4A]" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0 text-[#B08D55]" aria-hidden />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {state === 'none' && (
            <>
              <h1 className="font-playfair text-2xl font-bold text-[#2A1F1B]">No workspace yet</h1>
              <p className="mt-2 text-sm leading-relaxed text-[#6B5B4D]">You are signed in, but you have not been added to a business yet. Ask the owner of your business to add you to their team, or call Shaadi Shopping.</p>
            </>
          )}

          {state === 'signedOut' && (
            <>
              <h1 className="font-playfair text-2xl font-bold text-[#2A1F1B]">Please sign in</h1>
              <a href="/vendor/login" className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#8B1A4A] px-6 text-sm font-semibold text-white">Sign in</a>
            </>
          )}

          {state === 'error' && <p role="alert" className="py-4 text-sm text-rose-700">Your workspaces could not be loaded. Please refresh the page.</p>}
          {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}

          {(state === 'ready' || state === 'none') && (
            <button type="button" onClick={() => signOut({ callbackUrl: '/vendor/login' })} className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-[#6B5B4D] hover:text-[#2A1F1B]">
              <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
