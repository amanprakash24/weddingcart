'use client';

import { useEffect, useState } from 'react';
import TodaysWork from '@/components/crm/TodaysWork';
import type { LeadInboxStats } from '@/components/crm/types';
import BusinessPerformanceCard from './BusinessPerformanceCard';
import CommissionCard from './CommissionCard';
import RevenueByMonthCard from './RevenueByMonthCard';
import PipelineHealthCard from './PipelineHealthCard';
import PipelineVelocityCard from './PipelineVelocityCard';
import VendorAvailabilityCard from './VendorAvailabilityCard';
import FollowUpHealthCard from './FollowUpHealthCard';
import TeamPerformanceCard from './TeamPerformanceCard';
import type { FounderDashboard } from './types';

// Today's Work stays on the existing Sprint 5.1 /api/crm/stats endpoint,
// unchanged — this page is additive, not a refactor of the CRM dashboard.
// The 6 Founder-specific sections come from one new aggregate endpoint,
// same "Workspace Loader" pattern as the Lead Workspace (Sprint 5.2).
export default function FounderDashboardClient() {
  const [stats, setStats] = useState<LeadInboxStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [dashboard, setDashboard] = useState<FounderDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetch('/api/crm/stats')
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setStats(d.data);
        })
        .finally(() => setStatsLoading(false));

      fetch('/api/crm/founder-dashboard')
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setDashboard(d.data);
        })
        .finally(() => setDashboardLoading(false));
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif]">Founder Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Is the business healthy today?</p>
      </div>

      <TodaysWork stats={stats} loading={statsLoading} />

      {dashboardLoading || !dashboard ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BusinessPerformanceCard revenue={dashboard.revenue} />
            <CommissionCard commission={dashboard.commission} />
          </div>

          <RevenueByMonthCard revenueByMonth={dashboard.revenueByMonth} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PipelineHealthCard pipelineHealth={dashboard.pipelineHealth} />
            <FollowUpHealthCard followUpHealth={dashboard.followUpHealth} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PipelineVelocityCard velocity={dashboard.velocity} />
            <VendorAvailabilityCard vendorAvailability={dashboard.vendorAvailability} />
          </div>

          <TeamPerformanceCard teamPerformance={dashboard.teamPerformance} />
        </>
      )}
    </div>
  );
}
