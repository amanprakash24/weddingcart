import { coupleBookingWords, type CoupleBooking } from '@/lib/quotation/coupleBooking';

// "Your booking" / "Your wedding" on a business's own link (lib/quotation/coupleBooking.ts): the wedding the booking became and the
// money received so far (the one line on where it stands is the page's own status message, above this). Read-only — the couple pays the business directly, and the business records it.

const serif = { fontFamily: 'var(--font-playfair), Georgia, serif' } as const;
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const dayWords = (day: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${day}T12:00:00+05:30`));

export default function YourBookingPanel({ booking: b, businessName }: { booking: CoupleBooking; businessName: string }) {
  const words = coupleBookingWords(b, businessName);
  const w = b.wedding;
  return (
    <section aria-label={words.heading} className="space-y-5 rounded-[24px] border border-emerald-200 bg-white p-6 sm:p-8">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-800">{words.heading}</h2>
        {w && (
          <p className="mt-3 text-2xl leading-snug text-[#2A1F1B]" style={serif}>
            {dayWords(w.date)}
          </p>
        )}
      </div>

      {w && w.functions.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B08D55]">Your functions</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {w.functions.map((name) => (
              <li key={name} className="rounded-full border border-[#E8DCC8] bg-[#FFFCF7] px-3.5 py-1.5 text-sm text-[#2A1F1B]">{name}</li>
            ))}
          </ul>
        </div>
      )}

      <dl className="space-y-2 rounded-xl bg-[#FFFCF7] p-4 text-sm">
        <div className="flex justify-between gap-4 text-[#4A3F38]"><dt>Agreed total</dt><dd>{rupees(b.total)}</dd></div>
        <div className="flex justify-between gap-4 text-[#4A3F38]"><dt>Received</dt><dd>{rupees(b.received)}</dd></div>
        {b.toConfirm > 0 && <div className="flex justify-between gap-4 text-[#8B1A4A]"><dt>To confirm your booking</dt><dd>{rupees(b.toConfirm)}</dd></div>}
        <div className="flex justify-between gap-4 border-t border-[#F0E6D6] pt-2 font-semibold text-[#2A1F1B]"><dt>{b.outstanding > 0 ? 'Still to pay' : 'Paid in full'}</dt><dd>{rupees(b.outstanding)}</dd></div>
      </dl>

      {b.payments.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B08D55]">Payments received</p>
          <ul className="mt-2 divide-y divide-[#F0E6D6] text-sm">
            {b.payments.map((p, i) => (
              <li key={i} className="flex justify-between gap-4 py-2 text-[#2A1F1B]">
                <span>{dayWords(p.paidOn)} · {p.method}</span>
                <span className="shrink-0">{rupees(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs leading-relaxed text-[#6B5B4D]">
        {w ? `Wedding ${w.number} · ` : ''}Payments are made to {businessName} and appear here once they record them.
      </p>
    </section>
  );
}
