import type { ReactNode } from 'react';
import type { VendorRow as VendorRowShape } from '@/lib/wedding/controlRoom';
import Button from './Button';
import StatusPill from './StatusPill';

export type RowVariant = 'default' | 'clickable' | 'selected' | 'disabled' | 'loading' | 'attention';

const VARIANT_CLASSES: Record<RowVariant, string> = {
  default: '',
  clickable: 'cursor-pointer hover:bg-[var(--color-bg-surface-muted)] rounded-lg px-2 -mx-2',
  selected: 'bg-[var(--color-primary-subtle-bg)] rounded-lg px-2 -mx-2',
  disabled: 'opacity-50 pointer-events-none',
  loading: '',
  attention: 'bg-[var(--color-warning-bg)] rounded-lg px-2 -mx-2',
};

export interface RowProps {
  title: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  variant?: RowVariant;
  onClick?: () => void;
}

export function Row({ title, meta, right, variant = 'default', onClick }: RowProps) {
  if (variant === 'loading') {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] py-3 last:border-b-0" aria-hidden>
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="skeleton h-4 w-1/3 rounded" />
          <div className="skeleton h-3 w-1/4 rounded" />
        </div>
      </div>
    );
  }

  const interactive = variant === 'clickable' || (variant === 'selected' && Boolean(onClick));
  const content = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
        {meta && <p className="truncate text-xs text-[var(--color-text-muted)]">{meta}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </>
  );
  const classes = `flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] py-3 last:border-b-0 transition-colors ${VARIANT_CLASSES[variant]}`;

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={`${classes} w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]`}>
        {content}
      </button>
    );
  }
  return (
    <div className={classes} aria-disabled={variant === 'disabled' || undefined}>
      {content}
    </div>
  );
}

// Imports the real state type from lib/wedding/controlRoom.ts (not redeclared) so this can never silently
// drift from what the Functions & Services tab actually produces.
export interface VendorRowProps {
  service: string;
  state: VendorRowShape['state'];
  vendorName?: string;
  amount?: string;
  declineReason?: string;
  onAssign?: () => void;
  onView?: () => void;
  onAssignReplacement?: () => void;
}

export function VendorRow({ service, state, vendorName, amount, declineReason, onAssign, onView, onAssignReplacement }: VendorRowProps) {
  if (state === 'unassigned') {
    return <Row title={service} meta="Needs a vendor" right={onAssign && <Button size="small" onClick={onAssign}>Assign</Button>} />;
  }
  if (state === 'pending') {
    return (
      <Row
        title={service}
        meta={vendorName ? `${vendorName} · Awaiting response` : 'Awaiting vendor response'}
        right={
          <>
            <StatusPill status="info">Awaiting response</StatusPill>
            {onView && <Button variant="outline" size="small" onClick={onView}>View</Button>}
          </>
        }
      />
    );
  }
  if (state === 'declined') {
    return (
      <Row
        title={service}
        meta={declineReason ? `Declined — ${declineReason}` : 'Declined'}
        right={
          <>
            <StatusPill status="overdue">Declined</StatusPill>
            {onAssignReplacement && (
              <Button variant="outline" size="small" onClick={onAssignReplacement}>
                Assign replacement
              </Button>
            )}
          </>
        }
      />
    );
  }
  // confirmed (covers both CONFIRMED and COMPLETED VendorBookingStatus — see controlRoom.ts)
  return (
    <Row
      title={service}
      meta={vendorName}
      right={
        <>
          <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{amount}</span>
          <StatusPill status="confirmed">Confirmed</StatusPill>
        </>
      }
    />
  );
}
