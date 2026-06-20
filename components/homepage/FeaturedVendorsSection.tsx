'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeUp, stagger } from './animations';
import VendorCard from '../VendorCard';
import { Vendor } from '@/types';

export default function FeaturedVendorsSection() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/vendors?limit=20');
      const data = await res.json();
      if (data.success) setVendors(data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const topVendors = [...vendors].sort((a, b) => b.rating - a.rating).slice(0, 3);

  return (
    <section className="py-16 sm:py-24 lg:py-32 bg-[#FEFBF6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-14"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger(0.15)}
        >
          <motion.p variants={fadeUp} className="eyebrow-luxury mb-4">Handpicked For You</motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-4xl sm:text-5xl font-semibold text-gray-900"
            style={{ fontFamily: 'var(--font-playfair, serif)' }}
          >
            Selected By Our <span className="gradient-text-maroon">Wedding Experts</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-400 text-sm mt-5 max-w-sm mx-auto">
            We don&apos;t list every vendor. We curate only those who consistently deliver excellence.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-8">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
                <div className="skeleton aspect-[4/3]" />
                <div className="p-4 space-y-3">
                  <div className="skeleton h-5 w-3/4 rounded-lg" />
                  <div className="skeleton h-4 w-1/2 rounded-lg" />
                  <div className="flex gap-2">
                    <div className="skeleton h-6 w-20 rounded-full" />
                    <div className="skeleton h-6 w-16 rounded-full" />
                  </div>
                  <div className="skeleton h-px w-full" />
                  <div className="skeleton h-6 w-28 rounded-lg" />
                </div>
              </div>
            ))
          ) : (
            topVendors.map((vendor) => (
              <motion.div
                key={vendor.id}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-40px' }}
              >
                <VendorCard vendor={vendor} />
              </motion.div>
            ))
          )}
        </div>

        {!loading && topVendors.length > 0 && (
          <div className="text-center mt-10">
            <Link
              href="/categories/venue"
              className="inline-flex items-center gap-2 border border-[#C5A46D]/35 text-[#8B1A4A] font-semibold px-8 py-3.5 rounded-full hover:bg-[#8B1A4A] hover:text-white hover:border-[#8B1A4A] transition-all text-sm"
            >
              Explore All Curated Vendors
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
