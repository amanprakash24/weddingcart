'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Phone } from 'lucide-react';
import { Card, CardSkeleton } from '@/components/ui/Card';
import StatusPill from '@/components/ui/StatusPill';
import { whatsappTo } from '@/lib/venue/enquiry';
import type { VenueWeddingDetail } from '@/services/venueWedding.service';
import { daysWords, weddingDateWords } from './YourWeddings';
import { WeddingFunctions, WeddingTasks } from './WeddingPlan';

// One of the business's own weddings: who and when, the functions, what was agreed, the money and what is still to do. The functions
// and the to-do list are planned here (WeddingPlan.tsx); the quotation and the payments are changed on the enquiry it came from,
// one tap away.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const big = 'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold';
const heading = 'text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]';

export default function WeddingDetail({ id }: { id: string }) {
  const [w, setW] = useState<VenueWeddingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/vendor-os/weddings/${id}`)
      .then((r) => r.json())
      .then((b) => live && (b.success ? setW(b.data) : setError(b.error ?? 'This wedding could not be loaded.')))
      .catch(() => live && setError('Could not reach Vivah OS — please check your connection.'));
    return () => {
      live = false;
    };
  }, [id]);

  const back = (
    <Link href="/vendor/weddings" className="inline-flex min-h-11 items-center gap-1 text-sm text-[var(--color-text-secondary)]">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Weddings
    </Link>
  );

  if (error) {
    return (
      <div className="space-y-3">
        {back}
        <p role="alert" className="text-sm text-[var(--color-danger-text)]">{error}</p>
      </div>
    );
  }
  if (!w) {
    return (
      <div className="space-y-3">
        {back}
        <CardSkeleton lines={4} />
      </div>
    );
  }

  const days = daysWords(w.stage, w.daysToGo);

  return (
    <div className="space-y-5">
      {back}

      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-playfair text-2xl font-bold text-[var(--color-text-primary)]">{w.customerName}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">{w.number}</p>
          </div>
          <StatusPill status={w.stage === 'COMPLETED' || w.stage === 'CANCELLED' ? 'neutral' : 'confirmed'}>{w.stageLabel}</StatusPill>
        </div>
        <p className="text-base text-[var(--color-text-primary)]">
          {[weddingDateWords(w.date), days, w.guestCount ? `${w.guestCount.toLocaleString('en-IN')} guests` : null, w.city].filter(Boolean).join(' · ')}
        </p>
        {w.customerPhone && (
          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:${w.customerPhone}`} className={`${big} bg-[var(--primary)] text-[var(--color-on-primary)]`}>
              <Phone className="h-5 w-5" aria-hidden /> Call
            </a>
            <a href={whatsappTo(w.customerPhone, `Namaste ${w.customerName.split(' ')[0]} ji,`)} target="_blank" rel="noopener noreferrer" className={`${big} border border-[var(--color-border-default)] text-[var(--color-text-primary)]`}>
              <MessageCircle className="h-5 w-5" aria-hidden /> WhatsApp
            </a>
          </div>
        )}
      </Card>

      <WeddingFunctions w={w} onSaved={setW} />

      <section aria-label="What was agreed" className="space-y-2">
        <h2 className={heading}>What was agreed{w.quotationNumber ? ` · ${w.quotationNumber}` : ''}</h2>
        <Card className="divide-y divide-[var(--color-border-subtle)]">
          {w.agreed.length === 0 && <p className="text-sm text-[var(--color-text-secondary)]">No quotation is linked to this wedding.</p>}
          {w.agreed.map((i, n) => (
            <div key={n} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div>
                <p className="text-base text-[var(--color-text-primary)]">{i.description}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{[i.function, `${i.quantity.toLocaleString('en-IN')} × ${inr(i.unitPrice)}`].filter(Boolean).join(' · ')}</p>
              </div>
              <p className="shrink-0 text-sm font-medium text-[var(--color-text-primary)]">{inr(i.lineTotal)}</p>
            </div>
          ))}
          {w.agreedTotals && (
            <div className="space-y-1 py-2.5 last:pb-0">
              {w.agreedTotals.discount > 0 && (
                <p className="flex justify-between text-sm text-[var(--color-text-secondary)]"><span>Discount</span><span>− {inr(w.agreedTotals.discount)}</span></p>
              )}
              {w.agreedTotals.gst > 0 && (
                <p className="flex justify-between text-sm text-[var(--color-text-secondary)]"><span>GST</span><span>{inr(w.agreedTotals.gst)}</span></p>
              )}
              <p className="flex justify-between text-base font-semibold text-[var(--color-text-primary)]"><span>Total</span><span>{inr(w.agreedTotals.total)}</span></p>
            </div>
          )}
        </Card>
      </section>

      <section aria-label="Money" className="space-y-2">
        <h2 className={heading}>Money</h2>
        <Card className="space-y-3">
          {w.money ? (
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-xs text-[var(--color-text-muted)]">Agreed</dt>
                <dd className="text-base font-semibold text-[var(--color-text-primary)]">{inr(w.money.total)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-muted)]">Received</dt>
                <dd className="text-base font-semibold text-[var(--color-text-primary)]">{inr(w.money.received)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-muted)]">Still to come</dt>
                <dd className="text-base font-semibold text-[var(--color-text-primary)]">{inr(w.money.outstanding)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">{w.moneyHidden ? 'Payments for this wedding are kept by the owner of the business.' : 'No payments are recorded for this wedding.'}</p>
          )}
          {w.enquiryId && (
            <Link href={`/vendor/enquiries/${w.enquiryId}`} className={`${big} w-full border border-[var(--color-border-default)] text-[var(--color-text-primary)]`}>
              {w.money ? 'Record a payment · see the quotation' : 'See the quotation'}
            </Link>
          )}
        </Card>
      </section>

      <WeddingTasks w={w} onSaved={setW} />
    </div>
  );
}
