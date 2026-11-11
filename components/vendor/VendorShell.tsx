'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { ArrowLeftRight, LogOut, MoreHorizontal, Store, X } from 'lucide-react';
import { canSeeScreen, screenOf, type WorkspaceView } from '@/lib/auth/workspaceView';
import { PHONE_BAR, PHONE_MORE, PRIMARY, TO_CHECK_CHANGED } from './vendorNav';
import { VivahOsMark } from '@/components/vivah-os/VivahOsLogo';
import { osFontClasses } from '@/app/fonts/osFonts';
import LoginCodeReminder from './LoginCodeReminder';
import { PRODUCT_NAME, type Product } from '@/lib/productName';

// Operational shell for Vendor OS — the "Venue Owner" experience reuses this unchanged (a category-filtered
// view within it, not a separate role/shell, per docs/wedding-os/11-vivah-os-ux-architecture.md §3). Mirrors
// components/admin/AdminShell.tsx's relationship to its layout, but as a header (not a sidebar) — Vendor OS
// is deliberately lighter than the admin ops console, matching the "simple decisions on top" principle.
//
// Auth: relies entirely on proxy.ts's existing Role.VENDOR gate (this component never runs for an
// unauthenticated request — the redirect already happened in middleware). This file reads only the current
// session's own name/roles via useSession(), never another vendor's data, and adds no new API surface.
export default function VendorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  // The phone's More sheet belongs to the page it was opened on: going to another page (any link in it) closes it.
  const [moreOpenOn, setMoreOpenOn] = useState<string | null>(null);
  const moreOpen = moreOpenOn === pathname;
  const setMoreOpen = (open: boolean | ((was: boolean) => boolean)) => setMoreOpenOn(((typeof open === 'function' ? open(moreOpen) : open) ? pathname : null));
  // First sign-in (6 Oct 2026): until the business profile has a name, a logo and three photos, every Vendor OS screen leads to
  // /vendor/profile and the navigation is put away. 'checking' shows nothing of the page behind it, so a new vendor never sees a
  // dashboard flash by. A login that is not a vendor business (the API answers "no") is simply let through.
  const [gate, setGate] = useState<'checking' | 'setup' | 'open'>('checking');
  // The business this person is working in, and what they may see of it (7 Oct 2026). Until the server has said, the menu shows
  // nothing rather than everything. null after loading = the older single-owner case could not be read: the full menu, as before.
  const [ws, setWs] = useState<(WorkspaceView & { name: string; home: string; several: boolean; product?: Product }) | null | undefined>(undefined);
  // Venue OS for a venue, Vendor OS for every other wedding business (lib/productName.ts). Until the server has said: Vendor OS.
  const productName = PRODUCT_NAME[ws?.product === 'VENUE' ? 'VENUE' : 'VENDOR'];
  // "I have paid" claims from the business's own couples that wait to be checked — a mark on Enquiries, on every screen.
  const [toCheck, setToCheck] = useState(0);
  const onProfile = pathname.startsWith('/vendor/profile');
  const onLogin = pathname.startsWith('/vendor/login');

  useEffect(() => {
    if (onLogin) return;
    let live = true;
    fetch('/api/vendor-os/profile')
      .then((r) => r.json())
      .then((b) => {
        if (!live) return;
        // A member of several businesses who has not said which one they are working in.
        if (b.chooseWorkspace) return void window.location.replace('/workspace');
        const setup = Boolean(b.success && b.data?.canEdit && b.data.missing?.length > 0);
        if (setup && !onProfile) window.location.replace('/vendor/profile');
        else setGate(setup ? 'setup' : 'open');
      })
      .catch(() => live && setGate('open'));
    return () => {
      live = false;
    };
  }, [pathname, onLogin, onProfile]);

  useEffect(() => {
    if (onLogin) return;
    let live = true;
    fetch('/api/workspace')
      .then((r) => r.json())
      .then((b) => {
        if (!live) return;
        // In no vendor business at all — taken out of a team, say: "Choose Workspace" says so and how to get back in, rather than
        // a menu whose every screen would refuse them.
        if (b.success && !b.data.workspaces.some((x: { kind: string }) => x.kind === 'VENDOR')) return void window.location.replace('/workspace');
        const w = b.success ? b.data?.working : null;
        setWs(w ? { ...w, several: b.data.workspaces.filter((x: { kind: string }) => x.kind === 'VENDOR').length > 1 } : null);
      })
      .catch(() => live && setWs(null));
    return () => {
      live = false;
    };
  }, [onLogin]);

  // Asked again on every screen change, and the moment a claim is checked (TO_CHECK_CHANGED, from the enquiry screen), so the mark
  // goes with it. Any failure (a login that is not a business's, no permission) simply shows no mark.
  useEffect(() => {
    if (onLogin) return;
    let live = true;
    const load = () =>
      fetch('/api/vendor-os/enquiries/to-check')
        .then((r) => r.json())
        .then((b) => live && setToCheck(b.success && Number.isInteger(b.data?.paymentsToCheck) ? b.data.paymentsToCheck : 0))
        .catch(() => live && setToCheck(0));
    load();
    window.addEventListener(TO_CHECK_CHANGED, load);
    return () => {
      live = false;
      window.removeEventListener(TO_CHECK_CHANGED, load);
    };
  }, [pathname, onLogin]);

  // A screen this person cannot use here (a manager typing /vendor/settings, or a screen that belongs to their OTHER business):
  // send them to where this workspace opens. The server refuses the data either way.
  const screen = screenOf(pathname);
  const misplaced = Boolean(ws && screen && !canSeeScreen(screen, ws));
  useEffect(() => {
    if (misplaced && ws) window.location.replace(ws.home);
  }, [misplaced, ws]);

  const isLogin = pathname.startsWith('/vendor/login');
  const shown = (items: typeof PRIMARY) => (ws === undefined ? [] : ws === null ? items : items.filter((item) => canSeeScreen(item.key, ws)));
  const primary = shown(PRIMARY);
  const phoneBar = shown(PHONE_BAR);
  const phoneMore = shown(PHONE_MORE);
  const active = primary.find((item) => item.isActive(pathname));
  const inMore = phoneMore.some((item) => item.isActive(pathname));

  const logout = () => signOut({ callbackUrl: '/vendor/login' });

  if (isLogin) return <>{children}</>;

  const vendorName = session?.user?.name ?? 'Vendor';

  if (gate === 'checking' || misplaced) return <div className={`os-theme ${osFontClasses} min-h-screen`} aria-busy="true" />;
  // Setting up: the profile page alone, with a way out.
  if (gate === 'setup') {
    return (
      <div className={`os-theme ${osFontClasses} min-h-screen`}>
        <div className="flex h-12 items-center justify-end gap-5 bg-[var(--color-bg-inverse)] px-5">
          {ws?.several && (
            <a href="/workspace" className="flex h-12 items-center gap-1.5 text-xs font-medium text-[#E9D9C3]/80 hover:text-white">
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Switch business
            </a>
          )}
          <button type="button" onClick={logout} className="flex h-12 items-center gap-1.5 text-xs font-medium text-[#E9D9C3]/80 hover:text-white">
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Log out
          </button>
        </div>
        {children}
      </div>
    );
  }

  // `side`: a row in the desktop sidebar (dark). `compact`: a tab in the phone's bottom bar. Otherwise a row in the phone's More
  // sheet. Every row and tab is at least 44px tall.
  const navLink = (item: (typeof PRIMARY)[number], compact = false, side = false) => {
    const isActive = item.isActive(pathname);
    const Icon = item.icon;
    const mark = item.key === 'enquiries' && toCheck > 0 ? toCheck : 0;
    const markWords = mark ? ` — ${mark} ${mark === 1 ? 'payment' : 'payments'} to check` : '';
    const look = side
      ? isActive
        ? 'min-h-11 bg-[var(--primary)] text-white shadow-[0_8px_20px_-10px_rgba(123,63,242,0.9)]'
        : 'min-h-11 text-[#CBD5E1] hover:bg-white/[0.06] hover:text-white'
      : compact
        ? `min-h-14 flex-col justify-center !gap-0.5 !px-1 !py-1.5 text-[11px] ${isActive ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-text-secondary)]'}`
        : `min-h-11 ${isActive ? 'bg-[var(--primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-muted)]'}`;
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        aria-label={mark ? `${item.label}${markWords}` : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${look}`}
      >
        <span className={`relative flex items-center justify-center ${compact ? `h-7 w-12 rounded-full ${isActive ? 'bg-[var(--color-primary-subtle-bg)]' : ''}` : ''}`}>
          <Icon className={compact ? 'h-5 w-5' : 'h-[18px] w-[18px]'} aria-hidden />
          {mark > 0 && (
            <span aria-hidden className="absolute -right-1 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent-pink)] px-1 text-[10px] font-bold leading-none text-[#111827]">
              {mark > 9 ? '9+' : mark}
            </span>
          )}
        </span>
        <span className="max-w-full truncate">{item.label}</span>
      </Link>
    );
  };

  const businessName = ws?.name ?? vendorName;

  return (
    <div className={`os-theme ${osFontClasses} relative isolate min-h-screen md:flex`}>
      {/* Liquid glass backdrop (11 Nov 2026): soft colour the glass above it bends, fixed so it stays put while the page scrolls. */}
      <div aria-hidden className="os-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <span className="os-orb -left-24 -top-24 h-[28rem] w-[28rem] bg-[#A78BFA] opacity-55" />
        <span className="os-orb -right-20 top-1/4 h-[24rem] w-[24rem] bg-[#F9A8D4] opacity-45" />
        <span className="os-orb bottom-[-8rem] left-1/3 h-[26rem] w-[26rem] bg-[#7DD3FC] opacity-40" />
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand mark in the backdrop */}
        <img src="/images/vivah-os/mark-large.png" alt="" className="absolute bottom-[-6rem] right-[-4rem] h-[34rem] w-auto opacity-[0.07]" />
      </div>
      {/* Computer and tablet (11 Nov 2026, the founder's spec): the dark sidebar — every screen this person may use, then the
          business and the account. Replaces the top bar, which had to hide half the screens in a menu. */}
      <aside className="os-glass-dark sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto bg-[var(--color-bg-inverse)] px-3 py-5 md:flex">
        <Link href={ws?.home ?? '/vendor/today'} className="flex items-center gap-3 rounded-xl px-2 py-1">
          <VivahOsMark size={38} tone="light" />
          <span className="flex flex-col leading-tight">
            <span className="os-display text-base font-semibold text-white">{productName}</span>
            <span className="text-[11px] text-[#94A3B8]">by Shaadi Shopping</span>
          </span>
        </Link>

        <nav aria-label="Vendor" className="flex flex-col gap-1">
          {primary.map((item) => navLink(item, false, true))}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5 rounded-2xl bg-white/[0.05] p-2">
          <p className="truncate px-2 pt-1 text-sm font-semibold text-white" title={businessName}>{businessName}</p>
          <p className="px-2 pb-1 text-[11px] text-[#94A3B8]">{productName}</p>
          <Link href="/vendor/profile" className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm text-[#CBD5E1] hover:bg-white/[0.06] hover:text-white">
            <Store className="h-4 w-4" aria-hidden /> Business profile
          </Link>
          {ws?.several && (
            <a href="/workspace" className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm text-[#CBD5E1] hover:bg-white/[0.06] hover:text-white">
              <ArrowLeftRight className="h-4 w-4" aria-hidden /> Switch business
            </a>
          )}
          <button type="button" onClick={logout} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-left text-sm text-[#FDA4AF] hover:bg-white/[0.06]">
            <LogOut className="h-4 w-4" aria-hidden /> Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">

      {/* Mobile top strip — identity + account only, no inline nav (that's the bottom bar) */}
      <header className="os-glass-bar sticky top-0 z-30 flex h-14 items-center justify-between !rounded-none !border-x-0 !border-t-0 px-4 md:hidden">
        <span className="min-w-0 truncate text-sm font-bold text-[var(--color-text-primary)]">{active?.label ?? productName}{ws?.several ? ` · ${ws.name}` : ''}</span>
        <button type="button" onClick={logout} aria-label="Log out" className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-muted)]">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <LoginCodeReminder />
      <div className="pb-28 md:pb-0">{children}</div>

      {/* Mobile bottom navigation */}
      {/* A floating glass pill, clear of the phone's own bottom edge (liquid glass, 11 Nov 2026). */}
      <nav aria-label="Vendor" className="os-glass-bar fixed inset-x-3 z-30 rounded-[28px] px-1 md:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${phoneBar.length + 1}, minmax(0, 1fr))` }}>
          {phoneBar.map((item) => navLink(item, true))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium ${inMore ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-text-secondary)]'}`}
          >
            <span className={`flex h-7 w-12 items-center justify-center rounded-full ${inMore ? 'bg-[var(--color-primary-subtle-bg)]' : ''}`}>
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>

      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} />
          <div className="os-glass-bar absolute inset-x-0 bottom-0 !rounded-b-none rounded-t-[28px] p-3 pb-6">
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-sm font-bold text-[var(--color-text-primary)]">More</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close" className="rounded-lg p-1 text-[var(--color-text-muted)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {phoneMore.map((item) => navLink(item))}
              <Link href="/vendor/profile" onClick={() => setMoreOpen(false)} className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-muted)]">
                <Store className="h-4 w-4" /> Business profile
              </Link>
              {ws?.several && (
                <a href="/workspace" className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-muted)]">
                  <ArrowLeftRight className="h-4 w-4" /> Switch business
                </a>
              )}
              <button
                type="button"
                onClick={logout}
                className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]"
              >
                <LogOut className="h-5 w-5" /> Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
