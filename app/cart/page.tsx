import { Suspense } from 'react';
import CartPageClient from '@/components/CartPageClient';

export const metadata = {
  title: 'Your Wedding Plan Cart',
  description: 'Review your selected vendors and complete your wedding plan.',
};

export default function CartPage() {
  return (
    <Suspense>
      <CartPageClient />
    </Suspense>
  );
}
