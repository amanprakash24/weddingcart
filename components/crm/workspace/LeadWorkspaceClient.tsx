'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SourceType } from '@/components/crm/types';
import type { LeadWorkspace } from './types';
import LeadWorkspaceHeader from './LeadWorkspaceHeader';
import type { StageTransitionInput } from './StageControl';
import CustomerCard from './CustomerCard';
import WeddingDetailsCard from './WeddingDetailsCard';
import VendorInterestPanel from './VendorInterestPanel';
import Timeline from './Timeline';
import TaskPanel from './TaskPanel';
import InsightsPanel from './InsightsPanel';

async function postJson(url: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await res.json();
  if (!res.ok || !payload.success) throw new Error(payload.error ?? 'Request failed');
}

export default function LeadWorkspaceClient({ sourceType, id }: { sourceType: SourceType; id: string }) {
  const [workspace, setWorkspace] = useState<LeadWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const basePath = `/api/crm/leads/${sourceType}/${id}`;

  const load = useCallback(() => {
    setLoading(true);
    fetch(basePath)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.success) throw new Error(body.error ?? 'Failed to load');
        setWorkspace(body.data);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [basePath]);

  // Deferred via setTimeout (matching CrmDashboardClient.tsx's fetchLeads
  // pattern) so the fetch-triggering setState isn't called synchronously
  // within the effect body itself (react-hooks/set-state-in-effect).
  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  // Each panel fails independently (per the plan) since the aggregate GET
  // succeeds/fails as one unit and every mutation just reloads that same
  // aggregate — no separate per-panel fetch to go stale or fail alone.
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
  const transitionStage = async (input: StageTransitionInput) => {
    await postJson(`${basePath}/stage`, input, 'PATCH');
    load();
  };
  const assign = async (assignedToId: string | null) => {
    await postJson(`${basePath}/assign`, { assignedToId }, 'PATCH');
    load();
  };

  // Only the initial load blanks the page — a mutation-triggered reload
  // (add note/task, complete task) keeps the current content visible and
  // swaps it in place once the refetch resolves, instead of flashing back
  // to a bare "Loading…" state (which, combined with every /admin page
  // still rendering the public Navbar/Footer, was jumping the scroll
  // position to the footer on every note/task submit).
  if (loading && !workspace) {
    return <div className="p-6 max-w-6xl mx-auto text-center text-gray-400 text-sm">Loading…</div>;
  }
  if (error || !workspace) {
    return <div className="p-6 max-w-6xl mx-auto text-center text-red-500 text-sm">{error ?? 'Not found'}</div>;
  }

  const customerName = workspace.customer.name ?? workspace.customer.phone;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <LeadWorkspaceHeader
        subject={workspace.subject}
        customerName={customerName}
        onTransition={transitionStage}
        onAssign={assign}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CustomerCard customer={workspace.customer} />
        <WeddingDetailsCard details={workspace.weddingDetails} />
      </div>

      <VendorInterestPanel vendorInterest={workspace.vendorInterest} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TaskPanel tasks={workspace.tasks} onAddTask={addTask} onCompleteTask={completeTask} />
        <InsightsPanel insights={workspace.insights} />
      </div>

      <Timeline activities={workspace.timeline} onAddNote={addNote} />
    </div>
  );
}
