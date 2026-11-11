'use client';

import VivahOsLogo from '@/components/vivah-os/VivahOsLogo';
import OsBackdrop from '@/components/os/OsBackdrop';
import { osFontClasses } from '@/app/fonts/osFonts';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, LogOut, MoreHorizontal, X } from 'lucide-react';

import Avatar from './Avatar';
import { PROFILE_CHANGED } from '@/lib/admin/myProfile';
import { COUPLE_SIGN_IN, MORE, OLD_SCREENS, OUR_TEAM, PHONE_BAR, PRIMARY, SETUP, type ActiveContext, type NavItem } from './adminNav';

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const section = searchParams.get('section');

  const [role, setRole] = useState<'admin' | 'super_admin' | null>(null);
  // The signed-in person, shown at the top of the menu (My profile). Re-read when they change their name or photo.
  const [me, setMe] = useState<{ name: string | null; designation: string | null; photoUrl: string | null } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  // New vendor registrations waiting for review — the count beside "Vendor applications" (founder's choice, 6 Oct 2026: a count in
  // the menu, no email or WhatsApp). Re-read on every screen change, so it drops as soon as one is approved or rejected.
  const [newApplications, setNewApplications] = useState(0);
  // The phone sheet remembers which screen it was opened on, so it closes by itself when you navigate.
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const isLogin = pathname.startsWith('/admin/login');

  useEffect(() => {
    if (isLogin) return;
    const read = () =>
      fetch('/api/admin/me')
        .then((res) => res.json())
        .then((data) => {
          setRole(data.role ?? null);
          setMe(data.me ?? null);
        })
        .catch(() => setRole(null));
    void read();
    window.addEventListener(PROFILE_CHANGED, read);
    return () => window.removeEventListener(PROFILE_CHANGED, read);
  }, [isLogin]);

  useEffect(() => {
    if (isLogin) return;
    let live = true;
    fetch('/api/vendor-applications?status=new')
      .then((res) => res.json())
      .then((body) => live && setNewApplications(body.success && Array.isArray(body.data) ? body.data.length : 0))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isLogin, pathname, tab]);

  const routeKey = `${pathname}?${tab ?? ''}`;
  const sheetOpen = sheetFor === routeKey;
  const setSheetOpen = (open: boolean) => setSheetFor(open ? routeKey : null);

  const ctx: ActiveContext = { pathname, tab, section };
  const moreItems = role === 'super_admin' ? [...MORE, OUR_TEAM, COUPLE_SIGN_IN, SETUP] : MORE;
  const inMore = [...moreItems, ...OLD_SCREENS].some((item) => item.isActive(ctx));

  const logout = useCallback(async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  }, [router]);

  if (isLogin) return <>{children}</>;

  // Weddings is the Today page scrolled to its "Upcoming weddings" list. Next will not scroll when that list is already
  // partly on screen (or when the URL is already ?section=upcoming), so when we are already on the page, scroll it ourselves.
  // Going back to plain Today returns to the top.
  const navigated = (item: NavItem) => {
    const [path, query = ''] = item.href.split('?');
    if (pathname !== path) return;
    const wanted = new URLSearchParams(query).get('section');
    if (wanted) document.getElementById(wanted)?.scrollIntoView({ behavior: 'instant', block: 'start' });
    else if (section) window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const link = (item: NavItem, opts: { compact?: boolean } = {}) => {
    const active = item.isActive(ctx);
    const Icon = item.icon;
    return (
      <Link
        key={item.key}
        href={item.href}
        onClick={() => navigated(item)}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-lg px-3 ${opts.compact ? 'py-2 text-[13px]' : 'py-3 text-sm'} font-medium transition-colors ${
          active ? 'bg-[var(--primary)] text-white shadow-[0_8px_20px_-10px_rgba(123,63,242,0.9)]' : 'text-[#CBD5E1] hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        <Icon className={opts.compact ? 'h-4 w-4 flex-shrink-0' : 'h-5 w-5 flex-shrink-0'} />
        <span>{item.label}</span>
        {item.key === 'applications' && newApplications > 0 && (
          <span aria-label={`${newApplications} new`} className="ml-auto rounded-full bg-[var(--color-accent-pink)] px-2 py-0.5 text-[11px] font-bold leading-none text-[#111827]">
            {newApplications}
          </span>
        )}
      </Link>
    );
  };

  const roleLabel = role === 'super_admin' ? 'Founder' : 'Team';
  const profileLink = (onDark: string) => (
    <Link href="/admin/profile" aria-current={pathname.startsWith('/admin/profile') ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 ${onDark}`}>
      <Avatar name={me?.name ?? null} photoUrl={me?.photoUrl ?? null} size={36} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">{me?.name ?? 'Add your name'}</span>
        <span className="block truncate text-[11px] text-[#94A3B8]">{me?.designation ?? roleLabel}</span>
      </span>
    </Link>
  );

  const moreLinks = (compact: boolean) => (
    <>
      {moreItems.map((item) => link(item, { compact }))}
      <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Old screens · being retired</p>
      {OLD_SCREENS.map((item) => link(item, { compact }))}
    </>
  );

  return (
    <div className={`os-theme ${osFontClasses} relative isolate min-h-screen md:flex`}>
      {/* Vivah OS in the approved liquid glass look (11 Nov 2026), the same as Venue OS, Vendor OS and Client OS. */}
      <OsBackdrop />
      {/* Desktop sidebar */}
      <aside className="os-glass-dark sticky top-0 hidden h-screen w-60 flex-shrink-0 flex-col overflow-y-auto bg-[var(--color-bg-inverse)] md:flex">
        <div className="border-b border-white/10 px-3 py-4">
          <Link href="/admin/dashboard" aria-label="Vivah OS — Command Center" className="block rounded-xl px-1">
            <VivahOsLogo size={34} tone="light" product="VIVAH" />
          </Link>
        </div>
        {role && <div className="border-b border-white/10 p-2">{profileLink(pathname.startsWith('/admin/profile') ? 'bg-[var(--primary)]/30' : 'hover:bg-white/[0.06]')}</div>}
        <nav aria-label="Admin" className="flex-1 space-y-1 px-2 py-3">
          {PRIMARY.map((item) => link(item))}

          <div className="pt-3">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen || inMore}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#CBD5E1] transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <MoreHorizontal className="h-5 w-5 flex-shrink-0" />
              <span>More</span>
              {/* "Vendor applications" lives inside More: closed, its count would be out of sight, so More carries it too. */}
              {newApplications > 0 && !(moreOpen || inMore) && (
                <span aria-label={`${newApplications} new vendor ${newApplications === 1 ? 'application' : 'applications'}`} className="rounded-full bg-[var(--color-accent-pink)] px-2 py-0.5 text-[11px] font-bold leading-none text-[#111827]">
                  {newApplications}
                </span>
              )}
              <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${moreOpen || inMore ? 'rotate-180' : ''}`} />
            </button>
            {(moreOpen || inMore) && <div className="mt-1 space-y-0.5 border-l border-white/10 pl-2">{moreLinks(true)}</div>}
          </div>
        </nav>
        <div className="border-t border-white/10 p-2">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-[#94A3B8] hover:bg-white/[0.06] hover:text-white">
            View website
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-[#FDA4AF] hover:bg-white/[0.06]"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      {/* Page content (leave room for the phone bottom bar) */}
      <div className="min-w-0 flex-1 pb-28 md:pb-0">{children}</div>

      {/* Phone: bottom bar + More sheet */}
      <nav aria-label="Admin" className="os-glass-bar fixed inset-x-3 z-40 rounded-[28px] px-1 md:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}>
        <div className="grid grid-cols-5">
          {PHONE_BAR.map((item) => {
            const active = item.isActive(ctx);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => navigated(item)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium ${active ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-text-secondary)]'}`}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.key === 'leads' ? 'Leads' : item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium ${inMore || ctx.tab === 'invoices' ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-text-secondary)]'}`}
          >
            <span className="relative">
              <MoreHorizontal className="h-5 w-5" />
              {newApplications > 0 && (
                <span aria-label={`${newApplications} new vendor ${newApplications === 1 ? 'application' : 'applications'}`} className="absolute -right-3 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent-pink)] px-1 text-[10px] font-bold leading-none text-[#111827]">
                  {newApplications > 9 ? '9+' : newApplications}
                </span>
              )}
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setSheetOpen(false)} />
          <div className="os-glass-dark absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[28px] bg-[var(--color-bg-inverse)] p-3 pb-6">
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-sm font-bold text-white">More</span>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close" className="rounded-lg p-1 text-[#CBD5E1] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {role && <div className="mb-2 border-b border-white/10 pb-2">{profileLink('hover:bg-white/[0.06]')}</div>}
            <div className="space-y-0.5">
              {PRIMARY.filter((item) => item.key === 'invoices').map((item) => link(item))}
              {moreLinks(false)}
              <button
                type="button"
                onClick={logout}
                className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#FDA4AF] hover:bg-white/[0.06]"
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
