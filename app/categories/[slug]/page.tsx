import { Suspense } from 'react';
import CategoryPageClient from '@/components/CategoryPageClient';
import { connectDB } from '@/lib/mongodb';
import CategoryModel from '@/lib/models/Category';

async function getCategoryMeta(slug: string) {
  try {
    await connectDB();
    const cat = await CategoryModel.findOne({ id: slug }).lean<{ name: string; description: string; image: string }>();
    if (cat) return { name: cat.name, description: cat.description, image: cat.image };
  } catch {}
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = await getCategoryMeta(slug);
  const names: Record<string, string> = {
    venue: 'Venues', makeup: 'Makeup Artists', mehndi: 'Mehndi Artists',
    decorator: 'Decorators', band: 'Band & Music', dj: 'DJ Services',
    catering: 'Catering Services', 'photo-video': 'Photographers & Videographers',
  };
  const name = cat?.name || names[slug] || slug;
  return {
    title: `${name} — Book Top Wedding ${name} in India`,
    description: `Compare and book the best wedding ${name.toLowerCase()} in India. Browse packages, read reviews, and get quotes.`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = await getCategoryMeta(slug);
  return (
    <Suspense>
      <CategoryPageClient slug={slug} initialCoverImage={cat?.image} initialName={cat?.name} initialDescription={cat?.description} />
    </Suspense>
  );
}
