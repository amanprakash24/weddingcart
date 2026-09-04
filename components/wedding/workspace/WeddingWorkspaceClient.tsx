'use client';

import { useCallback, useEffect, useState } from 'react';
import Timeline from '@/components/crm/workspace/Timeline';
import TaskPanel from '@/components/crm/workspace/TaskPanel';
import InsightsPanel from '@/components/crm/workspace/InsightsPanel';
import WeddingHeader from './WeddingHeader';
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

const NAV_ITEMS = [
  ['overview', 'Overview'], ['functions', 'Functions'], ['services', 'Services'],
  ['tasks', 'Tasks'], ['timeline', 'Timeline'], ['finance', 'Finance'],
  ['documents', 'Documents'], ['approvals', 'Approvals'], ['guests', 'Guests & RSVP'], ['activity', 'Activity'],
];

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

  const basePath = `/api/weddings/${id}`;

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${basePath}/workspace`)
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

  const addNote = async (detail: string) => {
    await postJson(`${basePath}/notes`, { detail });
    load();
  };
  const addTask = async (title: string) => {
    await postJson(`${basePath}/tasks`, { title });
    load();
  };
  const completeTask = async (taskId: string, status: 'DONE' | 'CANCELLED') => {
    await postJson(`${basePath}/tasks/${taskId}`, { status }, 'PATCH');
    load();
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
  const updateMilestoneStatus = async (milestoneId: string, status: MilestoneStatus) => {
    await postJson(`${basePath}/milestones/${milestoneId}`, { status }, 'PATCH');
    load();
  };
  const saveCouple = async (input: { brideName?: string; groomName?: string; bridePhone?: string; groomPhone?: string }) => {
    await postJson(`${basePath}/couple`, input, 'PATCH');
    load();
  };

  if (loading && !workspace) {
    return <div className="p-6 max-w-6xl mx-auto text-center text-gray-400 text-sm">Loading…</div>;
  }
  if (error || !workspace) {
    return <div className="p-6 max-w-6xl mx-auto text-center text-red-500 text-sm">{error ?? 'Not found'}</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <WeddingHeader wedding={workspace.wedding} health={workspace.health} outstanding={workspace.finance.totals.outstanding} onTransition={transitionStatus} />

      <nav aria-label="Event workspace sections" className="sticky top-0 z-10 -mx-2 overflow-x-auto rounded-xl border border-gray-100 bg-white/95 p-2 shadow-sm backdrop-blur">
        <div className="flex min-w-max gap-1">
          {NAV_ITEMS.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-rose-50 hover:text-rose-700">{label}</a>)}
        </div>
      </nav>

      <section id="overview" className="scroll-mt-16 rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="mb-3 text-lg font-bold text-gray-900">Event overview</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs uppercase text-gray-400">What&apos;s next</p><p className="font-medium text-gray-900">{workspace.tasks.find((task) => task.status !== 'DONE' && task.status !== 'CANCELLED')?.title || 'No open tasks'}</p></div>
          <div><p className="text-xs uppercase text-gray-400">Functions</p><p className="font-medium text-gray-900">{workspace.events.length || 'None added yet'}</p></div>
          <div><p className="text-xs uppercase text-gray-400">Services booked</p><p className="font-medium text-gray-900">{workspace.events.reduce((sum, event) => sum + event.vendorBookings.length, 0)}</p></div>
          <div><p className="text-xs uppercase text-gray-400">Payments</p><p className="font-medium text-gray-900">{workspace.finance.totals.collected > 0 ? `₹${workspace.finance.totals.collected.toLocaleString('en-IN')} collected` : 'No payments recorded'}</p></div>
        </div>
      </section>

      <section id="documents" className="scroll-mt-16 grid grid-cols-1 gap-4 md:grid-cols-2">
        <CoupleCard couple={workspace.couple} onSave={saveCouple} />
        <Documents documents={workspace.documents} />
      </section>

      <section id="functions" className="scroll-mt-16"><WeddingEvents events={workspace.events} onUpdateVendorBookingStatus={updateVendorBookingStatus} onAddVendorBooking={addVendorBooking} onCalculatePayout={calculatePayout} onMarkPayoutPaid={markPayoutPaid} /></section>

      <section id="services" className="scroll-mt-16"><ServiceRequirements events={workspace.events} /></section>

      <section id="approvals" className="scroll-mt-16"><Approvals weddingId={id} events={workspace.events} approvals={approvals} onChange={load} /></section>

      <section id="guests" className="scroll-mt-16"><GuestRsvp weddingId={id} events={workspace.events} initialGuests={workspace.guests} /></section>

      <section id="finance" className="scroll-mt-16"><Finance weddingId={id} finance={workspace.finance} onCreateInvoice={createInvoice} onGeneratePaymentLink={generatePaymentLink} /></section>

      <section id="timeline" className="scroll-mt-16"><TimelineMilestones milestones={workspace.timeline} onUpdateStatus={updateMilestoneStatus} /></section>

      <section id="tasks" className="scroll-mt-16 grid grid-cols-1 gap-4 md:grid-cols-2">
        <TaskPanel tasks={workspace.tasks} onAddTask={addTask} onCompleteTask={completeTask} />
        <InsightsPanel insights={workspace.insights} />
      </section>

      <section id="activity" className="scroll-mt-16"><Timeline activities={workspace.activity} onAddNote={addNote} /></section>
    </div>
  );
}
