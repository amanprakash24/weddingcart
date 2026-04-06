import { Suspense } from 'react';
import PlanPageClient from '@/components/PlanPageClient';

export const metadata = {
  title: 'Plan Your Wedding — Free Wedding Planning Wizard',
  description: 'Use our free step-by-step wedding planning wizard to organize every detail of your dream wedding. Get expert consultation and build your perfect wedding plan.',
};

export default function PlanPage() {
  return (
    <Suspense>
      <PlanPageClient />
    </Suspense>
  );
}
