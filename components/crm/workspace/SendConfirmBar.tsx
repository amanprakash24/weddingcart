'use client';

import type { pendingPrompt } from '@/lib/crm/whatsappConfirm';

// "Did you press Send in WhatsApp?" — shown after WhatsApp was opened (or the message copied). Nothing is recorded as
// sent until the operator answers Yes (lib/crm/whatsappConfirm.ts).
export default function SendConfirmBar({
  prompt,
  busy,
  onYes,
  onNotYet,
}: {
  prompt: ReturnType<typeof pendingPrompt>;
  busy: boolean;
  onYes: () => void;
  onNotYet: () => void;
}) {
  return (
    <section role="alert" aria-label="Confirm the message was sent" className="grid gap-3 rounded-2xl border-2 border-sky-300 bg-sky-50 p-4">
      <p className="text-sm font-semibold text-sky-950">{prompt.question}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onYes}
          className="min-h-[44px] rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
        >
          {busy ? 'Working…' : prompt.yes}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onNotYet}
          className="min-h-[44px] rounded-xl border border-sky-300 bg-white px-4 text-sm font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-50"
        >
          {prompt.notYet}
        </button>
      </div>
    </section>
  );
}
