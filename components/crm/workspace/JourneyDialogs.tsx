'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { NOT_PROCEEDING_REASONS, type NotProceedingKey } from '@/lib/crm/notProceeding';

// The small confirmations behind the journey's actions. On a phone they slide up as a bottom sheet; on a larger screen they
// are a centred dialog. Each one's `onSave` resolves to an error message to show, or null when it worked (the parent then
// closes it). Nothing is sent to the customer from here.

const CHANNELS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'PHONE', label: 'Phone call' },
  { value: 'IN_PERSON', label: 'In person' },
  { value: 'OTHER', label: 'Other' },
] as const;

const inputClass =
  'w-full min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100';

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl md:max-w-lg md:rounded-2xl md:pb-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold text-gray-900 font-[Playfair_Display,serif]">{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4">{children}</div>
      </div>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}
const secondaryBtn = 'min-h-[46px] rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50';
const primaryBtn = 'min-h-[46px] rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-5 text-sm font-semibold text-white disabled:opacity-50';
const dangerBtn = 'min-h-[46px] rounded-xl bg-red-700 px-5 text-sm font-semibold text-white disabled:opacity-50';

function useSubmit(onSave: () => Promise<string | null>) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const failure = await onSave();
      if (failure) setError(failure);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, submit };
}
const ErrorLine = ({ error }: { error: string | null }) => (error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null);

export function AcceptDialog({ customerName, onSave, onClose }: { customerName: string; onSave: (channel: string, note: string) => Promise<string | null>; onClose: () => void }) {
  const [channel, setChannel] = useState<string>('WHATSAPP');
  const [note, setNote] = useState('');
  const { saving, error, submit } = useSubmit(() => onSave(channel, note));
  return (
    <Modal title={`Record ${customerName}’s acceptance`} onClose={onClose}>
      <p className="text-sm text-gray-600">Write down how they said yes. This does not confirm the booking.</p>
      <div className="grid gap-2" role="radiogroup" aria-label="How did they accept?">
        {CHANNELS.map((c) => (
          <label key={c.value} className={`flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm ${channel === c.value ? 'border-rose-400 bg-rose-50' : 'border-gray-200'}`}>
            <input type="radio" name="accept-channel" checked={channel === c.value} onChange={() => setChannel(c.value)} className="h-4 w-4 accent-rose-600" />
            {c.label}
          </label>
        ))}
      </div>
      <label className="grid gap-1 text-xs font-semibold text-gray-500">
        Note (optional)
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What they said" />
      </label>
      <ErrorLine error={error} />
      <Actions>
        <button type="button" className={secondaryBtn} onClick={onClose}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save acceptance'}</button>
      </Actions>
    </Modal>
  );
}

export function DeclineDialog({ customerName, onSave, onClose }: { customerName: string; onSave: (reason: string) => Promise<string | null>; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const { saving, error, submit } = useSubmit(() => onSave(reason));
  return (
    <Modal title={`${customerName} declined the quote`} onClose={onClose}>
      <p className="text-sm text-gray-600">Say why, in a few words. The quote is kept as a record and you can revise it.</p>
      <label className="grid gap-1 text-xs font-semibold text-gray-500">
        Reason
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Found a cheaper caterer" />
      </label>
      <ErrorLine error={error} />
      <Actions>
        <button type="button" className={secondaryBtn} onClick={onClose}>Cancel</button>
        <button type="button" className={dangerBtn} disabled={saving || !reason.trim()} onClick={submit}>{saving ? 'Saving…' : 'Record decline'}</button>
      </Actions>
    </Modal>
  );
}

export interface BookingDefaults {
  weddingDate: string; // YYYY-MM-DD, or '' when the source has no clear date
  guestCount: string;
  city: string;
}

export function BookingDialog({ defaults, onSave, onClose }: { defaults: BookingDefaults; onSave: (values: BookingDefaults) => Promise<string | null>; onClose: () => void }) {
  const [values, setValues] = useState(defaults);
  const { saving, error, submit } = useSubmit(() => onSave(values));
  return (
    <Modal title="Create the booking" onClose={onClose}>
      <p className="text-sm text-gray-600">The booking takes its services and prices from the accepted quotation. Only fill in what is missing.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs font-semibold text-gray-500">
          Wedding date
          <input className={inputClass} type="date" value={values.weddingDate} onChange={(e) => setValues({ ...values, weddingDate: e.target.value })} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-gray-500">
          Guests
          <input className={inputClass} inputMode="numeric" value={values.guestCount} onChange={(e) => setValues({ ...values, guestCount: e.target.value })} />
        </label>
      </div>
      <label className="grid gap-1 text-xs font-semibold text-gray-500">
        City
        <input className={inputClass} value={values.city} onChange={(e) => setValues({ ...values, city: e.target.value })} />
      </label>
      <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">The booking will show as <b>Pending</b> until you confirm it.</p>
      <ErrorLine error={error} />
      <Actions>
        <button type="button" className={secondaryBtn} onClick={onClose}>Cancel</button>
        <button type="button" className={primaryBtn} disabled={saving} onClick={submit}>{saving ? 'Creating…' : 'Create booking'}</button>
      </Actions>
    </Modal>
  );
}

// What confirming really does (services/weddingConversion.service.ts): the wedding workspace, a confirmation task per vendor, and the
// booking's invoices (already carrying the payments) move onto the wedding. The server only confirms once the confirmation amount
// (25% of the accepted quote) has been received — if not, it says how much more is needed.
export function ConfirmBookingDialog({ confirmationAmount, onSave, onClose }: { confirmationAmount: number; onSave: () => Promise<string | null>; onClose: () => void }) {
  const { saving, error, submit } = useSubmit(onSave);
  const lines = [
    'Sets up the wedding workspace for this couple',
    confirmationAmount > 0 ? `Needs the ₹${confirmationAmount.toLocaleString('en-IN')} confirmation payment to be received (checked by the system)` : null,
    'Moves the booking invoice, with its payments, onto the wedding',
    'Creates a confirmation task for each vendor assigned in the quote',
    'Makes this lead read-only — the wedding takes over',
  ].filter((l): l is string => Boolean(l));
  return (
    <Modal title="Confirm this booking?" onClose={onClose}>
      <p className="text-sm text-gray-600">Confirming does the following:</p>
      <ul className="grid gap-2">
        {lines.map((l) => (
          <li key={l} className="flex items-start gap-2.5 text-sm text-gray-800">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            {l}
          </li>
        ))}
      </ul>
      {saving && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Setting up the wedding — this can take several seconds. Please keep this window open; it closes when everything is ready.
        </p>
      )}
      <ErrorLine error={error} />
      <Actions>
        <button type="button" className={secondaryBtn} disabled={saving} onClick={onClose}>Not yet</button>
        <button type="button" className={primaryBtn} disabled={saving} onClick={submit}>{saving ? 'Confirming…' : 'Confirm booking'}</button>
      </Actions>
    </Modal>
  );
}

export function NotProceedingDialog({
  customerName,
  hasPendingBooking,
  onSave,
  onClose,
}: {
  customerName: string;
  hasPendingBooking: boolean;
  onSave: (key: NotProceedingKey, detail: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [key, setKey] = useState<NotProceedingKey>('CHOSE_ANOTHER');
  const [detail, setDetail] = useState('');
  const { saving, error, submit } = useSubmit(() => onSave(key, detail));
  const needsDetail = NOT_PROCEEDING_REASONS.find((r) => r.key === key)?.needsDetail;
  return (
    <Modal title="Mark as not proceeding" onClose={onClose}>
      <p className="text-sm text-gray-600">Pick the closest reason. {customerName}’s acceptance stays on record.</p>
      <div className="grid gap-2" role="radiogroup" aria-label="Reason">
        {NOT_PROCEEDING_REASONS.map((r) => (
          <label key={r.key} className={`flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm ${key === r.key ? 'border-rose-400 bg-rose-50' : 'border-gray-200'}`}>
            <input type="radio" name="not-proceeding-reason" checked={key === r.key} onChange={() => setKey(r.key)} className="h-4 w-4 accent-rose-600" />
            {r.label}
          </label>
        ))}
      </div>
      <label className="grid gap-1 text-xs font-semibold text-gray-500">
        {needsDetail ? 'Tell us more (required)' : 'Details (optional)'}
        <input className={inputClass} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. Family decided on a different city" />
      </label>
      <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
        This closes the lead and it cannot be reopened.{hasPendingBooking ? ' The pending booking will be closed too.' : ''}
      </p>
      <ErrorLine error={error} />
      <Actions>
        <button type="button" className={secondaryBtn} onClick={onClose}>Keep open</button>
        <button type="button" className={dangerBtn} disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Mark as not proceeding'}</button>
      </Actions>
    </Modal>
  );
}
