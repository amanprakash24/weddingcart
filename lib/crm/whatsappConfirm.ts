// "Did you press Send in WhatsApp?" — the confirm step between opening WhatsApp and recording that something was sent
// (docs/wedding-os/08-quotation.md §6.2).
//
// Opening WhatsApp proves nothing: the browser can block the tab, WhatsApp may not be logged in, or the operator may
// never press Send. So opening WhatsApp records NOTHING; only the operator's "Yes, it's sent" marks the quote as sent
// (or logs the follow-up). Pure, so it can be tested; the workspace keeps one PendingSend in state.

export type PendingKind = 'quote' | 'follow-up';

export interface PendingSend {
  kind: PendingKind;
  quotationId: string;
  // The exact message that was put into WhatsApp. If the quote is edited afterwards the message would no longer match
  // what the customer got, so the pending confirmation lapses and WhatsApp has to be opened again.
  text: string;
  via: 'whatsapp' | 'copied';
}

export function startPending(kind: PendingKind, quotationId: string, text: string, via: PendingSend['via']): PendingSend {
  return { kind, quotationId, text, via };
}

// Still the same quote, in the state the message was meant for, with the same message text?
export function pendingStillValid(
  pending: PendingSend | null,
  current: { id: string; status: string } | null,
  currentText: string | null
): pending is PendingSend {
  if (!pending || !current || current.id !== pending.quotationId || currentText !== pending.text) return false;
  return pending.kind === 'quote' ? current.status === 'DRAFT' : current.status === 'SENT';
}

// The words on the confirm bar and in the notices.
export function pendingPrompt(p: PendingSend): { opened: string; question: string; yes: string; notYet: string } {
  const what = p.kind === 'quote' ? 'the quote' : 'the follow-up';
  return {
    opened:
      p.via === 'whatsapp'
        ? `WhatsApp opened with ${what}. Press Send there, then confirm below — nothing is marked as sent until you do.`
        : `The message is copied — paste it into WhatsApp, send it, then confirm below. Nothing is marked as sent until you do.`,
    question: `Did you press Send in WhatsApp for ${what}?`,
    yes: "Yes, it's sent",
    notYet: 'Not yet',
  };
}

export const NOT_YET_NOTICE = {
  quote: 'Not marked as sent. The quote is still a draft — send it whenever you are ready.',
  'follow-up': 'Follow-up not recorded.',
} as const;

export const CONFIRMED_NOTICE = {
  quote: 'Confirmed: quote sent.',
  'follow-up': 'Confirmed: follow-up sent.',
} as const;

// The timeline note for a confirmed follow-up (quote sends are logged by the server on /send).
export const FOLLOW_UP_SENT_NOTE = 'Follow-up sent on WhatsApp (confirmed by staff)';
