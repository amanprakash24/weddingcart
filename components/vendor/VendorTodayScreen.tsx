'use client';

// Vendor OS -> Today. First screen built on the Vivah OS component system (components/ui/*) for a role
// other than admin -- the point of this screen is to prove the system holds up outside the Wedding Control
// Room, not to ship Vendor OS. Its one fetch: the business's own weddings (/api/vendor-os/weddings), merged into the counts
// and lists by lib/vendor/ownWeddingsToday.ts — without them a venue's own bookings never showed here. No auth, no writes.
import { Card, CardEmptyState, NextActionCard } from '@/components/ui/Card';
import { Row } from '@/components/ui/Row';
import StatusPill, { type PillStatus } from '@/components/ui/StatusPill';
import Link from 'next/link';
import MoneyToCollect from '@/components/vendor/payments/MoneyToCollect';
import GettingStarted from '@/components/vendor/GettingStarted';
import YourWork from '@/components/vendor/YourWork';
import { useEffect, useState } from 'react';
import { withOwnWeddings } from '@/lib/vendor/ownWeddingsToday';
import type { VenueWeddingListItem } from '@/services/venueWedding.service';

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
  nextAction: { title: string; detail?: string; tone: 'calm' | 'attention'; ctaLabel?: string; onCta?: () => void };
  attentionItems: { id: string; title: string; meta: string }[];
  todaysServices: TodayServiceItem[];
  upcomingWeddings: UpcomingWeddingItem[];
  pendingResponses: PendingResponseItem[];
  recentActivity: ActivityItem[];
}

const SERVICE_STATUS_PILL: Record<TodayServiceItem['status'], PillStatus> = { confirmed: 'confirmed', pending: 'info' };

// The business's own weddings, loaded like the Weddings page (venue-scoped). Not allowed to see them (403/404) or not loaded
// yet: Today shows what it already had.
function useOwnWeddings(): VenueWeddingListItem[] | null {
  const [items, setItems] = useState<VenueWeddingListItem[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/weddings')
      .then((r) => r.json().catch(() => ({})))
      .then((body) => { if (live && body.success) setItems(body.data); })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return items;
}

export default function VendorTodayScreen(props: VendorTodayScreenProps) {
  const own = useOwnWeddings();
  const { vendor, attentionItems, pendingResponses, recentActivity } = props;
  const { nextAction, todaysServices, upcomingWeddings, upcomingCount } = withOwnWeddings(props, own);
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
      {/* Header / vendor identity */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-bg-inverse)] text-sm font-semibold text-white">
          {vendor.businessName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{vendor.businessName}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{vendor.category}</p>
        </div>
      </div>

      {/* A business that has just set up its profile: what to do first. Gone once it is all done. */}
      <GettingStarted />

      {/* The to-dos given to this person on the business's own weddings. Says nothing when there are none. */}
      <YourWork />

      {/* Today summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-3 text-center">
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">{todaysServices.length}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">Services today</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">{pendingResponses.length}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">Awaiting your response</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">{upcomingCount}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">Upcoming weddings</p>
        </Card>
      </div>

      {/* Next action */}
      <NextActionCard {...nextAction} />

      {/* The business's own bookings: what is still to collect. Says nothing when there is nothing, or for a member who may not see money. */}
      <MoneyToCollect compact />

      {/* Needs attention */}
      {attentionItems.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Needs attention</h2>
          <Card>
            {attentionItems.map((item) => (
              <Row key={item.id} variant="attention" title={item.title} meta={item.meta} />
            ))}
          </Card>
        </section>
      )}

      {/* Today's services */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Today&apos;s services</h2>
        {todaysServices.length === 0 ? (
          <CardEmptyState title="Nothing scheduled today" description="Services assigned to you for today will show up here." />
        ) : (
          <Card>
            {todaysServices.map((s) => {
              const row = (
                <Row
                  key={s.id}
                  title={`${s.wedding} — ${s.function}`}
                  meta={[s.time, s.location].filter(Boolean).join(' · ') || 'Your own wedding'}
                  right={<StatusPill status={SERVICE_STATUS_PILL[s.status]}>{s.status === 'confirmed' ? 'Confirmed' : 'Awaiting confirmation'}</StatusPill>}
                />
              );
              return s.href ? <Link key={s.id} href={s.href} className="block">{row}</Link> : row;
            })}
          </Card>
        )}
      </section>

      {/* Upcoming weddings */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Upcoming weddings</h2>
        {upcomingWeddings.length === 0 ? (
          <CardEmptyState title="No upcoming weddings" description="Confirmed bookings ahead of today will show up here." />
        ) : (
          <Card>
            {upcomingWeddings.map((w) => (
              <Link key={w.id} href={w.href ?? '/vendor/weddings'} className="block">
                <Row title={w.wedding} meta={`${w.date} · ${w.function}`} right={<span className="text-xs font-semibold underline underline-offset-2">Open</span>} />
              </Link>
            ))}
          </Card>
        )}
      </section>

      {/* Pending responses. There is no way to accept or decline from here yet (no such action exists on the server), so the
          screen does not offer buttons that do nothing: it says who is waiting and opens the request in Services. */}
      {pendingResponses.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Pending responses</h2>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">Shaadi Shopping is waiting for your answer on these — tell your Shaadi Shopping contact whether you can do them.</p>
          <Card>
            {pendingResponses.map((p) => (
              <Row
                key={p.id}
                title={`${p.wedding} — ${p.function}`}
                meta={[p.requirement, p.price].filter(Boolean).join(' · ')}
                right={
                  <Link href="/vendor/services" className="text-xs font-semibold underline underline-offset-2">
                    Answer it
                  </Link>
                }
              />
            ))}
          </Card>
        </section>
      )}

      {/* Recent activity */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Recent activity</h2>
        <Card>
          {recentActivity.length === 0 ? (
            <p className="py-2 text-xs text-[var(--color-text-muted)]">No activity yet.</p>
          ) : (
            recentActivity.map((a) => <Row key={a.id} title={a.text} meta={a.when} />)
          )}
        </Card>
      </section>
    </div>
  );
}
