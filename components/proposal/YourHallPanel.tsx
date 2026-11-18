import { hallLine, hallStatusWords, type ProposalHall, type ProposalHallStatus } from '@/lib/quotation/proposalHalls';

// "Your hall" on a venue's own proposal (lib/quotation/proposalHalls.ts): where each hall stands — held for them, reserved, booked,
// or only chosen; and when someone else has it, that it is taken (until when, for a hold) — never who. The header above already
// names the hall, so a single hall shows only its status; several show which is which. Not printed: the printed quotation lists the
// halls in its own header, and a hold's wording is about the moment, not the document.

const TONE: Record<ProposalHallStatus | 'TAKEN', string> = {
  BOOKED: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  RESERVED: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  HELD: 'border-amber-200 bg-amber-50 text-amber-900',
  CHOSEN: 'border-[#E8DCC8] bg-[#FFFAF5] text-[#2A1F1B]',
  TAKEN: 'border-rose-200 bg-rose-50 text-rose-900',
};

// `halls` are already current (liveHalls); `canAccept`: the quotation is still open.
export default function YourHallPanel({ halls, venue, canAccept }: { halls: ProposalHall[]; venue: string; canAccept: boolean }) {
  if (halls.length === 0) return null;
  const several = halls.length > 1;
  return (
    <section aria-label={several ? 'Your halls' : 'Your hall'} className="space-y-3 rounded-[24px] border border-[#E8DCC8] bg-white p-5 sm:p-6 print:hidden">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#A8865A]">{several ? 'Your halls' : 'Your hall'}</p>
      <ul className="space-y-2">
        {halls.map((h, i) => (
          <li key={i} className={`rounded-xl border p-4 ${TONE[canAccept && h.blockedBy ? 'TAKEN' : h.status]}`}>
            {several && <p className="text-base font-semibold">{hallLine(h)}</p>}
            <p className={`${several ? 'mt-1 ' : ''}text-sm leading-relaxed`}>{hallStatusWords(h, venue, canAccept)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
