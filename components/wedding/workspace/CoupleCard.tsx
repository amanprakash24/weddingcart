'use client';

import { useState } from 'react';
import type { WeddingWorkspace } from './types';

const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-gray-50 focus:bg-white';

// Empty-safe by design — the conversion dialog doesn't capture couple names
// (domain-model.md §5.1's dialog fields are Date/City/Venue/Coordinator/
// Notes/Token only), so this is always empty right after conversion and gets
// filled in from inside the Workspace.
export default function CoupleCard({
  couple,
  onSave,
}: {
  couple: WeddingWorkspace['couple'];
  onSave: (input: { brideName?: string; groomName?: string; bridePhone?: string; groomPhone?: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [brideName, setBrideName] = useState(couple?.brideName ?? '');
  const [bridePhone, setBridePhone] = useState(couple?.bridePhone ?? '');
  const [groomName, setGroomName] = useState(couple?.groomName ?? '');
  const [groomPhone, setGroomPhone] = useState(couple?.groomPhone ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await onSave({
        brideName: brideName.trim() || undefined,
        bridePhone: bridePhone.trim() || undefined,
        groomName: groomName.trim() || undefined,
        groomPhone: groomPhone.trim() || undefined,
      });
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Couple</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-amber-600 hover:underline">
            {couple ? 'Edit' : 'Add details'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input value={brideName} onChange={(e) => setBrideName(e.target.value)} placeholder="Bride name" className={inputClass} />
          <input value={bridePhone} onChange={(e) => setBridePhone(e.target.value)} placeholder="Bride phone" className={inputClass} />
          <input value={groomName} onChange={(e) => setGroomName(e.target.value)} placeholder="Groom name" className={inputClass} />
          <input value={groomPhone} onChange={(e) => setGroomPhone(e.target.value)} placeholder="Groom phone" className={inputClass} />
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={submitting} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white disabled:opacity-40">
              Save
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      ) : couple && (couple.brideName || couple.groomName) ? (
        <div className="text-sm space-y-1">
          {couple.brideName && <p className="text-gray-900">{couple.brideName} {couple.bridePhone && <span className="text-gray-400">· {couple.bridePhone}</span>}</p>}
          {couple.groomName && <p className="text-gray-900">{couple.groomName} {couple.groomPhone && <span className="text-gray-400">· {couple.groomPhone}</span>}</p>}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No couple details yet.</p>
      )}
    </div>
  );
}
