'use client';

import { useState } from 'react';

export interface ConvertToWeddingInput {
  weddingDate: string;
  city: string;
  venueName?: string;
  notes?: string;
  tokenAdvanceReceived: boolean;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-gray-50 focus:bg-white';

// The "operational handoff" dialog from domain-model.md §5.1 — captures
// enough for Operations to start, doesn't require a token advance to exist
// yet (captured as a checkbox, not a payment record).
export default function ConvertToWeddingDialog({
  defaultCity,
  onConvert,
  onClose,
}: {
  defaultCity: string;
  onConvert: (input: ConvertToWeddingInput) => Promise<void>;
  onClose: () => void;
}) {
  const [weddingDate, setWeddingDate] = useState('');
  const [city, setCity] = useState(defaultCity);
  const [venueName, setVenueName] = useState('');
  const [notes, setNotes] = useState('');
  const [tokenAdvanceReceived, setTokenAdvanceReceived] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weddingDate || !city.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConvert({
        weddingDate: new Date(weddingDate).toISOString(),
        city: city.trim(),
        venueName: venueName.trim() || undefined,
        notes: notes.trim() || undefined,
        tokenAdvanceReceived,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Wedding Workspace');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Create Wedding Workspace</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Hands this off to Operations. Sales access becomes read-only after this.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Wedding Date *</label>
            <input type="date" required value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
            <input required value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Venue</label>
            <input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Optional" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" className={inputClass} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={tokenAdvanceReceived} onChange={(e) => setTokenAdvanceReceived(e.target.checked)} />
            Token advance received
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !weddingDate || !city.trim()}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white disabled:opacity-40 hover:bg-amber-600 transition-colors"
            >
              {submitting ? 'Creating…' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
