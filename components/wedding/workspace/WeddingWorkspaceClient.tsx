'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Timeline from '@/components/crm/workspace/Timeline';
import WeddingTasks, { type NewTask, type TaskPatch } from '@/components/wedding/plan/WeddingTasks';
import VendorsToSortOut, { type AssignInput } from '@/components/wedding/plan/VendorsToSortOut';
import type { StaffMember } from '@/components/wedding/plan/CoordinatorPicker';
import ControlRoomHeader from '@/components/wedding/control-room/ControlRoomHeader';
import Overview from '@/components/wedding/control-room/Overview';
import ControlRoomTabs, { isTabKey, type TabKey } from '@/components/wedding/control-room/ControlRoomTabs';
import { buildControlRoom } from '@/lib/wedding/controlRoom';
import type { ActionTarget } from '@/lib/wedding/stage';
import CoupleCard from './CoupleCard';
import WeddingEvents from './WeddingEvents';
import TimelineMilestones from './TimelineMilestones';
import Documents from './Documents';
import Finance from './Finance';
import type { WeddingWorkspace, WeddingStatus, VendorBookingStatus, MilestoneStatus, CreateInvoiceInput } from './types';
import ServiceRequirements from './ServiceRequirements';
import Approvals from './Approvals';
import GuestRsvp from './GuestRsvp';

type Approval = {
  id: string; subjectType: string; title: string | null; description: string | null; amount: number | null;
  deadline: string | null; status: string; clientComment: string | null;
  weddingEvent: { id: string; label: string | null; type: string } | null;
};

// The tab in the address (?tab=money), so a link or a refresh lands where you were.
function readTab(): TabKey {
  if (typeof window === 'undefined') return 'overview';
  const t = new URLSearchParams(window.location.search).get('tab');
  return isTabKey(t) ? t : 'overview';
}

async function postJson(url: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await res.json();
  if (!res.ok || !payload.success) throw new Error(payload.error ?? 'Request failed');
}

// Same Workspace Loader philosophy as LeadWorkspaceClient.tsx: one aggregate
// GET, every mutation just reloads it. Timeline/TaskPanel/InsightsPanel are
// reused directly from components/crm/workspace/ — their shapes
// (WorkspaceActivity/WorkspaceTask/WorkspaceInsight) already match what this
// Workspace needs, no reason to duplicate them.
export default function WeddingWorkspaceClient({ id }: { id: string }) {
  const [workspace, setWorkspace] = useState<WeddingWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [tab, setTab] = useState<TabKey>(readTab);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  const basePath = `/api/weddings/${id}`;

  // Returns the reload's promise, so an action can stay on "Saving…" until the screen shows the refreshed result.
  const load = useCallback((): Promise<void> => {
    setLoading(true);
    return fetch(`${basePath}/workspace`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.success) throw new Error(body.error ?? 'Failed to load');
        setWorkspace(body.data);
        fetch(`${basePath}/approvals`).then((r) => r.json()).then((approvalBody) => {
          if (approvalBody.success) setApprovals(approvalBody.data);
        });
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [basePath]);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  // The team, for the coordinator picker and task owners (the same list the lead pages use).
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetch('/api/crm/sales-reps').then((r) => r.json()).then((body) => { if (body.success) setStaff(body.data); }).catch(() => undefined);
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  const addNote = async (detail: string) => {
    await postJson(`${basePath}/notes`, { detail });
    load();
  };
  const addTask = async (task: NewTask) => {
    await postJson(`${basePath}/tasks`, task);
    await load();
  };
  const updateTask = async (taskId: string, patch: TaskPatch) => {
    await postJson(`${basePath}/tasks/${taskId}`, patch, 'PATCH');
    await load();
  };
  const assignCoordinator = async (coordinatorId: string | null) => {
    await postJson(`${basePath}/coordinator`, { coordinatorId }, 'PATCH');
    await load();
  };
  const confirmVendor = async (vbId: string) => {
    await postJson(`${basePath}/vendor-bookings/${vbId}`, { status: 'CONFIRMED' }, 'PATCH');
    await load();
  };
  const declineVendor = async (vbId: string, declineReason: string) => {
    await postJson(`${basePath}/vendor-bookings/${vbId}`, { status: 'DECLINED', declineReason: declineReason || undefined }, 'PATCH');
    await load();
  };
  const assignVendor = async (input: AssignInput) => {
    await postJson(`${basePath}/vendor-bookings`, input);
    await load();
  };
  const transitionStatus = async (toStatus: WeddingStatus) => {
    await postJson(`${basePath}/status`, { toStatus }, 'PATCH');
    load();
  };
  const updateVendorBookingStatus = async (vbId: string, status: VendorBookingStatus, declineReason?: string, onTimeService?: boolean) => {
    await postJson(`${basePath}/vendor-bookings/${vbId}`, { status, declineReason, onTimeService }, 'PATCH');
    load();
  };
  const addVendorBooking = async (weddingEventId: string, vendorId: string, agreedPrice: number) => {
    await postJson(`${basePath}/vendor-bookings`, { weddingEventId, vendorId, agreedPrice });
    load();
  };
  const calculatePayout = async (vbId: string) => {
    await postJson(`${basePath}/vendor-bookings/${vbId}/payout`, {});
    load();
  };
  const markPayoutPaid = async (payoutId: string) => {
    await postJson(`${basePath}/payouts/${payoutId}`, { status: 'PAID' }, 'PATCH');
    load();
  };
  const createInvoice = async (input: CreateInvoiceInput) => {
    await postJson(`${basePath}/invoices`, input);
    load();
  };
  const generatePaymentLink = async (invoiceId: string) => {
    await postJson(`${basePath}/invoices/${invoiceId}/payment-link`, {});
    load();
  };
  const issueInvoice = async (invoiceId: string) => {
    await postJson(`${basePath}/invoices/${invoiceId}/issue`, {});
    load();
  };
  const createBalanceInvoice = async () => {
    await postJson(`${basePath}/invoices/balance`, {});
    load();
  };
  const recordPayment = async (invoiceId: string, input: { amount: number; method: string; reference?: string }) => {
    await postJson(`${basePath}/invoices/${invoiceId}/payments`, input);
    load();
  };
  const updateMilestoneStatus = async (milestoneId: string, status: MilestoneStatus) => {
    await postJson(`${basePath}/milestones/${milestoneId}`, { status }, 'PATCH');
    load();
  };
  const saveCouple = async (input: { brideName?: string; groomName?: string; bridePhone?: string; groomPhone?: string }) => {
    await postJson(`${basePath}/couple`, input, 'PATCH');
    load();
  };

  const view = useMemo(() => (workspace ? buildControlRoom(workspace) : null), [workspace]);
  // A dot on the tabs where something needs attention — the same list as "Needs attention" on the Overview.
  const attention = useMemo(() => {
    const counts: Partial<Record<TabKey, number>> = {};
    for (const a of view?.attention ?? []) if (a.target !== 'overview') counts[a.target as ActionTarget & TabKey] = (counts[a.target as ActionTarget & TabKey] ?? 0) + 1;
    return counts;
  }, [view]);
  const changeTab = (next: TabKey) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'overview') url.searchParams.delete('tab'); else url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0 });
  };

  if (loading && !workspace) {
    return <div className="p-6 max-w-6xl mx-auto text-center text-gray-400 text-sm">Loading…</div>;
  }
  if (error || !workspace || !view) {
    return <div className="p-6 max-w-6xl mx-auto text-center text-red-500 text-sm">{error ?? 'Not found'}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-6">
      <ControlRoomHeader view={view} staff={staff} coordinatorId={workspace.wedding.coordinatorId ?? null} onAssignCoordinator={assignCoordinator} onTransition={transitionStatus} />

      <ControlRoomTabs active={tab} attention={attention} onChange={changeTab} />

      {tab === 'overview' && <Overview view={view} staff={staff} coordinatorId={workspace.wedding.coordinatorId ?? null} onAssignCoordinator={assignCoordinator} onOpen={(target) => changeTab(target === 'overview' ? 'overview' : (target as TabKey))} onTransition={transitionStatus} />}

      {tab === 'plan' && (
        <div className="space-y-4">
          <VendorsToSortOut rows={view.vendors} onConfirm={confirmVendor} onDecline={declineVendor} onAssign={assignVendor} />
          <WeddingTasks tasks={workspace.tasks} events={workspace.events} staff={staff} coordinatorId={workspace.wedding.coordinatorId ?? null} onAdd={addTask} onUpdate={updateTask} />
          {workspace.timeline.length > 0 && <TimelineMilestones milestones={workspace.timeline} onUpdateStatus={updateMilestoneStatus} />}
          <Approvals weddingId={id} events={workspace.events} approvals={approvals} onChange={load} />
        </div>
      )}

      {tab === 'functions' && (
        <div className="space-y-4">
          <WeddingEvents events={workspace.events} onUpdateVendorBookingStatus={updateVendorBookingStatus} onAddVendorBooking={addVendorBooking} onCalculatePayout={calculatePayout} onMarkPayoutPaid={markPayoutPaid} />
          <ServiceRequirements events={workspace.events} />
        </div>
      )}

      {tab === 'money' && <Finance weddingId={id} finance={workspace.finance} onCreateInvoice={createInvoice} onGeneratePaymentLink={generatePaymentLink} onIssueInvoice={issueInvoice} onCreateBalanceInvoice={createBalanceInvoice} onRecordPayment={recordPayment} />}

      {tab === 'people' && (
        <div className="space-y-4">
          <CoupleCard couple={workspace.couple} onSave={saveCouple} />
          <GuestRsvp weddingId={id} events={workspace.events} initialGuests={workspace.guests} />
        </div>
      )}

      {tab === 'files' && (
        <div className="space-y-4">
          <Documents documents={workspace.documents} />
          <Timeline activities={workspace.activity} onAddNote={addNote} />
        </div>
      )}
    </div>
  );
}
