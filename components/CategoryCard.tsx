import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Category } from '@/types';

interface Props {
  category: Category;
}

export default function CategoryCard({ category }: Props) {
  return (
    <Link href={`/categories/${category.id}`} className="block group">
      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-md img-zoom">
        <Image
          src={category.image}
          alt={category.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 12.5vw"
          className="object-cover"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/70 transition-all duration-300" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <h3 className="text-white font-bold text-base leading-tight mb-1">
              {category.name}
            </h3>
            <p className="text-white/70 text-xs mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 line-clamp-2">
              {category.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-xs">{category.vendorCount}+ vendors</span>
              <div className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 group-hover:bg-amber-500 transition-colors border border-white/30">
                <ArrowRight className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Top gradient accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
    </Link>
  );
}
