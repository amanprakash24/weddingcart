'use client';

import { useEffect, useState } from 'react';
import WorkOrderDocument from '@/components/workOrder/WorkOrderDocument';
import type { StaffWorkOrderView } from '@/services/vendorWorkOrder.service';

// Loads one work order through /api/weddings/[id]/work-orders/[woId] (money access checked there) and shows the printable document
// with the team's internal line. Print uses the browser's print (the internal line is hidden on paper).
export default function AdminWorkOrderClient({ weddingId, workOrderId }: { weddingId: string; workOrderId: string }) {
  const [wo, setWo] = useState<StaffWorkOrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/weddings/${weddingId}/work-orders/${workOrderId}`, { cache: 'no-store' })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!live) return;
        if (ok && j?.success) setWo(j.data);
        else setError(j?.error || 'Could not load the work order');
      })
      .catch(() => live && setError('Could not load the work order'));
    return () => {
      live = false;
    };
  }, [weddingId, workOrderId]);
  if (error) return <p role="alert" className="p-6 text-sm text-red-700">{error}</p>;
  if (!wo) return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  return (
    <div className="space-y-3 p-4 sm:p-6 print:p-0">
      <div className="mx-auto flex max-w-3xl justify-between gap-2 print:hidden">
        <a href={`/admin/weddings/${weddingId}?tab=functions`} className="text-sm font-medium text-gray-600 underline">Back to the wedding</a>
        <button type="button" onClick={() => window.print()} className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold">Print / save as PDF</button>
      </div>
      <WorkOrderDocument wo={wo} vendorName={wo.vendorName} showAmount internal={{ pricingModel: wo.pricingModel, clientPrice: wo.clientPrice, commissionRate: wo.commissionRate, commissionAmount: wo.commissionAmount, margin: wo.margin, historical: wo.historical }} />
    </div>
  );
}
