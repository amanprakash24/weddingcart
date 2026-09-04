// Mirrors services/founderDashboard.service.ts's FounderDashboard — plain
// numbers/strings throughout, nothing needs Date-to-string translation beyond
// what the service already does for vendorAvailability.date.
import type { PipelineStage } from '@/components/crm/types';
import type { CommandCenter } from '@/services/commandCenter.service';

export interface FounderDashboard {
  commandCenter: CommandCenter;
  revenue: {
    outstanding: number;
    totalCollected: number;
    invoicedThisMonth: { count: number; total: number };
    paymentsToday: number;
  };
  commission: {
    confirmed: number;
    pendingWeddings: number;
    expected: number;
    outstandingPayoutAmount: number;
    pendingPayoutCount: number;
    grossMargin: number;
  };
  revenueByMonth: { month: string; total: number }[];
  pipelineHealth: { newThisWeek: number; convertedThisWeek: number; lostThisWeek: number; onHold: number };
  velocity: { stage: PipelineStage; avgDays: number | null; sampleSize: number }[];
  vendorAvailability: { date: string; categories: { category: string; counts: Record<string, number> }[] };
  followUpHealth: { dueToday: number; overdue: number; completedToday: number };
  teamPerformance: { userId: string | null; name: string; open: number; wonThisMonth: number; lostThisMonth: number }[];
}
