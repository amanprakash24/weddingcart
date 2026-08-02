'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, MapPin, Users, CheckCircle, ChevronRight } from 'lucide-react';
import { shaadiWhatsAppLink } from '@/lib/shaadiContact';

export interface LocalityVenue {
  name: string;
  tagline: string;
  area: string;
  rating: number;
  capacityLabel: string;
  capacityMax: number;
  vegPrice: number;
  nonVegPrice: number;
  rooms: string;
  highlights: string[];
  href: string;
  image: string;
  imageAlt: string;
}

const CAPACITY_FILTERS: { id: string; label: string; test: (v: LocalityVenue) => boolean }[] = [
  { id: 'all', label: 'All Capacities', test: () => true },
  { id: 'under-250', label: 'Up to 250 Guests', test: (v) => v.capacityMax <= 250 },
  { id: '250-500', label: '250 – 500 Guests', test: (v) => v.capacityMax > 250 && v.capacityMax <= 500 },
  { id: '500-plus', label: '500+ Guests', test: (v) => v.capacityMax > 500 },
];

const BUDGET_FILTERS: { id: string; label: string; test: (v: LocalityVenue) => boolean }[] = [
  { id: 'all', label: 'Any Budget', test: () => true },
  { id: 'under-1000', label: 'Under ₹1,000/plate', test: (v) => v.vegPrice < 1000 },
  { id: '1000-1300', label: '₹1,000 – 1,300/plate', test: (v) => v.vegPrice >= 1000 && v.vegPrice <= 1300 },
  { id: '1300-plus', label: '₹1,300+/plate', test: (v) => v.vegPrice > 1300 },
];

export function VenueFilterList({ venues }: { venues: LocalityVenue[] }) {
  const [capacityFilter, setCapacityFilter] = useState('all');
  const [budgetFilter, setBudgetFilter] = useState('all');

  const capTest = CAPACITY_FILTERS.find((f) => f.id === capacityFilter)!.test;
  const budgetTest = BUDGET_FILTERS.find((f) => f.id === budgetFilter)!.test;
  const filtered = venues.filter((v) => capTest(v) && budgetTest(v));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2.5">
        {CAPACITY_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setCapacityFilter(f.id)}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
              capacityFilter === f.id
                ? 'bg-[#8B1A4A] border-[#8B1A4A] text-white'
                : 'border-[#C5A46D]/30 text-[#6B5B4D] hover:border-[#C5A46D]/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        {BUDGET_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setBudgetFilter(f.id)}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
              budgetFilter === f.id
                ? 'bg-[#C5A46D] border-[#C5A46D] text-white'
                : 'border-[#C5A46D]/30 text-[#6B5B4D] hover:border-[#C5A46D]/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          No venues match these filters. Try widening your budget or capacity range, or talk to a Wedding Expert for options.
        </div>
      ) : (
        <div className="space-y-8">
          {filtered.map((venue) => {
            const wa = shaadiWhatsAppLink(`Hi, I am looking for a wedding venue like ${venue.name}. Please help.`);
            return (
              <div key={venue.name} className="bg-white rounded-3xl overflow-hidden border border-[#C5A46D]/15 shadow-sm hover:shadow-lg transition-shadow duration-300">
                <div className="grid md:grid-cols-5 gap-0">
                  <div className="relative md:col-span-2 aspect-[4/3] md:aspect-auto min-h-[220px]">
                    <Image src={venue.image} alt={venue.imageAlt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 40vw" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <span className="absolute top-3 right-3 bg-white/95 text-[#2A1F1B] text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-[#C5A46D] text-[#C5A46D]" /> {venue.rating}
                    </span>
                  </div>

                  <div className="md:col-span-3 p-6 flex flex-col justify-between">
                    <div>
                      <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.15em] mb-1">{venue.tagline}</p>
                      <h3 className="text-xl sm:text-2xl font-bold text-[#2A1F1B] mb-2" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                        {venue.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-4">
                        <MapPin className="w-3.5 h-3.5 text-[#C5A46D] flex-shrink-0" />
                        <span>{venue.area}</span>
                        <span className="text-gray-300 mx-1">·</span>
                        <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{venue.capacityLabel}</span>
                      </div>

                      <div className="flex gap-4 mb-4">
                        <div className="bg-[#FAF5EE] border border-[#C5A46D]/20 rounded-xl px-4 py-3">
                          <p className="text-[9px] text-gray-400 uppercase tracking-[0.12em] mb-0.5">Veg / plate</p>
                          <p className="text-[#8B1A4A] font-bold text-lg">₹{venue.vegPrice.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-[#FAF5EE] border border-[#C5A46D]/20 rounded-xl px-4 py-3">
                          <p className="text-[9px] text-gray-400 uppercase tracking-[0.12em] mb-0.5">Non-Veg / plate</p>
                          <p className="text-[#8B1A4A] font-bold text-lg">₹{venue.nonVegPrice.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-[#FAF5EE] border border-[#C5A46D]/20 rounded-xl px-4 py-3">
                          <p className="text-[9px] text-gray-400 uppercase tracking-[0.12em] mb-0.5">Stay</p>
                          <p className="text-[#2A1F1B] font-semibold text-sm mt-1">{venue.rooms}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {venue.highlights.map((h) => (
                          <span key={h} className="flex items-center gap-1 text-[10px] bg-[#FAF5EE] text-[#6B5B4D] border border-[#E8D4A0]/50 px-2 py-1 rounded-full">
                            <CheckCircle className="w-2.5 h-2.5 text-[#C5A46D] flex-shrink-0" /> {h}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link
                        href={venue.href}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#8B1A4A] text-white font-bold py-3.5 rounded-xl text-sm hover:opacity-90 transition-all"
                        style={{ boxShadow: '0 4px 16px rgba(139,26,74,0.3)' }}
                      >
                        View Venue & Book <ChevronRight className="w-4 h-4" />
                      </Link>
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 border border-[#C5A46D]/40 text-[#8B1A4A] font-semibold px-5 py-3.5 rounded-xl text-sm hover:bg-[#8B1A4A]/5 transition-all"
                      >
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
