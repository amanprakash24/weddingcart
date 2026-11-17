// "Your hall" on a couple's proposal link (17 Nov 2026): the hall, date and shift their quotation reserves, and where it stands — in
// the couple's words. Pure and client-safe. The input is services/venueSpace.service.ts forProposal: this enquiry's own slots, each
// with what takes the hall from them (lib/venue/slots.ts blockingClash — the very rule the server refuses an acceptance on). Of the
// other booking only two facts survive here: that the hall is taken, and — when it is a hold — until when. Never who.
import { hallUnavailableWords, holdTimeWords, SHIFT_LABEL, slotDayWords, type Shift, type Slot } from '@/lib/venue/slots';

export type ProposalHallStatus = 'BOOKED' | 'RESERVED' | 'HELD' | 'CHOSEN';

export interface ProposalHall {
  hall: string;
  date: string; // YYYY-MM-DD
  shift: Shift;
  status: ProposalHallStatus;
  heldUntil: string | null; // ISO — HELD: when the hold for THEM ends
  // CHOSEN only: the hall is taken by someone else — until heldUntil when it is a hold (null = booked, accepted or blocked). null = free.
  blockedBy: { heldUntil: string | null } | null;
}

export function toProposalHalls(rows: { hall: string; slot: Slot; blocker: Slot | undefined }[]): ProposalHall[] {
  return rows.map(({ hall, slot, blocker }) => {
    const status: ProposalHallStatus = slot.state === 'BOOKED' ? 'BOOKED' : slot.state === 'ACCEPTED' ? 'RESERVED' : slot.state === 'HELD' ? 'HELD' : 'CHOSEN';
    return {
      hall,
      date: slot.date,
      shift: slot.shift,
      status,
      heldUntil: status === 'HELD' ? slot.holdUntil : null,
      blockedBy: status === 'CHOSEN' && blocker ? { heldUntil: blocker.state === 'HELD' ? blocker.holdUntil : null } : null,
    };
  });
}

// The halls as they stand at `now` — the page keeps this current while it is open: a hold that has ended is gone, both their own
// (back to chosen) and another booking's (the hall is free again — Accept comes back).
export function liveHalls(halls: ProposalHall[], now: Date): ProposalHall[] {
  return halls.map((h) => {
    const ownEnded = h.status === 'HELD' && h.heldUntil && new Date(h.heldUntil) <= now;
    const otherEnded = h.blockedBy?.heldUntil && new Date(h.blockedBy.heldUntil) <= now;
    if (!ownEnded && !otherEnded) return h;
    return { ...h, ...(ownEnded ? { status: 'CHOSEN' as const, heldUntil: null } : {}), ...(otherEnded ? { blockedBy: null } : {}) };
  });
}

// "Royal Banquet · Night · Fri, 5 Feb, 2027"
export const hallLine = (h: Pick<ProposalHall, 'hall' | 'shift' | 'date'>) => `${h.hall} · ${SHIFT_LABEL[h.shift]} · ${slotDayWords(h.date)}`;

// What the couple reads about one hall. `canAccept`: the quotation is still open — only then is anything promised about accepting.
export function hallStatusWords(h: ProposalHall, venue: string, canAccept: boolean): string {
  switch (h.status) {
    case 'BOOKED':
      return 'Booked for you.';
    case 'RESERVED':
      return `Reserved for you. It is confirmed once ${venue} receives the booking amount.`;
    case 'HELD':
      if (!h.heldUntil) return 'Held for you.';
      return canAccept ? `Held for you until ${holdTimeWords(h.heldUntil)}. No other couple can book it until then.` : `Held for you until ${holdTimeWords(h.heldUntil)}.`;
    case 'CHOSEN':
      if (!canAccept) return 'Chosen for this quotation.';
      if (h.blockedBy) return hallUnavailableWords({ hall: h.hall, shift: h.shift, date: h.date, heldUntil: h.blockedBy.heldUntil });
      return 'Chosen for this quotation. Accepting the quotation reserves it for you.';
  }
}

// The first hall that stops them accepting right now (the server would refuse) — or null.
export const blockedHall = (halls: ProposalHall[]) => halls.find((h) => h.blockedBy) ?? null;
