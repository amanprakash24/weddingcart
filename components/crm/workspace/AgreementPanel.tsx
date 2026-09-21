'use client';

import { useCallback, useEffect, useState } from 'react';
import AgreementCard, { type PaymentResult, type RecordPaymentInput } from '@/components/money/AgreementCard';
import type { AgreementMoneyView } from '@/lib/commercial/view';

const primary = 'min-h-10 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40';

// Money V1 in the CRM: before a wedding exists, the accepted quotation's agreement is paid against here. The same card as the wedding's
// Money tab — what was agreed, the 25% needed, what is in, whether the date is held — plus the way to record a payment. When the
// confirmation amount is in, the booking confirms itself (booking path); for a lead with no booking, staff create the wedding.
export default function AgreementPanel({
  quotationId, defaultRecording, onMoney, onChanged, onConfirm, onCreateWedding,
}: {
  quotationId: string;
  defaultRecording?: boolean;
  onMoney?: (money: AgreementMoneyView) => void;
  onChanged: () => Promise<unknown> | void;
  onConfirm: () => void;
  onCreateWedding: () => void;
}) {
  const [money, setMoney] = useState<AgreementMoneyView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotations/${quotationId}/agreement`);
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error ?? 'Could not load the payment details');
      setMoney(body.data);
      onMoney?.(body.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the payment details');
    }
  }, [quotationId, onMoney]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const record = async (input: RecordPaymentInput): Promise<PaymentResult> => {
    const res = await fetch(`/api/quotations/${quotationId}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error ?? 'Could not record the payment');
    await load();
    await onChanged();
    return body.data as PaymentResult;
  };

  if (error && !money) return <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!money) return <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-400">Loading payment details…</div>;

  return (
    <AgreementCard
      money={money}
      onRecordPayment={record}
      defaultRecording={defaultRecording}
      action={
        money.readyToConfirm ? (
          money.bookingId
            ? <button type="button" onClick={onConfirm} className={primary}>Confirm booking</button>
            : <button type="button" onClick={onCreateWedding} className={primary}>Create wedding</button>
        ) : null
      }
    />
  );
}
