import Link from 'next/link';
import Image from 'next/image';
import { Star, MapPin, ChevronRight } from 'lucide-react';
import { Vendor } from '@/types';

interface Props {
  vendor: Vendor;
}

const CATEGORY_COLORS: Record<string, string> = {
  venue: 'bg-blue-100 text-blue-700',
  makeup: 'bg-pink-100 text-pink-700',
  mehndi: 'bg-green-100 text-green-700',
  decorator: 'bg-purple-100 text-purple-700',
  band: 'bg-orange-100 text-orange-700',
  dj: 'bg-indigo-100 text-indigo-700',
  catering: 'bg-yellow-100 text-yellow-700',
  'photo-video': 'bg-teal-100 text-teal-700',
};

const CATEGORY_NAMES: Record<string, string> = {
  venue: 'Venue',
  makeup: 'Makeup',
  mehndi: 'Mehndi',
  decorator: 'Decorator',
  band: 'Band',
  dj: 'DJ',
  catering: 'Catering',
  'photo-video': 'Photo & Video',
};

export default function VendorCard({ vendor }: Props) {
  const startingPrice = Math.min(...vendor.packages.map((p) => p.price));
  const catColor = CATEGORY_COLORS[vendor.category] || 'bg-gray-100 text-gray-700';

  return (
    <Link href={`/vendors/${vendor.id}`} className="block group vendor-card-luxury">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100/80 h-full transition-all duration-300 group-hover:border-[#C9A96E]/35 group-hover:shadow-[0_20px_50px_rgba(139,26,74,0.1)]">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={vendor.image}
            alt={vendor.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />

          {/* Hover CTA overlay */}
          <div className="absolute inset-0 bg-[#1C1208]/55 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[1px]">
            <span className="bg-white text-gray-900 text-xs font-semibold tracking-[0.08em] uppercase px-5 py-2.5 rounded-full flex items-center gap-2 shadow-xl">
              View Details <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Category badge */}
          <div className="absolute top-3 left-3">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full tracking-wider ${catColor}`}>
              {CATEGORY_NAMES[vendor.category]}
            </span>
          </div>

          {/* Rating badge */}
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm flex items-center gap-1 px-2.5 py-1 rounded-full shadow-sm">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-[11px] font-bold text-gray-900">{vendor.rating}</span>
          </div>

          {/* Featured badge */}
          {vendor.isFeatured && (
            <div className="absolute bottom-3 left-3 bg-[#8B1A4A] text-white text-[9px] font-bold px-3 py-1.5 rounded-full uppercase tracking-[0.15em]">
              Featured
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-1.5">
            <h3 className="text-gray-900 font-semibold text-[0.92rem] line-clamp-1 group-hover:text-[#8B1A4A] transition-colors font-[var(--font-playfair),serif]">
              {vendor.name}
            </h3>
          </div>

          <div className="flex items-center gap-1 text-gray-400 text-xs mb-3">
            <MapPin className="w-3 h-3 text-[#C9A96E] flex-shrink-0" />
            <span>{vendor.city}</span>
            <span className="text-gray-200 mx-1">·</span>
            <Star className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="text-gray-500">({vendor.reviewCount} reviews)</span>
          </div>

          {/* Features */}
          <div className="flex flex-wrap gap-1.5 mb-3 max-h-[52px] overflow-hidden">
            {vendor.features.slice(0, 4).map((f) => (
              <span
                key={f}
                title={f}
                className="text-[10px] bg-[#FAF5EE] text-gray-500 px-2 py-0.5 rounded border border-[#E8D4A0]/50 leading-relaxed cursor-default"
              >
                {f}
              </span>
            ))}
            {vendor.features.length > 4 && (
              <span
                title={vendor.features.slice(4).join(' · ')}
                className="text-[10px] bg-[#FFF8F0] text-[#C9A96E] px-2 py-0.5 rounded border border-[#C9A96E]/20 cursor-help flex-shrink-0"
              >
                +{vendor.features.length - 4} more
              </span>
            )}
          </div>

          {/* Price CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-[0.15em] mb-0.5">Starting from</p>
              <p className="text-[#8B1A4A] font-bold text-base">
                ₹{startingPrice.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-9 h-9 flex items-center justify-center rounded-full border border-[#C9A96E]/30 group-hover:bg-[#8B1A4A] group-hover:border-[#8B1A4A] transition-all duration-300">
              <ChevronRight className="w-4 h-4 text-[#C9A96E] group-hover:text-white transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
