// "Your work" (13 Oct 2026): the to-dos on a business's own weddings that were given to one person, as that person sees them on
// Today. Pure — no database, no server imports: the screen uses these types.
//
// Someone given a to-do sees only what they need to do it: what, by when, and for the wedding it belongs to the couple's name,
// the date and each function's day, time and place. Never the phone number, the agreed price list or any money — an employee has
// none of those permissions until the owner gives them.
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/lib/auth/permissions';

export interface MyWorkItem {
  id: string;
  // TODO = a to-do on a wedding (`wedding` is set); FOLLOW_UP = a follow-up on an enquiry (`enquiry` is set — given only to
  // someone who may open enquiries, so it carries the couple's name and links to the enquiry, where the number is).
  kind: 'TODO' | 'FOLLOW_UP';
  title: string;
  done: boolean;
  dueOn: string | null; // YYYY-MM-DD (IST)
  overdue: boolean;
  wedding: { id: string; name: string; date: string; functions: { name: string; date: string; startTime: string | null; place: string | null }[] } | null;
  enquiry: { id: string; name: string; weddingDate: string | null } | null;
  notes: { id: string; text: string; at: string }[]; // this person's own notes on this to-do, oldest first
}

export interface MyWork {
  items: MyWorkItem[]; // open first (soonest due on top, no date last), then done
  open: number;
  canOpenWeddings: boolean; // this person may open the wedding itself (the `weddings` permission)
  canOpenEnquiries: boolean; // … and the enquiry a follow-up belongs to (`enquiries`)
}

// A note from the team on a business's own wedding (13 Oct 2026) — "generator needs 40 litres more", "florist will come at 4".
// Kept in the wedding's history (ActivityLog, type NOTE: who, when, the words), so it is never edited or removed. A note written
// from "Your work" says which to-do it is about in its heading; there is no database link to the to-do, so the heading keeps the
// to-do's name as it was when the note was written.
export const NOTE_MAX = 300;
export const GENERAL_NOTE = 'Note';
export const noteAbout = (taskTitle: string) => `Note on “${taskTitle}”`;

// When a note was written, as it reads in India: "13 Oct, 4:05 pm".
export const noteWhen = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(new Date(iso));

export function checkNote(raw: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof raw === 'string' ? raw.trim().replace(/\s+\n/g, '\n') : '';
  if (!text) return { ok: false, error: 'Write the note first' };
  if (text.length > NOTE_MAX) return { ok: false, error: `Please keep the note under ${NOTE_MAX} letters` };
  return { ok: true, text };
}

// How a member is named when work is given out: their name; an account with no name yet (most owners) by what they are.
export function memberLabel(m: { name: string | null; role: MemberRole; jobTitle: string | null }): string {
  return m.name?.trim() || (m.role === 'OWNER' ? 'Owner' : m.jobTitle?.trim() || MEMBER_ROLE_LABELS[m.role]);
}

export function sortMyWork<T extends { done: boolean; dueOn: string | null }>(items: T[]): T[] {
  const byDue = (a: T, b: T) => (a.dueOn ?? '9999') .localeCompare(b.dueOn ?? '9999');
  return [...items.filter((i) => !i.done).sort(byDue), ...items.filter((i) => i.done).sort(byDue)];
}

// "Work for you" — the text of a wa.me link the person who gave out a to-do taps and sends from their own WhatsApp (nothing is
// sent by the app). What, by when, for which wedding, and where to find it. No phone number and no money.
const dayWords = (d: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${d}T12:00:00+05:30`));

export function workGivenMessage(m: { firstName: string | null; businessName: string; title: string; dueOn: string | null; weddingName: string; weddingDate: string; site: string }): string {
  return [
    m.firstName ? `Namaste ${m.firstName},` : 'Namaste,',
    `Work for you${m.businessName ? ` from ${m.businessName}` : ''}:`,
    `• ${m.title}${m.dueOn ? ` — by ${dayWords(m.dueOn)}` : ''}`,
    `For: ${m.weddingName}, ${dayWords(m.weddingDate)}`,
    `See it and tick it done in Vivah OS → Today → Your work: ${m.site.replace(/\/$/, '')}/vendor/login`,
  ].join('\n');
}

// The same for a follow-up on an enquiry: who to follow up with and by when. The couple's number is not in it — it is on the enquiry.
export function followUpGivenMessage(m: { firstName: string | null; businessName: string; title: string; dueOn: string | null; coupleName: string; site: string }): string {
  return [
    m.firstName ? `Namaste ${m.firstName},` : 'Namaste,',
    `Work for you${m.businessName ? ` from ${m.businessName}` : ''}:`,
    `• Follow up with ${m.coupleName}${m.title && m.title !== 'Follow up' ? ` — ${m.title}` : ''}${m.dueOn ? ` — by ${dayWords(m.dueOn)}` : ''}`,
    `See it in Vivah OS → Today → Your work: ${m.site.replace(/\/$/, '')}/vendor/login`,
  ].join('\n');
}

export const isOverdue = (dueOn: string | null, done: boolean, today: string) => !done && dueOn !== null && dueOn < today;
