'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { ArrowLeftRight, LogOut, MoreHorizontal, Store, User, X } from 'lucide-react';
import { canSeeScreen, screenOf, type WorkspaceView } from '@/lib/auth/workspaceView';
import { PHONE_BAR, PHONE_MORE, PRIMARY } from './vendorNav';
import LoginCodeReminder from './LoginCodeReminder';

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
  const [moreOpen, setMoreOpen] = useState(false);
  // First sign-in (6 Oct 2026): until the business profile has a name, a logo and three photos, every Vendor OS screen leads to
  // /vendor/profile and the navigation is put away. 'checking' shows nothing of the page behind it, so a new vendor never sees a
  // dashboard flash by. A login that is not a vendor business (the API answers "no") is simply let through.
  const [gate, setGate] = useState<'checking' | 'setup' | 'open'>('checking');
  // The business this person is working in, and what they may see of it (7 Oct 2026). Until the server has said, the menu shows
  // nothing rather than everything. null after loading = the older single-owner case could not be read: the full menu, as before.
  const [ws, setWs] = useState<(WorkspaceView & { name: string; home: string; several: boolean }) | null | undefined>(undefined);
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
        const w = b.success ? b.data?.working : null;
        setWs(w ? { ...w, several: b.data.workspaces.filter((x: { kind: string }) => x.kind === 'VENDOR').length > 1 } : null);
      })
      .catch(() => live && setWs(null));
    return () => {
      live = false;
    };
  }, [onLogin]);

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

  if (gate === 'checking' || misplaced) return <div className="min-h-screen bg-[#FFFAF5]" aria-busy="true" />;
  // Setting up: the profile page alone, with a way out.
  if (gate === 'setup') {
    return (
      <div className="min-h-screen bg-[#FFFAF5]">
        <div className="flex h-12 items-center justify-end gap-5 bg-[#1E0510] px-5">
          {ws?.several && (
            <a href="/workspace" className="flex items-center gap-1.5 text-xs font-medium text-[#E9D9C3]/80 hover:text-white">
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Switch business
            </a>
          )}
          <button type="button" onClick={logout} className="flex items-center gap-1.5 text-xs font-medium text-[#E9D9C3]/80 hover:text-white">
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Log out
          </button>
        </div>
        {children}
      </div>
    );
  }

  // `desktop`: the top bar has no room for eight labels below xl, so there it shows icons only and the "current workspace"
  // text beside the logo names the page; from xl up the labels are back, each on one line.
  const navLink = (item: (typeof PRIMARY)[number], compact = false, desktop = false) => {
    const isActive = item.isActive(pathname);
    const Icon = item.icon;
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        aria-label={desktop ? item.label : undefined}
        title={desktop ? item.label : undefined}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-[var(--primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-muted)]'
        } ${compact ? 'flex-col gap-0.5 !px-1 !py-2 text-[10px]' : ''}`}
      >
        <Icon className={compact ? 'h-5 w-5' : 'h-4 w-4'} />
        <span className={compact ? 'max-w-full truncate' : desktop ? 'hidden whitespace-nowrap xl:inline' : ''}>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-surface-muted)]">
      {/* Desktop header */}
      <header className="sticky top-0 z-30 hidden border-b border-[var(--color-border-subtle)] bg-white/95 backdrop-blur md:block">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
          <Link href={ws?.home ?? '/vendor/today'} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <span className="text-sm font-bold text-[var(--color-text-primary)]">Vendor OS</span>
            <span className="text-[11px] text-[var(--color-text-muted)]">by ShaadiShopping</span>
          </Link>

          {/* Current workspace */}
          {active && (
            <>
              <span className="h-5 w-px bg-[var(--color-border-default)] xl:hidden" aria-hidden />
              <span className="whitespace-nowrap text-sm font-semibold text-[var(--color-text-primary)] xl:hidden">{active.label}</span>
            </>
          )}

          <nav aria-label="Vendor" className="ml-auto flex items-center gap-1">
            {primary.map((item) => navLink(item, false, true))}
          </nav>

          {/* Account / profile access */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border-default)] py-1.5 pl-1.5 pr-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-muted)]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-bg-inverse)] text-white">
                <User className="h-4 w-4" />
              </span>
              <span className="max-w-[160px] truncate">{ws?.name ?? vendorName}</span>
            </button>
            {moreOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-[var(--color-border-subtle)] bg-white p-1 shadow-lg">
                <Link
                  href="/vendor/profile"
                  onClick={() => setMoreOpen(false)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-muted)]"
                >
                  <Store className="h-4 w-4" /> Business profile
                </Link>
                {ws?.several && (
                  <a href="/workspace" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-muted)]">
                    <ArrowLeftRight className="h-4 w-4" /> Switch business
                  </a>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile top strip — identity + account only, no inline nav (that's the bottom bar) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--color-border-subtle)] bg-white/95 px-4 backdrop-blur md:hidden">
        <span className="min-w-0 truncate text-sm font-bold text-[var(--color-text-primary)]">{active?.label ?? 'Vendor OS'}{ws?.several ? ` · ${ws.name}` : ''}</span>
        <button type="button" onClick={logout} aria-label="Log out" className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-muted)]">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <LoginCodeReminder />
      <div className="pb-16 md:pb-0">{children}</div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Vendor" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border-subtle)] bg-white/95 backdrop-blur md:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${phoneBar.length + 1}, minmax(0, 1fr))` }}>
          {phoneBar.map((item) => navLink(item, true))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium ${inMore ? 'text-[var(--primary)]' : 'text-[var(--color-text-secondary)]'}`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-3 pb-6">
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-sm font-bold text-[var(--color-text-primary)]">More</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close" className="rounded-lg p-1 text-[var(--color-text-muted)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {phoneMore.map((item) => navLink(item))}
              <Link href="/vendor/profile" onClick={() => setMoreOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-muted)]">
                <Store className="h-4 w-4" /> Business profile
              </Link>
              {ws?.several && (
                <a href="/workspace" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-muted)]">
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
