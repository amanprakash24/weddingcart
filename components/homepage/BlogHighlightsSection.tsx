import Link from 'next/link';
import Image from 'next/image';
import { Clock, ArrowRight, BookOpen } from 'lucide-react';

export interface BlogHighlight {
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: string;
  readTime: number;
}

export default function BlogHighlightsSection({ posts }: { posts: BlogHighlight[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="bg-[#FFFAF5] py-16 sm:py-20 border-t border-[#C5A46D]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5" /> Wedding Guides
            </p>
            <h2
              className="text-2xl sm:text-3xl font-semibold text-[#2A1F1B] leading-tight"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              Plan Smarter with Our Patna Wedding Guides
            </h2>
          </div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-[#8B1A4A] font-semibold text-sm hover:gap-3 transition-all"
          >
            View All Guides <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block bg-white rounded-2xl overflow-hidden border border-[#C5A46D]/12 hover:shadow-lg hover:border-[#C5A46D]/30 transition-all"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-5">
                <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-wider mb-2">{post.category}</p>
                <h3 className="text-[#2A1F1B] font-semibold text-sm leading-snug mb-3 line-clamp-2 group-hover:text-[#8B1A4A] transition-colors">
                  {post.title}
                </h3>
                <p className="text-[#9A8A7A] text-xs flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> {post.readTime} min read
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
