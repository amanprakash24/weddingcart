'use client';

// Venue OS / Vendor OS → Today: the Command Center (the founder's spec and glass reference, 11 Nov 2026).
// A hero with the Vivah OS mark behind frosted-glass totals, then what needs doing, the weddings ahead, the money still to
// come in and the newest enquiries. Every number comes from the business's real records:
//   - props: Shaadi Shopping's bookings for this vendor (lib/vendor/todayView.ts, built on the server)
//   - /api/vendor-os/weddings     the business's own weddings (merged in by lib/vendor/ownWeddingsToday.ts)
//   - /api/vendor-os/enquiries    each enquiry and its next step (lib/venue/enquiry.ts)
//   - /api/vendor-os/collections  money still to collect and received this month (lib/venue/collections.ts)
// A part this person may not see (the server answers 403) is simply left out — an employee never sees the money.
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CalendarHeart, CircleAlert, Inbox, IndianRupee, Wallet } from 'lucide-react';
import GettingStarted from '@/components/vendor/GettingStarted';
import YourWork from '@/components/vendor/YourWork';
import { withOwnWeddings } from '@/lib/vendor/ownWeddingsToday';
import type { VenueWeddingListItem } from '@/services/venueWedding.service';
import type { VenueEnquiryListItem } from '@/services/venueEnquiry.service';
import type { VenueCollections } from '@/lib/venue/collections';

export interface VendorIdentity {
  businessName: string;
  category: string;
}

export interface TodayServiceItem {
  id: string;
  wedding: string;
  function: string;
  time: string;
  location: string;
  status: 'confirmed' | 'pending';
  href?: string;
}

export interface UpcomingWeddingItem {
  id: string;
  wedding: string;
  date: string;
  function: string;
  daysToGo?: number;
  href?: string;
}

export interface PendingResponseItem {
  id: string;
  wedding: string;
  function: string;
  requirement: string;
  price: string | null;
}

export interface ActivityItem {
  id: string;
  text: string;
  when: string;
}

export interface VendorTodayScreenProps {
  vendor: VendorIdentity;
  nextAction: { title: string; detail?: string; tone: 'calm' | 'attention' };
  attentionItems: { id: string; title: string; meta: string }[];
  todaysServices: TodayServiceItem[];
  upcomingWeddings: UpcomingWeddingItem[];
  pendingResponses: PendingResponseItem[];
  recentActivity: ActivityItem[];
}

// ---------- data ----------

// One GET; undefined while loading, null when this person may not see it (or it failed) — that part of the screen is left out.
function useApi<T>(url: string): T | null | undefined {
  const [data, setData] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetch(url)
      .then((r) => r.json().catch(() => ({})))
      .then((body) => live && setData(body?.success ? (body.data as T) : null))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [url]);
  return data;
}

// The steps that want someone today, most urgent first (lib/venue/enquiry.ts NextAction).
const URGENT: Record<string, { rank: number; tone: 'danger' | 'warning' | 'primary' | 'info' }> = {
  PAYMENT_TO_CHECK: { rank: 0, tone: 'warning' },
  FOLLOW_UP_OVERDUE: { rank: 1, tone: 'danger' },
  QUOTE_ACCEPTED: { rank: 2, tone: 'primary' },
  QUOTE_CHANGES: { rank: 3, tone: 'primary' },
  FOLLOW_UP_TODAY: { rank: 4, tone: 'info' },
  CALL: { rank: 5, tone: 'info' },
  QUOTE_DRAFT: { rank: 6, tone: 'info' },
};
const DOT: Record<string, string> = {
  danger: 'bg-[var(--color-danger-default)]',
  warning: 'bg-[var(--color-warning-default)]',
  primary: 'bg-[var(--primary)]',
  info: 'bg-[var(--color-info-default)]',
};

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const shortDate = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

function greetingNow() {
  const parts = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = Number(get('hour'));
  return { hello: hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening', date: `${get('weekday')}, ${get('day')} ${get('month')}` };
}

// ---------- pieces ----------

function Panel({ title, action, children, delay = 0 }: { title: string; action?: { href: string; label: string }; children: ReactNode; delay?: number }) {
  const still = useReducedMotion();
  return (
    <motion.section
      aria-label={title}
      initial={still ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-w-0 flex-col gap-3 rounded-3xl border border-[var(--color-border-subtle)] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-[var(--color-text-primary)]">{title}</h2>
        {action && (
          <Link href={action.href} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--color-primary-text)] hover:underline">
            {action.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </motion.section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-[var(--color-bg-surface-muted)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">{children}</p>;
}

function GlassStat({ icon, label, value, note, delay }: { icon: ReactNode; label: string; value: string; note?: string; delay: number }) {
  const still = useReducedMotion();
  return (
    <motion.div
      initial={still ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/20 bg-white/[0.13] p-3.5 text-white sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-xl backdrop-saturate-150"
    >
      <span className="flex items-center gap-2 text-[13px] leading-snug text-white/85">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">{icon}</span>
        {label}
      </span>
      <span className="os-display whitespace-nowrap text-[20px] font-semibold tabular-nums sm:text-[28px]">{value}</span>
      {note && <span className="truncate text-xs text-white/75">{note}</span>}
    </motion.div>
  );
}

// ---------- the screen ----------

export default function VendorTodayScreen(props: VendorTodayScreenProps) {
  const { vendor, attentionItems, pendingResponses } = props;
  const own = useApi<VenueWeddingListItem[]>('/api/vendor-os/weddings');
  const enquiries = useApi<VenueEnquiryListItem[]>('/api/vendor-os/enquiries');
  const money = useApi<VenueCollections>('/api/vendor-os/collections');
  const { todaysServices, upcomingWeddings, upcomingCount } = withOwnWeddings(props, own ?? null);
  // India time on the server and in the browser alike, so both say the same; suppressHydrationWarning covers a minute ticking over.
  const now = greetingNow();

  // What needs someone today: the business's own enquiries by their next step, then Shaadi Shopping's requests.
  const needs = [
    ...(enquiries ?? [])
      .filter((e) => e.next.kind in URGENT)
      .sort((a, b) => URGENT[a.next.kind].rank - URGENT[b.next.kind].rank)
      .map((e) => ({ id: e.id, title: e.name, detail: e.next.label, href: `/vendor/enquiries/${e.id}`, tone: URGENT[e.next.kind].tone })),
    ...pendingResponses.map((p) => ({ id: `ss-${p.id}`, title: `${p.wedding} — ${p.function}`, detail: 'Shaadi Shopping is waiting for your answer', href: '/vendor/services', tone: 'primary' as const })),
    ...attentionItems
      .filter((a) => !a.id.startsWith('resp-'))
      .map((a) => ({ id: a.id, title: a.title, detail: a.meta, href: '/vendor/services', tone: 'danger' as const })),
  ];
  const recent = [...(enquiries ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const seesMoney = money !== null;
  // A total only for what this person may see: an employee without weddings or enquiries gets no misleading zero.
  const seesWeddings = own !== null || props.upcomingWeddings.length > 0 || props.todaysServices.length > 0;
  const seesEnquiries = enquiries !== null;
  const stats = [seesWeddings, seesEnquiries, seesMoney, seesMoney].filter(Boolean).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6 md:pt-6">
      {/* Hero: the Vivah OS mandap mark, large and soft, behind frosted glass on navy (the founder, 11 Nov 2026: the same for every
          business — a business's own photo could be anything, even another brand's logo). */}
      <section aria-label="Today at a glance" className="relative isolate overflow-hidden rounded-[28px] bg-[var(--color-bg-inverse)] p-5 sm:p-7">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand mark behind the glass */}
        <img src="/images/vivah-os/mark-large.png" alt="" aria-hidden className="pointer-events-none absolute -right-6 top-4 -z-20 h-[58%] w-auto max-w-none opacity-50 sm:-right-4 sm:-top-24 sm:h-[175%] sm:opacity-60" />
        <div aria-hidden className="absolute -left-24 bottom-[-40%] -z-20 h-80 w-80 rounded-full bg-[var(--primary)] opacity-35 blur-3xl" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(15,23,42,0.85)_0%,rgba(15,23,42,0.55)_55%,rgba(15,23,42,0.35)_100%)]" />
        <div className="flex flex-col gap-1">
          <p className="text-sm text-white/80" suppressHydrationWarning>{now.date}</p>
          <h1 className="text-[26px] font-semibold leading-tight text-white sm:text-[32px]" suppressHydrationWarning>
            {now.hello}, {vendor.businessName}
          </h1>
          <p className="text-sm text-white/80">
            {!seesEnquiries || enquiries === undefined ? ' ' : needs.length === 0 ? 'Nothing needs you right now.' : `${needs.length} ${needs.length === 1 ? 'thing needs' : 'things need'} you today.`}
          </p>
        </div>
        {stats > 0 && <div className={`mt-5 grid gap-3 ${stats > 2 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
          {seesWeddings && <GlassStat delay={0.05} icon={<CalendarHeart className="h-4 w-4" aria-hidden />} label="Upcoming weddings" value={String(upcomingCount)} note={upcomingWeddings[0] ? `Next: ${upcomingWeddings[0].date}` : 'None booked yet'} />}
          {seesEnquiries && <GlassStat delay={0.1} icon={<CircleAlert className="h-4 w-4" aria-hidden />} label="Need you today" value={enquiries === undefined ? '…' : String(needs.length)} note={todaysServices.length ? `${todaysServices.length} on today` : undefined} />}
          {seesMoney && (
            <>
              <GlassStat delay={0.15} icon={<Wallet className="h-4 w-4" aria-hidden />} label="Still to collect" value={money ? rupees(money.toCollect) : '…'} note={money ? `from ${money.due.length} ${money.due.length === 1 ? 'booking' : 'bookings'}` : undefined} />
              <GlassStat delay={0.2} icon={<IndianRupee className="h-4 w-4" aria-hidden />} label={money ? `Received in ${money.monthLabel.split(' ')[0]}` : 'Received this month'} value={money ? rupees(money.receivedThisMonth) : '…'} />
            </>
          )}
        </div>}
      </section>

      <GettingStarted />
      <YourWork />

      <div className="grid gap-5 lg:grid-cols-2">
        {enquiries !== null && (
          <Panel title="Needs you today" action={{ href: '/vendor/enquiries', label: 'Enquiries' }} delay={0.1}>
            {enquiries === undefined ? (
              <Empty>Loading…</Empty>
            ) : needs.length === 0 ? (
              <Empty>All caught up. New enquiries and payments to check will show here.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {needs.slice(0, 6).map((n) => (
                  <li key={n.id}>
                    <Link href={n.href} className="flex min-h-14 items-center gap-3 rounded-2xl bg-[var(--color-bg-surface-muted)] px-4 py-3 hover:bg-[var(--color-primary-subtle-bg)]">
                      <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[n.tone]}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">{n.title}</span>
                        <span className="block truncate text-[13px] text-[var(--color-text-muted)]">{n.detail}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {seesWeddings && (
        <Panel title="Upcoming weddings" action={{ href: '/vendor/weddings', label: 'All weddings' }} delay={0.15}>
          {todaysServices.length > 0 && (
            <ul className="flex flex-col gap-2">
              {todaysServices.map((s) => (
                <li key={s.id}>
                  <Link href={s.href ?? '/vendor/services'} className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--primary)] bg-[var(--color-primary-subtle-bg)] px-4 py-3">
                    <span className="os-display rounded-lg bg-[var(--primary)] px-2 py-1 text-xs font-semibold text-white">Today</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">{s.wedding} — {s.function}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {upcomingWeddings.length === 0 && todaysServices.length === 0 ? (
            <Empty>No weddings ahead yet. A booking you confirm shows here.</Empty>
          ) : (
            <ul className="flex flex-col">
              {upcomingWeddings.map((w) => {
                const [day, mon] = w.date.split(' ');
                return (
                  <li key={w.id} className="border-b border-[var(--color-border-subtle)] last:border-0">
                    <Link href={w.href ?? '/vendor/weddings'} className="flex min-h-16 items-center gap-4 py-2.5">
                      <span className="flex w-14 shrink-0 flex-col items-center rounded-2xl bg-[var(--color-primary-subtle-bg)] py-1.5">
                        <span className="text-[11px] font-semibold uppercase text-[var(--color-primary-text)]">{mon ?? ''}</span>
                        <span className="os-display text-lg font-semibold leading-none text-[var(--color-text-primary)]">{day}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">{w.wedding}</span>
                        <span className="block truncate text-[13px] text-[var(--color-text-muted)]">{w.function}</span>
                      </span>
                      {typeof w.daysToGo === 'number' && <span className="shrink-0 text-xs font-medium text-[var(--color-text-muted)]">{w.daysToGo === 1 ? 'Tomorrow' : `${w.daysToGo} days`}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        )}

        {seesMoney && (
          <Panel title="Money to collect" action={{ href: '/vendor/payments', label: 'Payments' }} delay={0.2}>
            {money === undefined ? (
              <Empty>Loading…</Empty>
            ) : money.due.length === 0 ? (
              <Empty>Nothing to collect. Every booking is paid in full.</Empty>
            ) : (
              <ul className="flex flex-col gap-4">
                {money.due.slice(0, 4).map((d) => {
                  const pct = d.total > 0 ? Math.min(100, Math.round((d.received / d.total) * 100)) : 0;
                  return (
                    <li key={d.enquiryId}>
                      <Link href={`/vendor/enquiries/${d.enquiryId}#quotation`} className="flex flex-col gap-1.5">
                        <span className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-semibold text-[var(--color-text-primary)]">{d.customerName}</span>
                          <span className="shrink-0 tabular-nums text-[var(--color-text-secondary)]">{rupees(d.outstanding)} left</span>
                        </span>
                        <span className="h-2 overflow-hidden rounded-full bg-[var(--color-border-subtle)]" role="progressbar" aria-label={`${d.customerName}: ${pct}% received`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                          <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {rupees(d.received)} of {rupees(d.total)} · {d.stateLabel}
                          {d.claimsToCheck > 0 ? ' · payment to check' : ''}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        {enquiries !== null && (
          <Panel title="Recent enquiries" action={{ href: '/vendor/enquiries/new', label: 'New enquiry' }} delay={0.25}>
            {enquiries === undefined ? (
              <Empty>Loading…</Empty>
            ) : recent.length === 0 ? (
              <Empty>No enquiries yet. Share your enquiry page and they will land here.</Empty>
            ) : (
              <ul className="flex flex-col">
                {recent.map((e) => (
                  <li key={e.id} className="border-b border-[var(--color-border-subtle)] last:border-0">
                    <Link href={`/vendor/enquiries/${e.id}`} className="flex min-h-14 items-center gap-3 py-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle-bg)] text-sm font-semibold text-[var(--color-primary-text)]">
                        {e.name.trim().slice(0, 1).toUpperCase() || <Inbox className="h-4 w-4" aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">{e.name}</span>
                        <span className="block truncate text-[13px] text-[var(--color-text-muted)]">
                          {[e.event ?? 'Wedding', e.weddingDate ? shortDate(e.weddingDate) : null, e.channel].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="hidden max-w-[40%] shrink-0 truncate rounded-full bg-[var(--color-bg-surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] sm:block">{e.next.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
