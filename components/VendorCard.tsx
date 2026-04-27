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
    <Link href={`/vendors/${vendor.id}`} className="block group vendor-card">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 h-full">
        {/* Image */}
        <div className="relative aspect-[4/3] img-zoom">
          <Image
            src={vendor.image}
            alt={vendor.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
          />
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="bg-white text-gray-900 text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-1.5 shadow-lg">
              View Details <ChevronRight className="w-4 h-4" />
            </span>
          </div>

          {/* Category badge */}
          <div className="absolute top-3 left-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${catColor}`}>
              {CATEGORY_NAMES[vendor.category]}
            </span>
          </div>

          {/* Rating badge */}
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm flex items-center gap-1 px-2.5 py-1 rounded-full shadow-sm">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-gray-900">{vendor.rating}</span>
          </div>

          {/* Featured badge */}
          {vendor.isFeatured && (
            <div className="absolute bottom-3 left-3 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
              Featured
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-gray-900 font-semibold text-base line-clamp-1 group-hover:text-amber-600 transition-colors">
              {vendor.name}
            </h3>
          </div>

          <div className="flex items-center gap-1 text-gray-500 text-sm mb-3">
            <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span>{vendor.city}</span>
            <span className="text-gray-300 mx-1">·</span>
            <Star className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="text-gray-600 text-xs">({vendor.reviewCount})</span>
          </div>

          {/* Features — max 2 rows */}
          <div className="flex flex-wrap gap-1.5 mb-3 max-h-[54px] overflow-hidden">
            {vendor.features.slice(0, 4).map((f) => (
              <span
                key={f}
                title={f}
                className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md break-words leading-relaxed cursor-default"
              >
                {f}
              </span>
            ))}
            {vendor.features.length > 4 && (
              <span
                title={vendor.features.slice(4).join(' · ')}
                className="text-[11px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md cursor-help flex-shrink-0"
              >
                +{vendor.features.length - 4} more
              </span>
            )}
          </div>

          {/* Price CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">Starting from</p>
              <p className="text-amber-600 font-bold text-base">
                ₹{startingPrice.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-50 group-hover:bg-amber-500 transition-colors">
              <ChevronRight className="w-4 h-4 text-amber-500 group-hover:text-white transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
