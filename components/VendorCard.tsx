import Link from 'next/link';
import Image from 'next/image';
import { Star, MapPin, ChevronRight } from 'lucide-react';
import { Vendor } from '@/types';

interface Props {
  vendor: Vendor;
}

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

  return (
    <Link href={`/vendors/${vendor.id}`} className="block group vendor-card-luxury">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100/80 h-full transition-all duration-300 group-hover:border-[#C5A46D]/35 group-hover:shadow-[0_20px_50px_rgba(139,26,74,0.1)]">

        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={vendor.image}
            alt={vendor.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {/* Soft bottom gradient — no flat black overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

          {/* Hover reveal — ivory pill, not white */}
          <div className="absolute inset-0 bg-[#1C1208]/50 opacity-0 group-hover:opacity-100 transition-opacity duration-400 flex items-center justify-center backdrop-blur-[2px]">
            <span className="bg-[#FFFCF7] text-[#2A1F1B] text-[10px] font-semibold tracking-[0.12em] uppercase px-5 py-2.5 rounded-full flex items-center gap-2 shadow-xl">
              View Details <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Category badge — single luxury style, no multi-color hues */}
          <div className="absolute top-3 left-3">
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full tracking-wider bg-[#2A1F1B]/70 text-[#C5A46D] backdrop-blur-sm border border-[#C5A46D]/20">
              {CATEGORY_NAMES[vendor.category] ?? vendor.category}
            </span>
          </div>

          {/* Rating badge — gold star to match palette */}
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm flex items-center gap-1 px-2.5 py-1 rounded-full shadow-sm">
            <Star className="w-3 h-3 fill-[#C5A46D] text-[#C5A46D]" />
            <span className="text-[11px] font-bold text-gray-900">{vendor.rating}</span>
          </div>

          {/* Featured */}
          {vendor.isFeatured && (
            <div className="absolute bottom-3 left-3 bg-[#8B1A4A] text-white text-[9px] font-semibold px-3 py-1.5 rounded-full uppercase tracking-[0.15em]">
              Featured
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3
            className="text-[#2A1F1B] font-semibold text-[0.92rem] line-clamp-1 group-hover:text-[#8B1A4A] transition-colors mb-1.5"
            style={{ fontFamily: 'var(--font-playfair, serif)' }}
          >
            {vendor.name}
          </h3>

          <div className="flex items-center gap-1 text-gray-400 text-xs mb-3">
            <MapPin className="w-3 h-3 text-[#C5A46D] flex-shrink-0" />
            <span>{vendor.city}</span>
            <span className="text-gray-200 mx-1">·</span>
            <span className="text-gray-500">({vendor.reviewCount} reviews)</span>
          </div>

          {/* Feature pills — ivory tone, no color clash */}
          <div className="flex flex-wrap gap-1.5 mb-3 max-h-[52px] overflow-hidden">
            {vendor.features.slice(0, 4).map((f) => (
              <span
                key={f}
                title={f}
                className="text-[10px] bg-[#FAF5EE] text-[#6B5B4D] px-2 py-0.5 rounded border border-[#E8D4A0]/50 leading-relaxed cursor-default"
              >
                {f}
              </span>
            ))}
            {vendor.features.length > 4 && (
              <span
                title={vendor.features.slice(4).join(' · ')}
                className="text-[10px] bg-[#FFF8F0] text-[#C5A46D] px-2 py-0.5 rounded border border-[#C5A46D]/20 cursor-help flex-shrink-0"
              >
                +{vendor.features.length - 4}
              </span>
            )}
          </div>

          {/* Price + arrow CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-[0.15em] mb-0.5">Starting from</p>
              <p className="text-[#8B1A4A] font-semibold text-base">₹{startingPrice.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-9 h-9 flex items-center justify-center rounded-full border border-[#C5A46D]/30 group-hover:bg-[#8B1A4A] group-hover:border-[#8B1A4A] transition-all duration-300">
              <ChevronRight className="w-4 h-4 text-[#C5A46D] group-hover:text-white transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
