'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TodaysWork from './TodaysWork';
import StatsCards from './StatsCards';
import LeadSearch from './LeadSearch';
import LeadFilters from './LeadFilters';
import LeadTable from './LeadTable';
import type { LeadInboxItem, LeadInboxStats, SalesRep, LeadFiltersState, PipelineStage, SourceType } from './types';

const PAGE_SIZE = 20;

// Filters/page live in the URL (not just component state) so that clicking
// into a Lead Workspace and pressing Back restores the exact same view —
// see the Sprint 5.2 plan's "Navigation + preserved filters/scroll" section.
function filtersFromParams(params: URLSearchParams): LeadFiltersState {
  return {
    search: params.get('search') ?? '',
    stage: (params.get('stage') as PipelineStage | '') ?? '',
    city: params.get('city') ?? '',
    assignedToId: params.get('assignedToId') ?? '',
    sourceType: (params.get('sourceType') as SourceType | '') ?? '',
  };
}

export default function CrmDashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stats, setStats] = useState<LeadInboxStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [items, setItems] = useState<LeadInboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(true);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [page, setPage] = useState(() => Math.max(1, parseInt(searchParams.get('page') ?? '1')));
  const [filters, setFilters] = useState<LeadFiltersState>(() => filtersFromParams(searchParams));

  // Mirror filters/page into the URL whenever they change, without adding a
  // history entry per keystroke/click (replace, not push).
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.stage) params.set('stage', filters.stage);
    if (filters.city) params.set('city', filters.city);
    if (filters.assignedToId) params.set('assignedToId', filters.assignedToId);
    if (filters.sourceType) params.set('sourceType', filters.sourceType);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    router.replace(qs ? `/admin/crm?${qs}` : '/admin/crm', { scroll: false });
  }, [filters, page, router]);

  useEffect(() => {
    fetch('/api/crm/stats')
      .then((r) => r.json())
      .then((d) => { if (d.success) setStats(d.data); })
      .finally(() => setStatsLoading(false));

    fetch('/api/crm/sales-reps')
      .then((r) => r.json())
      .then((d) => { if (d.success) setSalesReps(d.data); });
  }, []);

  const fetchLeads = useCallback(() => {
    setTableLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (filters.search) params.set('search', filters.search);
    if (filters.stage) params.set('stage', filters.stage);
    if (filters.city) params.set('city', filters.city);
    if (filters.assignedToId) params.set('assignedToId', filters.assignedToId);
    if (filters.sourceType) params.set('sourceType', filters.sourceType);

    fetch(`/api/crm/leads?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setItems(d.data);
          setTotal(d.pagination.total);
        }
      })
      .finally(() => setTableLoading(false));
  }, [page, filters]);

  // Debounce so search-as-you-type doesn't fire a request per keystroke.
  useEffect(() => {
    const timeout = setTimeout(fetchLeads, filters.search ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [fetchLeads, filters.search]);

  const handleFiltersChange = (next: LeadFiltersState) => {
    setPage(1);
    setFilters(next);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif]">CRM</h1>
        <p className="text-gray-500 text-sm mt-0.5">Lead Inbox — every inquiry, one pipeline</p>
      </div>

      <TodaysWork stats={stats} loading={statsLoading} />

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <LeadSearch value={filters.search} onChange={(search) => handleFiltersChange({ ...filters, search })} />
        <LeadFilters filters={filters} onChange={handleFiltersChange} salesReps={salesReps} />
      </div>

      <LeadTable items={items} loading={tableLoading} />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} result{total === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <StatsCards stats={stats} loading={statsLoading} />
    </div>
  );
}
