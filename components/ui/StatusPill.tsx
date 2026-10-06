import type { ReactNode } from 'react';

export type PillStatus = 'confirmed' | 'dateHeld' | 'overdue' | 'info' | 'neutral';

const STATUS_CLASSES: Record<PillStatus, string> = {
  confirmed: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
  dateHeld: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  overdue: 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
  info: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  neutral: 'bg-[var(--color-bg-surface-muted)] text-[var(--color-text-secondary)]',
};

// Human-language status wording only (brief §36) — never render a raw enum like BOOKING_CONFIRMED here.
export default function StatusPill({ status, children }: { status: PillStatus; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[status]}`}>
      {children}
    </span>
  );
}
