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
              <strong>Shaadi Shopping</strong> (ShaadiShopping) is Patna&apos;s trusted, expert-guided wedding planning platform,
              expanding across Bihar. Unlike other wedding websites that simply list vendors, Shaadi Shopping
              assigns you a dedicated wedding expert who personally guides your entire wedding journey — from finding
              the right venue to coordinating every vendor on your wedding day.
            </p>
            <p className="text-[#6B5B4E] text-sm sm:text-base leading-relaxed mb-6">
              Every couple gets one dedicated Wedding Expert from booking to vidaai — completely free. Our network
              includes verified vendors — banquet halls, bridal makeup artists, photographers, mehndi artists,
              decorators, caterers, DJs, and wedding bands. Every vendor on Shaadi Shopping is personally verified
              by our team, and we recommend vendors based on your budget, not commissions.
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
              { label: 'Wedding Expert', value: '1 Dedicated Expert Per Couple' },
              { label: 'Vendor Selection', value: 'Budget-Based, Not Commissions' },
              { label: 'Expanding Across', value: 'Bihar' },
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
