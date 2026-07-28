'use client';

import { PIPELINE_STAGES, STAGE_LABELS, SOURCE_LABELS, type LeadFiltersState, type SalesRep, type SourceType, type PipelineStage } from './types';

const selectClass =
  'px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-gray-50 focus:bg-white';

export default function LeadFilters({
  filters,
  onChange,
  salesReps,
}: {
  filters: LeadFiltersState;
  onChange: (next: LeadFiltersState) => void;
  salesReps: SalesRep[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <select
        className={selectClass}
        value={filters.stage}
        onChange={(e) => onChange({ ...filters, stage: e.target.value as PipelineStage | '' })}
      >
        <option value="">All Stages</option>
        {PIPELINE_STAGES.map((s) => (
          <option key={s} value={s}>{STAGE_LABELS[s]}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="City"
        value={filters.city}
        onChange={(e) => onChange({ ...filters, city: e.target.value })}
        className={`${selectClass} w-32`}
      />

      <select
        className={selectClass}
        value={filters.assignedToId}
        onChange={(e) => onChange({ ...filters, assignedToId: e.target.value })}
      >
        <option value="">All Sales Reps</option>
        {salesReps.map((rep) => (
          <option key={rep.id} value={rep.id}>{rep.name ?? rep.id}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.sourceType}
        onChange={(e) => onChange({ ...filters, sourceType: e.target.value as SourceType | '' })}
      >
        <option value="">All Sources</option>
        {(Object.entries(SOURCE_LABELS) as [SourceType, string][]).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}
