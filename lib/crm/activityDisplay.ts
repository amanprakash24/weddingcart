// How an activity-log row reads on screen. Every row already stores a short human sentence (`summary`); the old
// timeline showed the type label ("Status Changed", "System", the raw QUOTATION_ACCEPTED) instead. This shows the
// sentence, with the technical event type kept for the "Audit details" view — never as the primary text.
import { LOST_REASON_LABELS, type LostReason } from '@/lib/crm/pipeline';

export interface ActivityLike {
  type: string;
  summary: string;
  detail: string | null;
  performedByName: string | null;
  aiGenerated: boolean;
}

export interface ActivityView {
  headline: string;
  body: string | null;
  by: string;
  tone: 'note' | 'key' | 'stop' | 'plain';
  auditCode: string; // the event type, for the audit view only
}

const PERSON_ENTRY_LABEL: Record<string, string> = {
  NOTE: 'Note',
  CALL: 'Call',
  WHATSAPP: 'WhatsApp message',
  EMAIL: 'Email',
  MEETING: 'Meeting',
};

const KEY_TYPES = new Set(['QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'INVOICE_CREATED']);

export function activityView(a: ActivityLike, opts: { lostReasonText?: string | null } = {}): ActivityView {
  // A note, call or message written by a person who has no name on record still came from the team — never "Automatic".
  const byPerson = Boolean(PERSON_ENTRY_LABEL[a.type]);
  const by = a.performedByName ?? (a.aiGenerated ? 'AI assistant' : byPerson ? 'Team' : 'Automatic');
  const base = { by, auditCode: a.type };

  if (PERSON_ENTRY_LABEL[a.type]) {
    return { ...base, headline: `${PERSON_ENTRY_LABEL[a.type]} from ${a.performedByName ?? 'the team'}`, body: a.detail ?? a.summary, tone: 'note' };
  }

  const summary = a.summary.trim();
  let m: RegExpMatchArray | null;

  if ((m = summary.match(/^Stage changed: (.+) → (.+)$/))) {
    const lost = m[2].trim() === 'Lost';
    const reasonBody = lost ? (opts.lostReasonText ?? (a.detail && a.detail in LOST_REASON_LABELS ? LOST_REASON_LABELS[a.detail as LostReason] : a.detail)) : a.detail;
    return { ...base, headline: `Lead status changed from ${m[1]} to ${m[2]}`, body: reasonBody ? (lost ? `Reason: ${reasonBody}` : reasonBody) : null, tone: lost ? 'stop' : 'plain' };
  }
  if ((m = summary.match(/^Assigned to (.+)$/))) return { ...base, headline: `Lead assigned to ${m[1]}`, body: null, tone: 'plain' };
  if (summary === 'Unassigned') return { ...base, headline: 'Lead unassigned', body: null, tone: 'plain' };

  if ((m = summary.match(/^Quotation (\S+) sent — (.+)$/))) {
    return { ...base, headline: 'Quotation sent to customer', body: `${m[1]} · ${capitalize(m[2])}`, tone: 'key' };
  }
  if ((m = summary.match(/^Quotation (\S+) accepted by the customer via (.+?) — (.+)$/))) {
    return { ...base, headline: 'Customer accepted the quotation', body: [`${m[1]} · recorded via ${m[2]} · ${m[3]}`, a.detail && `“${a.detail}”`].filter(Boolean).join(' — '), tone: 'key' };
  }
  if ((m = summary.match(/^Quotation (\S+) rejected$/))) {
    return { ...base, headline: 'Customer declined the quotation', body: a.detail ? `Reason: ${a.detail}` : m[1], tone: 'stop' };
  }
  if ((m = summary.match(/^Quotation (\S+) revised — new draft (\S+) \(revision (\d+)\)$/))) {
    return { ...base, headline: 'Quotation revised', body: `${m[1]} was replaced by a new draft, ${m[2]} (revision ${m[3]}).`, tone: 'plain' };
  }
  if ((m = summary.match(/^Revision (\S+) discarded — (\S+) is (.+)$/))) {
    return { ...base, headline: 'Revision discarded', body: `${m[2]} is ${m[3]}.`, tone: 'plain' };
  }

  return { ...base, headline: summary || 'Activity recorded', body: a.detail && a.detail !== summary ? a.detail : null, tone: KEY_TYPES.has(a.type) ? 'key' : 'plain' };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
