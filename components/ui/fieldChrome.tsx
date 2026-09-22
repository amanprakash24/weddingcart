import type { ReactNode } from 'react';

// Shared label + helper/error wrapper for Input, Select, Textarea — not a component of its own in the
// brief's list, just the DRY seam so those three don't each reimplement the same chrome.
export function FieldShell({ label, htmlFor, message, error, children }: { label?: string; htmlFor: string; message?: string; error?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--color-text-secondary)]">
          {label}
        </label>
      )}
      {children}
      {message && (
        <p id={`${htmlFor}-message`} className={`text-[11px] ${error ? 'text-[var(--color-danger-text)]' : 'text-[var(--color-text-muted)]'}`}>
          {message}
        </p>
      )}
    </div>
  );
}

// Disabled = grayed out, not interactive, content de-emphasized. Read-only = still legible/selectable
// full-color text, just not editable — the two are visually distinct on purpose (common UX convention).
export function fieldStateClasses({ error, readOnly }: { error?: boolean; readOnly?: boolean }) {
  const border = error
    ? 'border-[var(--color-danger-default)] focus:ring-2 focus:ring-[var(--color-danger-default)]/30'
    : 'border-[var(--color-border-default)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20';
  const readOnlyBg = readOnly ? 'read-only:bg-[var(--color-bg-surface-muted)] read-only:text-[var(--color-text-primary)]' : '';
  return `${border} ${readOnlyBg} disabled:cursor-not-allowed disabled:bg-[var(--color-bg-surface-muted)] disabled:text-[var(--color-text-disabled)]`;
}
