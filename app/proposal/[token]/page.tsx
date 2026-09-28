import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { proposalService } from '@/services/proposal.service';
import { isPreviewBot } from '@/lib/quotation/proposal';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';
import ProposalClient from '@/components/proposal/ProposalClient';

// The couple's proposal page (docs/wedding-os/08-quotation.md §15). The secret token in the URL is the only key.
// Always rendered fresh (never cached), never indexed, and the URL is never sent on as a Referer.
export const dynamic = 'force-dynamic';

// Deliberately generic: link previews (WhatsApp etc.) show this title, so it must not contain the couple's name.
export const metadata: Metadata = {
  title: 'Your wedding proposal',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

const VIEW_LIMIT = { max: 30, windowMinutes: 15 } as const;

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[#FFFAF5]">
      <div className="max-w-md w-full rounded-2xl border border-[#C5A46D]/30 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-[#2A1F1B]" style={{ fontFamily: 'var(--font-playfair, serif)' }}>{title}</h1>
        <div className="mt-3 text-sm text-[#6B5B4D] leading-relaxed">{children}</div>
        <a href={`tel:${SHAADI_PHONE}`} className="mt-6 inline-block rounded-xl bg-[#8B1A4A] px-5 py-3 text-sm font-semibold text-white">
          Call us · {SHAADI_PHONE_DISPLAY}
        </a>
      </div>
    </div>
  );
}

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limiterId = `proposal-view:${ip}`;
  if (await isRequestRateLimited(limiterId, VIEW_LIMIT)) {
    return <Notice title="Please try again shortly">Too many requests from this connection. Please wait a few minutes and open the link again.</Notice>;
  }
  await recordRequest(limiterId);

  const { token } = await params;
  const proposal = await proposalService.view(token, { trackView: !isPreviewBot(h.get('user-agent')) });
  if (!proposal) {
    return <Notice title="This link is no longer valid">It may have been replaced by a newer proposal. Please contact us and we will send you the latest one.</Notice>;
  }
  return <ProposalClient token={token} initial={proposal} />;
}
