'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, MoreHorizontal, User, X } from 'lucide-react';
import { PHONE_BAR, PHONE_MORE, PRIMARY } from './vendorNav';

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

  const isLogin = pathname.startsWith('/vendor/login');
  const active = PRIMARY.find((item) => item.isActive(pathname));
  const inMore = PHONE_MORE.some((item) => item.isActive(pathname));

  const logout = () => signOut({ callbackUrl: '/vendor/login' });

  if (isLogin) return <>{children}</>;

  const vendorName = session?.user?.name ?? 'Vendor';

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
          <Link href="/vendor/today" className="flex shrink-0 items-center gap-2 whitespace-nowrap">
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
            {PRIMARY.map((item) => navLink(item, false, true))}
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
              <span className="max-w-[140px] truncate">{vendorName}</span>
            </button>
            {moreOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-[var(--color-border-subtle)] bg-white p-1 shadow-lg">
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
        <span className="text-sm font-bold text-[var(--color-text-primary)]">{active?.label ?? 'Vendor OS'}</span>
        <button type="button" onClick={logout} aria-label="Log out" className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface-muted)]">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <div className="pb-16 md:pb-0">{children}</div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Vendor" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border-subtle)] bg-white/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {PHONE_BAR.map((item) => navLink(item, true))}
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
              {PHONE_MORE.map((item) => navLink(item))}
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
