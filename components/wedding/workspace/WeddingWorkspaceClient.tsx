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

  const basePath = `/api/weddings/${id}`;

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${basePath}/workspace`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.success) throw new Error(body.error ?? 'Failed to load');
        setWorkspace(body.data);
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
  const updateVendorBookingStatus = async (vbId: string, status: VendorBookingStatus, declineReason?: string) => {
    await postJson(`${basePath}/vendor-bookings/${vbId}`, { status, declineReason }, 'PATCH');
    load();
  };
  const addVendorBooking = async (weddingEventId: string, vendorId: string, agreedPrice: number) => {
    await postJson(`${basePath}/vendor-bookings`, { weddingEventId, vendorId, agreedPrice });
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
      <WeddingHeader wedding={workspace.wedding} health={workspace.health} onTransition={transitionStatus} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CoupleCard couple={workspace.couple} onSave={saveCouple} />
        <Documents documents={workspace.documents} />
      </div>

      <WeddingEvents
        events={workspace.events}
        onUpdateVendorBookingStatus={updateVendorBookingStatus}
        onAddVendorBooking={addVendorBooking}
      />

      <Finance
        weddingId={id}
        finance={workspace.finance}
        onCreateInvoice={createInvoice}
        onGeneratePaymentLink={generatePaymentLink}
      />

      <TimelineMilestones milestones={workspace.timeline} onUpdateStatus={updateMilestoneStatus} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TaskPanel tasks={workspace.tasks} onAddTask={addTask} onCompleteTask={completeTask} />
        <InsightsPanel insights={workspace.insights} />
      </div>

      <Timeline activities={workspace.activity} onAddNote={addNote} />
    </div>
  );
}
