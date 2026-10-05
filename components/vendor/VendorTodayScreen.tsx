'use client';

// Vendor OS -> Today. First screen built on the Vivah OS component system (components/ui/*) for a role
// other than admin -- the point of this screen is to prove the system holds up outside the Wedding Control
// Room, not to ship Vendor OS. Presentational only: every prop has a concrete shape so real data can be
// wired in later without a rewrite, but this file itself does no fetching, no auth, no writes.
import { Card, CardEmptyState, NextActionCard } from '@/components/ui/Card';
import { Row } from '@/components/ui/Row';
import StatusPill, { type PillStatus } from '@/components/ui/StatusPill';
import Button from '@/components/ui/Button';

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
}

export interface UpcomingWeddingItem {
  id: string;
  wedding: string;
  date: string;
  function: string;
}

export interface PendingResponseItem {
  id: string;
  wedding: string;
  function: string;
  requirement: string;
  price: string;
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
  onAcceptResponse?: (id: string) => void;
  onDeclineResponse?: (id: string) => void;
}

const SERVICE_STATUS_PILL: Record<TodayServiceItem['status'], PillStatus> = { confirmed: 'confirmed', pending: 'info' };

export default function VendorTodayScreen({
  vendor, nextAction, attentionItems, todaysServices, upcomingWeddings, pendingResponses, recentActivity, onAcceptResponse, onDeclineResponse,
}: VendorTodayScreenProps) {
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
          <p className="text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">{upcomingWeddings.length}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">Upcoming weddings</p>
        </Card>
      </div>

      {/* Next action */}
      <NextActionCard {...nextAction} />

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
            {todaysServices.map((s) => (
              <Row
                key={s.id}
                title={`${s.wedding} — ${s.function}`}
                meta={`${s.time} · ${s.location}`}
                right={<StatusPill status={SERVICE_STATUS_PILL[s.status]}>{s.status === 'confirmed' ? 'Confirmed' : 'Awaiting confirmation'}</StatusPill>}
              />
            ))}
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
              <Row key={w.id} variant="clickable" title={w.wedding} meta={`${w.date} · ${w.function}`} onClick={() => {}} />
            ))}
          </Card>
        )}
      </section>

      {/* Pending responses */}
      {pendingResponses.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Pending responses</h2>
          <Card>
            {pendingResponses.map((p) => (
              <Row
                key={p.id}
                title={`${p.wedding} — ${p.function}`}
                meta={`${p.requirement} · ${p.price}`}
                right={
                  <>
                    <Button variant="outline" size="small" onClick={() => onDeclineResponse?.(p.id)}>
                      Decline
                    </Button>
                    <Button size="small" onClick={() => onAcceptResponse?.(p.id)}>
                      Accept
                    </Button>
                  </>
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
