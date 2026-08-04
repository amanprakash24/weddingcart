import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';

export interface RelatedGuide {
  title: string;
  href: string;
  desc: string;
}

export default function RelatedGuides({ guides, heading = 'Helpful Wedding Guides' }: { guides: RelatedGuide[]; heading?: string }) {
  if (guides.length === 0) return null;

  return (
    <section className="bg-[#FFFAF5] border-y border-[#C5A46D]/15 py-12 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2 text-center flex items-center justify-center gap-2">
          <BookOpen className="w-3.5 h-3.5" /> Wedding Guides
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 text-center" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
          {heading}
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {guides.map(({ title, href, desc }) => (
            <Link key={href} href={href} className="group block rounded-xl border border-[#C5A46D]/15 hover:border-[#C5A46D]/40 bg-white px-4 py-4 transition-colors">
              <p className="font-semibold text-gray-900 text-sm group-hover:text-[#8B1A4A] transition-colors mb-1 flex items-center gap-1">
                {title} <ChevronRight className="w-3.5 h-3.5" />
              </p>
              <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
