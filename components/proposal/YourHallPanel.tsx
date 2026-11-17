import { hallLine, hallStatusWords, type ProposalHall } from '@/lib/quotation/proposalHalls';

// "Your hall" on a venue's own proposal (lib/quotation/proposalHalls.ts): the hall, shift and date this quotation is for, and where it
// stands — held for them, reserved, booked, or only chosen. When another booking holds the hall, it says so and until when (they
// cannot accept until then — the server refuses it), never who.

const TONE: Record<string, string> = {
  BOOKED: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  RESERVED: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  HELD: 'border-amber-200 bg-amber-50 text-amber-900',
  CHOSEN: 'border-[#E8DCC8] bg-[#FFFAF5] text-[#2A1F1B]',
  ELSEWHERE: 'border-rose-200 bg-rose-50 text-rose-900',
};

export default function YourHallPanel({ halls, venue }: { halls: ProposalHall[]; venue: string }) {
  if (halls.length === 0) return null;
  return (
    <section aria-label={halls.length === 1 ? 'Your hall' : 'Your halls'} className="space-y-3 rounded-[24px] border border-[#E8DCC8] bg-white p-5 sm:p-6 print:rounded-none print:border-0 print:p-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#A8865A]">{halls.length === 1 ? 'Your hall' : 'Your halls'}</p>
      <ul className="space-y-2">
        {halls.map((h, i) => (
          <li key={i} className={`rounded-xl border p-4 ${TONE[h.heldElsewhereUntil ? 'ELSEWHERE' : h.status]}`}>
            <p className="text-base font-semibold">{hallLine(h)}</p>
            <p className="mt-1 text-sm leading-relaxed">{hallStatusWords(h, venue)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
