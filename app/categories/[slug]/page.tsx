import { Suspense } from 'react';
import CategoryPageClient from '@/components/CategoryPageClient';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const names: Record<string, string> = {
    venue: 'Venues', makeup: 'Makeup Artists', mehndi: 'Mehndi Artists',
    decorator: 'Decorators', band: 'Band & Music', dj: 'DJ Services',
    catering: 'Catering Services', 'photo-video': 'Photographers & Videographers',
  };
  const name = names[slug] || slug;
  return {
    title: `${name} — Book Top Wedding ${name} in India`,
    description: `Compare and book the best wedding ${name.toLowerCase()} in India. Browse packages, read reviews, and get quotes.`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense>
      <CategoryPageClient slug={slug} />
    </Suspense>
  );
}
