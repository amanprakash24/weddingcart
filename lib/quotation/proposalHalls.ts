// "Your hall" on a couple's proposal link (17 Nov 2026): the hall, date and shift their quotation reserves, and where it stands —
// in the couple's words. Pure and client-safe. The input is the venue's own view of THIS enquiry's halls (services/venueSpace
// .service.ts forEnquiry); everything about other couples is dropped here except one fact the couple needs: that the hall is held for
// another booking, and until when (option B — they cannot accept until then). Another couple's name never leaves this function.
import { holdTimeWords, SHIFT_LABEL, type Shift, type Slot, type Space } from '@/lib/venue/slots';

export type ProposalHallStatus = 'BOOKED' | 'RESERVED' | 'HELD' | 'CHOSEN';

export interface ProposalHall {
  hall: string;
  date: string; // YYYY-MM-DD
  shift: Shift;
  status: ProposalHallStatus;
  heldUntil: string | null; // ISO — HELD: when the hold for THEM ends
  heldElsewhereUntil: string | null; // ISO — CHOSEN only: the hall is held for another booking until then
}

export function toProposalHalls(input: { spaces: Space[]; slots: (Slot & { clashes: Slot[] })[] }): ProposalHall[] {
  const name = (id: string) => input.spaces.find((s) => s.id === id)?.name ?? 'The hall';
  return input.slots.map((s) => {
    const status: ProposalHallStatus = s.state === 'BOOKED' ? 'BOOKED' : s.state === 'ACCEPTED' ? 'RESERVED' : s.state === 'HELD' ? 'HELD' : 'CHOSEN';
    const other = status === 'CHOSEN' ? s.clashes.filter((c) => c.state === 'HELD' && c.holdUntil).sort((a, b) => (a.holdUntil! < b.holdUntil! ? 1 : -1))[0] : undefined;
    return {
      hall: name(s.spaceId),
      date: s.date,
      shift: s.shift,
      status,
      heldUntil: status === 'HELD' ? s.holdUntil : null,
      heldElsewhereUntil: other?.holdUntil ?? null,
    };
  });
}

const dayWords = (day: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00.000Z`));

// "Royal Banquet · Night · Sun, 14 Feb, 2027"
export const hallLine = (h: Pick<ProposalHall, 'hall' | 'shift' | 'date'>) => `${h.hall} · ${SHIFT_LABEL[h.shift]} · ${dayWords(h.date)}`;

// What the couple reads under the hall. `venue` is the business's name.
export function hallStatusWords(h: ProposalHall, venue: string): string {
  switch (h.status) {
    case 'BOOKED':
      return 'Booked for you.';
    case 'RESERVED':
      return `Reserved for you. It is confirmed once ${venue} receives the booking amount.`;
    case 'HELD':
      return h.heldUntil ? `Held for you until ${holdTimeWords(h.heldUntil)}. No other couple can book it until then.` : 'Held for you.';
    case 'CHOSEN':
      return h.heldElsewhereUntil
        ? `This hall is held for another booking until ${holdTimeWords(h.heldElsewhereUntil)}. You can accept once that hold ends or ${venue} releases it.`
        : 'Chosen for this quotation. Accepting the quotation reserves it for you.';
  }
}

// True when accepting now would be refused because another couple holds one of the halls.
export const heldElsewhere = (halls: ProposalHall[]) => halls.find((h) => h.heldElsewhereUntil) ?? null;
