'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, MapPin, ChevronLeft, ChevronRight, CheckCircle, Phone, Calendar, Users, X, ShoppingCart, ChevronRight as CR, Check } from 'lucide-react';
import { Vendor, Package } from '@/types';
import { useCart } from '@/context/CartContext';

interface Props { id: string }

export default function VendorDetailClient({ id }: Props) {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [showEnquiry, setShowEnquiry] = useState(false);
  const [enquiryForm, setEnquiryForm] = useState({ name: '', phone: '', email: '', eventDate: '', guestCount: '', eventType: 'wedding', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    fetch(`/api/vendors/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setVendor(d.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = (pkg: Package) => {
    if (!vendor) return;
    addItem(vendor, pkg);
    setSelectedPkg(pkg);
    setTimeout(() => setSelectedPkg(null), 2000);
  };

  const handleEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) return;
    setSubmitting(true);
    try {
      await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: vendor.id,
          vendorName: vendor.name,
          vendorCategory: vendor.category,
          ...enquiryForm,
        }),
      });
      setSubmitted(true);
      setTimeout(() => { setShowEnquiry(false); setSubmitted(false); }, 3000);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="pt-16 min-h-screen">
      <div className="skeleton h-96" />
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="skeleton h-10 w-2/3 rounded-xl" />
          <div className="skeleton h-6 w-1/3 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
        <div className="skeleton h-80 rounded-xl" />
      </div>
    </div>
  );

  if (!vendor) return (
    <div className="pt-24 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-700 mb-4">Vendor not found</h2>
        <Link href="/" className="text-amber-600 hover:underline">Back to home</Link>
      </div>
    </div>
  );

  const images = vendor.images?.length ? vendor.images : [vendor.image];
  const startingPrice = Math.min(...vendor.packages.map((p) => p.price));

  return (
    <div className="pt-16">
      {/* Image Hero */}
      <section className="relative h-72 sm:h-[420px] overflow-hidden bg-gray-900">
        <div className="absolute inset-0">
          {images.map((src, i) => (
            <div key={src} className={`absolute inset-0 transition-opacity duration-700 ${i === imgIdx ? 'opacity-100' : 'opacity-0'}`}>
              <Image src={src} alt={vendor.name} fill sizes="100vw" className="object-cover" priority={i === 0} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
          ))}
        </div>

        {/* Controls */}
        {images.length > 1 && (
          <>
            <button onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setImgIdx((i) => (i + 1) % images.length)} className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full transition-all">
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)} className={`rounded-full transition-all ${i === imgIdx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />
              ))}
            </div>
          </>
        )}

        {/* Breadcrumb */}
        <div className="absolute top-4 left-4 z-10">
          <nav className="flex items-center gap-2 text-white/80 text-sm">
            <Link href="/" className="hover:text-white">Home</Link>
            <CR className="w-3.5 h-3.5" />
            <Link href={`/categories/${vendor.category}`} className="hover:text-white capitalize">{vendor.category.replace('-', ' ')}</Link>
            <CR className="w-3.5 h-3.5" />
            <span className="text-white line-clamp-1">{vendor.name}</span>
          </nav>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-6 left-4 right-4 z-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white font-[Playfair_Display,serif] mb-1">{vendor.name}</h1>
              <div className="flex items-center gap-4 text-white/80 text-sm">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-300" />
                  {vendor.city}
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                  <span className="font-bold text-white">{vendor.rating}</span>
                  <span>({vendor.reviewCount} reviews)</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-xs">Starting from</p>
              <p className="text-amber-300 font-bold text-2xl">₹{startingPrice.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Star, label: 'Rating', value: `${vendor.rating}/5` },
                { icon: Users, label: 'Reviews', value: vendor.reviewCount.toString() },
                { icon: ShoppingCart, label: 'Packages', value: vendor.packages.length.toString() },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Icon className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-gray-700 font-bold text-lg">{value}</p>
                  <p className="text-gray-500 text-xs">{label}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-3 font-[Playfair_Display,serif]">About {vendor.name}</h2>
              <p className="text-gray-600 leading-relaxed">{vendor.description}</p>
            </div>

            {/* Amenities/Features */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4 font-[Playfair_Display,serif]">Services & Amenities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vendor.features.map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Photo Gallery */}
            {images.length > 1 && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4 font-[Playfair_Display,serif]">Photo Gallery</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((src, i) => (
                    <button
                      key={src}
                      onClick={() => setLightbox(i)}
                      className="relative aspect-video rounded-xl overflow-hidden img-zoom group"
                    >
                      <Image src={src} alt={`Photo ${i + 1}`} fill sizes="33vw" className="object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">View</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Packages */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-5 font-[Playfair_Display,serif]">Packages & Pricing</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {vendor.packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`relative rounded-2xl border-2 p-5 transition-all ${
                      pkg.isPopular
                        ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-rose-50'
                        : 'border-gray-200 bg-gray-50 hover:border-amber-300'
                    }`}
                  >
                    {pkg.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                        Most Popular
                      </div>
                    )}
                    <div className="mb-3">
                      <h3 className="font-bold text-gray-900 text-base">{pkg.name}</h3>
                      <p className="text-gray-500 text-xs mt-0.5">{pkg.description}</p>
                    </div>
                    <p className="text-amber-600 font-bold text-2xl mb-4">
                      ₹{pkg.price.toLocaleString('en-IN')}
                    </p>
                    <ul className="space-y-2 mb-5">
                      {pkg.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleAddToCart(pkg)}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        selectedPkg?.id === pkg.id
                          ? 'bg-emerald-500 text-white'
                          : pkg.isPopular
                          ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white hover:opacity-90'
                          : 'bg-white border-2 border-amber-400 text-amber-600 hover:bg-amber-500 hover:text-white hover:border-amber-500'
                      }`}
                    >
                      {selectedPkg?.id === pkg.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" /> Added to Plan!
                        </span>
                      ) : (
                        'Add to Plan'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Sticky sidebar */}
          <div className="space-y-4">
            <div className="sticky top-24">
              {/* Quick actions */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                <h3 className="font-bold text-gray-900 mb-4 font-[Playfair_Display,serif]">Quick Actions</h3>
                <button
                  onClick={() => setShowEnquiry(true)}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold py-3 rounded-xl mb-3 hover:opacity-90 transition-all text-sm"
                >
                  <Phone className="w-4 h-4" /> Send Enquiry
                </button>
                <Link
                  href="/plan"
                  className="flex items-center justify-center gap-2 w-full border-2 border-amber-400 text-amber-600 font-semibold py-3 rounded-xl hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all text-sm"
                >
                  <Calendar className="w-4 h-4" /> Plan Your Wedding
                </Link>
              </div>

              {/* Price summary card */}
              <div className="bg-gradient-to-br from-amber-50 to-rose-50 rounded-2xl border border-amber-200 p-5">
                <p className="text-amber-700 text-xs font-semibold uppercase tracking-wider mb-2">Price Range</p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold gradient-text">₹{(vendor.priceMin).toLocaleString('en-IN')}</span>
                  <span className="text-gray-400">—</span>
                  <span className="text-xl font-semibold text-gray-600">₹{(vendor.priceMax).toLocaleString('en-IN')}</span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Packages available</span>
                    <span className="font-semibold text-gray-900">{vendor.packages.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Location</span>
                    <span className="font-semibold text-gray-900">{vendor.city}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Rating</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-gray-900">{vendor.rating}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300">
            <X className="w-8 h-8" />
          </button>
          <div className="relative w-full max-w-4xl aspect-video" onClick={(e) => e.stopPropagation()}>
            <Image src={images[lightbox]} alt="Gallery" fill sizes="90vw" className="object-contain" />
          </div>
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setLightbox((l) => ((l ?? 0) - 1 + images.length) % images.length); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setLightbox((l) => ((l ?? 0) + 1) % images.length); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full">
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Enquiry Modal */}
      {showEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowEnquiry(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-500 to-rose-500 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg font-[Playfair_Display,serif]">Send Enquiry</h3>
                <p className="text-white/80 text-xs">{vendor.name}</p>
              </div>
              <button onClick={() => setShowEnquiry(false)} className="text-white hover:text-white/80">
                <X className="w-5 h-5" />
              </button>
            </div>
            {submitted ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <h4 className="text-gray-900 font-bold text-xl mb-2">Enquiry Sent!</h4>
                <p className="text-gray-500 text-sm">We&apos;ll connect you with {vendor.name} within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleEnquiry} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Name *</label>
                    <input required value={enquiryForm.name} onChange={(e) => setEnquiryForm({ ...enquiryForm, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:border-amber-400 transition-colors" placeholder="Priya Sharma" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone *</label>
                    <input required type="tel" value={enquiryForm.phone} onChange={(e) => setEnquiryForm({ ...enquiryForm, phone: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:border-amber-400 transition-colors" placeholder="+91 98765 43210" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                  <input type="email" value={enquiryForm.email} onChange={(e) => setEnquiryForm({ ...enquiryForm, email: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:border-amber-400 transition-colors" placeholder="priya@email.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Event Date *</label>
                    <input required type="date" value={enquiryForm.eventDate} onChange={(e) => setEnquiryForm({ ...enquiryForm, eventDate: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:border-amber-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Guest Count *</label>
                    <input required type="number" value={enquiryForm.guestCount} onChange={(e) => setEnquiryForm({ ...enquiryForm, guestCount: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:border-amber-400 transition-colors" placeholder="200" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Event Type</label>
                  <select value={enquiryForm.eventType} onChange={(e) => setEnquiryForm({ ...enquiryForm, eventType: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:border-amber-400 transition-colors">
                    {['Wedding', 'Sangeet', 'Mehendi', 'Reception', 'Engagement', 'Birthday', 'Other'].map((t) => (
                      <option key={t} value={t.toLowerCase()}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message</label>
                  <textarea rows={3} value={enquiryForm.message} onChange={(e) => setEnquiryForm({ ...enquiryForm, message: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:border-amber-400 transition-colors resize-none" placeholder="Any specific requirements or questions..." />
                </div>
                <button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-70 text-sm">
                  {submitting ? 'Sending...' : 'Send Enquiry'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
