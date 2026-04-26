import { Suspense } from 'react';
import HomepageClient from '@/components/HomepageClient';

export const metadata = {
  title: "ShaadiShopping — India's #1 Wedding Planning Marketplace",
  description: 'Discover, compare, and book top wedding vendors across India. Find perfect venues, photographers, caterers, makeup artists, and more for your dream wedding.',
};

export default function HomePage() {
  return (
    <Suspense>
      <HomepageClient />
    </Suspense>
  );
}
