import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

export type CardVariant = 'default' | 'clickable' | 'selected' | 'highlighted' | 'attention';

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]',
  clickable: 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-default)] hover:shadow-md transition-shadow',
  selected: 'border-2 border-[var(--primary)] bg-[var(--color-primary-subtle-bg)]',
  // Gold stays a restrained accent (a left bar), never a fill — same rule as everywhere else in the system.
  highlighted: 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] border-l-4 border-l-[var(--gold)]',
  attention: 'border-[var(--color-warning-default)]/40 bg-[var(--color-warning-bg)]',
};

export interface CardProps {
  className?: string;
  children: ReactNode;
  variant?: CardVariant;
  /** Renders as a native <button> for full keyboard/click support. Only meaningful with variant="clickable" or "selected". */
  onClick?: () => void;
  'aria-hidden'?: boolean;
}

export function Card({ className = '', children, variant = 'default', onClick, ...rest }: CardProps) {
  const classes = `w-full rounded-2xl border p-4 text-left shadow-sm sm:p-6 ${VARIANT_CLASSES[variant]} ${className}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${classes} focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]`} {...rest}>
        {children}
      </button>
    );
  }
  return (
    <section className={classes} {...rest}>
      {children}
    </section>
  );
}

// Brief §37 — an empty state explains the next action, it doesn't just say "No data found."
export function CardEmptyState({ title, description, ctaLabel, onCta, icon }: { title: string; description?: string; ctaLabel?: string; onCta?: () => void; icon?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      {icon && <div className="text-[var(--color-text-muted)]">{icon}</div>}
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      {description && <p className="max-w-xs text-xs text-[var(--color-text-muted)]">{description}</p>}
      {ctaLabel && onCta && (
        <button type="button" onClick={onCta} className="mt-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]">
          {ctaLabel}
        </button>
      )}
    </Card>
  );
}

// Skeleton bars, not a spinner — matches the shipped .skeleton shimmer pattern in app/globals.css, reused
// here as fixed-width bars rather than full-width (a loading card's shape should hint at real content).
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card aria-hidden>
      <div className="flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="skeleton h-4 rounded" style={{ width: i === 0 ? '60%' : i === lines - 1 ? '40%' : '90%' }} />
        ))}
      </div>
    </Card>
  );
}

export interface NextActionCardProps {
  title: string;
  detail?: string;
  /** 'calm' when there's genuinely nothing urgent (brief §54 — routine open work is "Next Up", not "Needs Attention"). */
  tone: 'calm' | 'attention';
  ctaLabel?: string;
  onCta?: () => void;
  moreCount?: number;
}

// Generic version of components/wedding/control-room/NextActionCard.tsx's visual language (Playfair title,
// emerald calm state vs. amber/rose gradient attention state) without the wedding-specific coupling
// (ControlRoomView, ActionTarget, CoordinatorPicker) — that file stays the source of truth for the wedding
// Control Room; this is the reusable pattern for any other "next action" surface (Today, Venue Owner, etc.).
export function NextActionCard({ title, detail, tone, ctaLabel, onCta, moreCount = 0 }: NextActionCardProps) {
  const calm = tone === 'calm';
  return (
    <section
      aria-label="Next action"
      className={`rounded-2xl border p-4 sm:p-6 ${calm ? 'border-emerald-100 bg-emerald-50/60' : 'border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50'}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Next action</p>
      <h2 className="mt-1 font-playfair text-2xl font-bold leading-snug text-[var(--color-text-primary)] sm:text-3xl">{title}</h2>
      {detail && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{detail}</p>}
      {moreCount > 0 && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          {moreCount} more {moreCount === 1 ? 'thing needs' : 'things need'} attention — see below.
        </p>
      )}
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          {ctaLabel} <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      )}
    </section>
  );
}
