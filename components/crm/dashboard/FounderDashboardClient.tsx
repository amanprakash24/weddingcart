'use client';

import { useEffect, useState } from 'react';
import BusinessPerformanceCard from './BusinessPerformanceCard';
import CommissionCard from './CommissionCard';
import RevenueByMonthCard from './RevenueByMonthCard';
import PipelineHealthCard from './PipelineHealthCard';
import PipelineVelocityCard from './PipelineVelocityCard';
import VendorAvailabilityCard from './VendorAvailabilityCard';
import FollowUpHealthCard from './FollowUpHealthCard';
import TeamPerformanceCard from './TeamPerformanceCard';
import type { FounderDashboard } from './types';
import CommandCenter from './CommandCenter';

// The Command Center and Founder-specific sections come from one aggregate endpoint,
// same "Workspace Loader" pattern as the Lead Workspace (Sprint 5.2).
export default function FounderDashboardClient() {
  const [dashboard, setDashboard] = useState<FounderDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
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
      {dashboardLoading || !dashboard ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">Loading…</div>
      ) : (
        <>
          <CommandCenter data={dashboard.commandCenter} />

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
