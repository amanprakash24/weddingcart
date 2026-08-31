import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EventPublicClient from '@/components/events/EventPublicClient';
import { eventService } from '@/services/event.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await eventService.getBySlug(slug);
  if (!event || event.status !== 'PUBLISHED') {
    return { title: 'Event not found', robots: { index: false, follow: false } };
  }

  return {
    title: `${event.name} | ShaadiShopping Events`,
    description: event.description || `Book passes for ${event.name} at ${event.venueName}.`,
    alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com'}/events/${slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function EventSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await eventService.getBySlug(slug);
  if (!event || event.status !== 'PUBLISHED') notFound();

  return <EventPublicClient event={{
    id: event.id,
    slug: event.slug,
    name: event.name,
    date: event.date.toISOString(),
    time: event.time,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    description: event.description,
    coverImage: event.coverImage,
    capacity: event.capacity,
    passTypes: event.passTypes.map((pass) => ({
      id: pass.id,
      name: pass.name,
      price: pass.price,
      description: pass.description,
      peopleIncluded: pass.peopleIncluded,
      foodIncluded: pass.foodIncluded,
      salesLimit: pass.salesLimit,
    })),
  }} />;
}
