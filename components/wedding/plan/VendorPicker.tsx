'use client';

import { useEffect, useState } from 'react';

export type VendorHit = { id: string; name: string; city: string; category: string };

// Find a vendor by name (the same admin search the Plan tab uses) and pick one. Shows the pick, with a way to change it.
export default function VendorPicker({ picked, onPick, onClear }: { picked: VendorHit | null; onPick: (v: VendorHit) => void; onClear: () => void }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<VendorHit[]>([]);
  const searching = !picked && query.trim().length >= 2;

  useEffect(() => {
    if (!searching) return;
    const handle = setTimeout(() => {
      fetch(`/api/weddings/vendor-search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((body) => setHits(body.success ? body.data : []))
        .catch(() => setHits([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [searching, query]);

  if (picked) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
        <span className="min-w-0 truncate"><span className="font-medium text-gray-900">{picked.name}</span> <span className="text-gray-500">· {picked.category} · {picked.city}</span></span>
        <button type="button" onClick={() => { onClear(); setHits([]); }} className="shrink-0 text-xs text-gray-500 underline">Change</button>
      </div>
    );
  }
  const shown = searching ? hits : [];
  return (
    <>
      <input aria-label="Search vendors" placeholder="Search vendors by name…" value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-10 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      {shown.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
          {shown.map((h) => (
            <li key={h.id}><button type="button" onClick={() => onPick(h)} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"><span className="font-medium text-gray-900">{h.name}</span> <span className="text-gray-500">· {h.category} · {h.city}</span></button></li>
          ))}
        </ul>
      )}
      {searching && shown.length === 0 && <p className="text-xs text-gray-400">No vendor found yet — keep typing.</p>}
    </>
  );
}
