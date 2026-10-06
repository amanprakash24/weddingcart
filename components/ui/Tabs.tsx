'use client';

export interface TabItem<K extends string> {
  key: K;
  label: string;
}

export interface TabsProps<K extends string> {
  tabs: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  attention?: Partial<Record<K, number>>;
  disabledKeys?: K[];
  ariaLabel?: string;
}

// Generic version of the pattern in components/wedding/control-room/ControlRoomTabs.tsx — that one is
// wedding-specific (fixed six-tab list, no disabled state); this is the reusable primitive for any tabbed
// section. Active state uses the brand primary (maroon) per the Phase 2 token decision — ControlRoomTabs.tsx
// still uses bg-gray-900 and should migrate to this component in a follow-up, not silently changed here.
//
// Overflow: horizontal scroll with a hidden scrollbar (same as ControlRoomTabs) — deliberately not adding
// fade edges or arrow controls, since the shipped pattern already handles it and this stays consistent.
// Mobile: min-h-11 (44px) touch target, one step larger than ControlRoomTabs' min-h-10 — an accessibility
// correction made here, not applied to the shipped file per the "don't redesign it" instruction.
export default function Tabs<K extends string>({ tabs, active, onChange, attention = {}, disabledKeys = [], ariaLabel = 'Sections' }: TabsProps<K>) {
  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-0 z-10 overflow-x-auto rounded-xl border border-[var(--color-border-subtle)] bg-white/95 p-1.5 shadow-sm backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div role="tablist" className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const isDisabled = disabledKeys.includes(t.key);
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active === t.key}
              aria-disabled={isDisabled || undefined}
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(t.key)}
              className={`relative min-h-11 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
                active === t.key ? 'bg-[var(--primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-muted)]'
              }`}
            >
              {t.label}
              {!isDisabled && (attention[t.key] ?? 0) > 0 && active !== t.key && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--color-warning-default)]" aria-label="needs attention" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
