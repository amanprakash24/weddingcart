'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, LogOut, MoreHorizontal, X } from 'lucide-react';

import { MORE, OLD_SCREENS, PHONE_BAR, PRIMARY, SETUP, type ActiveContext, type NavItem } from './adminNav';

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');

  const [hash, setHash] = useState('');
  const [role, setRole] = useState<'admin' | 'super_admin' | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  // The phone sheet remembers which screen it was opened on, so it closes by itself when you navigate.
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const isLogin = pathname.startsWith('/admin/login');

  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [pathname]);

  useEffect(() => {
    if (isLogin) return;
    fetch('/api/admin/me')
      .then((res) => res.json())
      .then((data) => setRole(data.role ?? null))
      .catch(() => setRole(null));
  }, [isLogin]);

  const routeKey = `${pathname}?${tab ?? ''}`;
  const sheetOpen = sheetFor === routeKey;
  const setSheetOpen = (open: boolean) => setSheetFor(open ? routeKey : null);

  const ctx: ActiveContext = { pathname, tab, hash };
  const moreItems = role === 'super_admin' ? [...MORE, SETUP] : MORE;
  const inMore = [...moreItems, ...OLD_SCREENS].some((item) => item.isActive(ctx));

  const logout = useCallback(async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  }, [router]);

  if (isLogin) return <>{children}</>;

  const link = (item: NavItem, opts: { compact?: boolean } = {}) => {
    const active = item.isActive(ctx);
    const Icon = item.icon;
    return (
      <Link
        key={item.key}
        href={item.href}
        onClick={() => setHash(item.href.includes('#') ? `#${item.href.split('#')[1]}` : '')}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-lg px-3 ${opts.compact ? 'py-2 text-[13px]' : 'py-2.5 text-sm'} font-medium transition-colors ${
          active ? 'bg-amber-500/20 text-amber-300' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`}
      >
        <Icon className={opts.compact ? 'h-4 w-4 flex-shrink-0' : 'h-5 w-5 flex-shrink-0'} />
        <span>{item.label}</span>
      </Link>
    );
  };

  const moreLinks = (compact: boolean) => (
    <>
      {moreItems.map((item) => link(item, { compact }))}
      <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Old screens · being retired</p>
      {OLD_SCREENS.map((item) => link(item, { compact }))}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 flex-shrink-0 flex-col overflow-y-auto bg-gray-950 md:flex">
        <div className="border-b border-gray-800 p-4">
          <Link href="/admin/dashboard" className="block">
            <span className="block text-sm font-bold text-white">Vivah OS</span>
            <span className="block text-[11px] text-gray-500">by ShaadiShopping</span>
          </Link>
        </div>
        <nav aria-label="Admin" className="flex-1 space-y-1 px-2 py-3">
          {PRIMARY.map((item) => link(item))}

          <div className="pt-3">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen || inMore}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            >
              <MoreHorizontal className="h-5 w-5 flex-shrink-0" />
              <span>More</span>
              <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${moreOpen || inMore ? 'rotate-180' : ''}`} />
            </button>
            {(moreOpen || inMore) && <div className="mt-1 space-y-0.5 border-l border-gray-800 pl-2">{moreLinks(true)}</div>}
          </div>
        </nav>
        <div className="border-t border-gray-800 p-2">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-gray-500 hover:bg-gray-800 hover:text-white">
            View website
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-rose-400 hover:bg-gray-800 hover:text-rose-300"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      {/* Page content (leave room for the phone bottom bar) */}
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>

      {/* Phone: bottom bar + More sheet */}
      <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-800 bg-gray-950 md:hidden">
        <div className="grid grid-cols-5">
          {PHONE_BAR.map((item) => {
            const active = item.isActive(ctx);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setHash(item.href.includes('#') ? `#${item.href.split('#')[1]}` : '')}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium ${active ? 'text-amber-300' : 'text-gray-400'}`}
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
            className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium ${inMore || ctx.tab === 'invoices' ? 'text-amber-300' : 'text-gray-400'}`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-gray-950 p-3 pb-6">
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-sm font-bold text-white">More</span>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {PRIMARY.filter((item) => item.key === 'invoices').map((item) => link(item))}
              {moreLinks(false)}
              <button
                type="button"
                onClick={logout}
                className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-400 hover:bg-gray-800"
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
