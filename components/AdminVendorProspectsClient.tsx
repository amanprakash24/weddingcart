'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, Phone, Mail } from 'lucide-react';

type Status = 'NEW' | 'CONTACTED' | 'INTERESTED' | 'ONBOARDING' | 'ONBOARDED' | 'DECLINED' | 'ALREADY_LISTED';

interface ProspectRow {
  id: string;
  name: string;
  area: string | null;
  fullAddress: string | null;
  city: string;
  phone: string;
  email: string | null;
  contactPerson: string | null;
  seatingCapacity: number | null;
  maxCapacity: number | null;
  priceVegPerPlate: number | null;
  priceNonVegPerPlate: number | null;
  status: Status;
  notes: string | null;
  source: string;
  lastContactedAt: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  NEW: 'Not called',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  ONBOARDING: 'Onboarding',
  ONBOARDED: 'Onboarded',
  DECLINED: 'Declined',
  ALREADY_LISTED: 'Already listed',
};

const STATUS_STYLE: Record<Status, string> = {
  NEW: 'bg-gray-100 text-gray-600',
  CONTACTED: 'bg-blue-50 text-blue-700',
  INTERESTED: 'bg-amber-50 text-amber-700',
  ONBOARDING: 'bg-violet-50 text-violet-700',
  ONBOARDED: 'bg-emerald-50 text-emerald-700',
  DECLINED: 'bg-rose-50 text-rose-700',
  ALREADY_LISTED: 'bg-gray-100 text-gray-500',
};

const STATUSES = Object.keys(STATUS_LABEL) as Status[];
const PAGE_SIZE = 50;

function NotesCell({ prospect, onSave }: { prospect: ProspectRow; onSave: (notes: string) => void }) {
  const [value, setValue] = useState(prospect.notes ?? '');
  useEffect(() => setValue(prospect.notes ?? ''), [prospect.id, prospect.notes]);
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { if (value !== (prospect.notes ?? '')) onSave(value); }}
      placeholder="Add a note…"
      className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-lg px-2 py-1 text-xs bg-transparent focus:bg-white outline-none"
    />
  );
}

export default function AdminVendorProspectsClient() {
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Unfiltered counts per status, for the stats bar — same pattern as AdminVendorListClient's
  // allVendors/fetchStats split, so the summary doesn't shift when someone applies a filter.
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async () => {
    const res = await fetch('/api/vendor-prospects?limit=1');
    const data = await res.json();
    if (!data.success) return;
    const results = await Promise.all(STATUSES.map((s) => fetch(`/api/vendor-prospects?status=${s}&limit=1`).then((r) => r.json())));
    const next: Record<string, number> = { total: data.total };
    STATUSES.forEach((s, i) => { next[s] = results[i].success ? results[i].total : 0; });
    setCounts(next);
  }, []);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (cityFilter) params.set('city', cityFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/vendor-prospects?${params}`);
      const data = await res.json();
      if (data.success) { setProspects(data.data); setTotal(data.total); }
    } finally {
      setLoading(false);
    }
  }, [search, cityFilter, statusFilter, page]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { fetchProspects(); }, [fetchProspects]);
  useEffect(() => { setPage(1); }, [search, cityFilter, statusFilter]);

  const updateProspect = async (id: string, patch: { status?: Status; notes?: string }) => {
    setSavingId(id);
    const current = prospects.find((p) => p.id === id);
    if (!current) { setSavingId(null); return; }
    try {
      const res = await fetch(`/api/vendor-prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: patch.status ?? current.status, notes: patch.notes }),
      });
      const data = await res.json();
      if (data.success) {
        setProspects((rows) => rows.map((r) => (r.id === id ? { ...r, ...data.data } : r)));
        fetchCounts();
      }
    } finally {
      setSavingId(null);
    }
  };

  const cities = [...new Set(prospects.map((p) => p.city))].sort();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif]">Vendor Prospects</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Outreach list — not yet real vendors. Contact info only; description/photos are never copied from the source.
            </p>
          </div>
          <button onClick={() => { fetchProspects(); fetchCounts(); }} disabled={loading}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-xl text-sm hover:bg-white transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{counts.total ?? '—'}</p>
          </div>
          {STATUSES.map((s) => (
            <div key={s} className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{STATUS_LABEL[s]}</p>
              <p className="text-2xl font-bold text-gray-700 mt-0.5">{counts[s] ?? '—'}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, area…"
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-white" />
          </div>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
            <option value="">All Cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Loading prospects...</p>
            </div>
          ) : prospects.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-gray-500 font-medium">No prospects match these filters</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Venue</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Capacity / Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors align-top">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 line-clamp-1">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{[p.area, p.city].filter(Boolean).join(', ')}</p>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell text-gray-600">
                      <p className="flex items-center gap-1.5 text-xs"><Phone className="w-3 h-3 text-gray-400" />{p.phone}</p>
                      {p.email && <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5"><Mail className="w-3 h-3" />{p.email}</p>}
                      {p.contactPerson && <p className="text-xs text-gray-400 mt-0.5">{p.contactPerson}</p>}
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell text-gray-500 text-xs">
                      {p.seatingCapacity ? <p>{p.seatingCapacity}–{p.maxCapacity ?? p.seatingCapacity} guests</p> : null}
                      {p.priceVegPerPlate ? <p>₹{p.priceVegPerPlate}/plate veg</p> : null}
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={p.status}
                        disabled={savingId === p.id}
                        onChange={(e) => updateProspect(p.id, { status: e.target.value as Status })}
                        className={`text-xs font-semibold px-2 py-1 rounded-full border-0 outline-none ${STATUS_STYLE[p.status]}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell w-48">
                      <NotesCell prospect={p} onSave={(notes) => updateProspect(p.id, { notes })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4 text-sm text-gray-500">
            <button onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-white">Previous</button>
            <span>Page {page} of {totalPages} ({total} total)</span>
            <button onClick={() => setPage((n) => Math.min(totalPages, n + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-white">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
