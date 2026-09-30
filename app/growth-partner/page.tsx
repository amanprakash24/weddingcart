import type { Metadata } from 'next';
import GrowthPartnerPageClient from '@/components/growthPartner/GrowthPartnerPageClient';

// Public page for the Shaadi Shopping Growth Partner Program (docs/wedding-os/14-growth-partner.md).
export const metadata: Metadata = {
  title: 'Growth Partner Program — Connect. Refer. Earn. | ShaadiShopping',
  description:
    'Have wedding-related contacts? Refer venues, vendors, clients or events to Shaadi Shopping and earn an agreed referral payout when the business is completed. Part-time, flexible, no joining fee.',
  alternates: { canonical: '/growth-partner' },
  openGraph: {
    title: 'Shaadi Shopping Growth Partner Program — Connect. Refer. Earn.',
    description: 'Refer venues, vendors, clients or events. We handle the business. Successful completion earns an agreed referral payout.',
    url: '/growth-partner',
    type: 'website',
  },
};

export default function GrowthPartnerPage() {
  return <GrowthPartnerPageClient />;
}
