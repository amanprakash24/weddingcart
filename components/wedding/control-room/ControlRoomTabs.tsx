'use client';

export type TabKey = 'overview' | 'plan' | 'functions' | 'money' | 'people' | 'files';

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'plan', label: 'Plan' },
  { key: 'functions', label: 'Functions & Services' },
  { key: 'money', label: 'Money' },
  { key: 'people', label: 'People' },
  { key: 'files', label: 'Files & History' },
];

export function isTabKey(value: string | null | undefined): value is TabKey {
  return TABS.some((t) => t.key === value);
}

// Six places, one at a time — instead of ten anchors on one long page. A dot marks a tab where something needs attention.
export default function ControlRoomTabs({ active, attention, onChange }: { active: TabKey; attention: Partial<Record<TabKey, number>>; onChange: (key: TabKey) => void }) {
  return (
    // On a phone the six tabs sit in two rows of three — a sideways-scrolling strip hid "Money", "People" and "Files" off the
    // screen with no sign they were there (found 26 Nov 2026). From sm up they are one row again.
    <nav aria-label="Wedding sections" className="sticky top-0 z-10 rounded-xl border border-gray-100 bg-white/95 p-1.5 shadow-sm backdrop-blur sm:overflow-x-auto sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
      <div role="tablist" className="grid grid-cols-3 gap-1 sm:flex sm:min-w-max">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            className={`relative min-h-11 rounded-lg px-2 py-2 text-center text-[13px] font-medium leading-tight transition-colors sm:min-h-10 sm:whitespace-nowrap sm:px-3.5 sm:text-sm ${active === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {t.label}
            {(attention[t.key] ?? 0) > 0 && active !== t.key && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500" aria-label="needs attention" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
