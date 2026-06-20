'use client';

import React from 'react';
import Link from 'next/link';

export default function AboutBrandSection() {
  return (
    <section className="bg-[#F8F5EF] py-14 sm:py-16 border-t border-[#C5A46D]/10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-10 items-start">

          <div className="md:col-span-2">
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-3">About ShaadiShopping</p>
            <h2
              className="text-2xl sm:text-3xl font-semibold text-[#2A1F1B] mb-4 leading-tight"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              What is Shaadi Shopping?
            </h2>
            <p className="text-[#6B5B4E] text-sm sm:text-base leading-relaxed mb-4">
              <strong>Shaadi Shopping</strong> (ShaadiShopping) is India&apos;s expert-guided wedding planning platform
              headquartered in Patna, Bihar. Unlike other wedding websites that simply list vendors, Shaadi Shopping
              assigns you a dedicated wedding expert who personally guides your entire wedding journey — from finding
              the right venue to coordinating every vendor on your wedding day.
            </p>
            <p className="text-[#6B5B4E] text-sm sm:text-base leading-relaxed mb-6">
              Since launching, ShaadiShopping has helped over 10,000 couples plan weddings across Patna, Bihar,
              and 25+ cities in India. Our network includes 500+ verified vendors — banquet halls, bridal makeup
              artists, photographers, mehndi artists, decorators, caterers, DJs, and wedding bands. Every vendor
              on Shaadi Shopping is personally verified by our team.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/plan"
                className="inline-flex items-center gap-2 bg-[#8B1A4A] text-white font-semibold px-6 py-3 rounded-full text-sm hover:opacity-90 transition-all"
              >
                Start Planning Free
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 border border-[#C5A46D]/40 text-[#8B1A4A] font-medium px-6 py-3 rounded-full text-sm hover:bg-[#8B1A4A]/5 transition-all"
              >
                Learn More About Us
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Founded', value: 'Patna, Bihar' },
              { label: 'Couples Served', value: '10,000+' },
              { label: 'Verified Vendors', value: '500+' },
              { label: 'Cities Covered', value: '25+ Cities' },
              { label: 'Service', value: '100% Free for Couples' },
              { label: 'Contact', value: '+91-76460-28228' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center border-b border-[#C5A46D]/15 pb-3">
                <span className="text-xs text-[#9A8A7A] uppercase tracking-wider font-medium">{label}</span>
                <span className="text-sm font-semibold text-[#2A1F1B]">{value}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
