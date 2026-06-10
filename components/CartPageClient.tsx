'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, CheckCircle, ChevronRight, X, User, Phone, MapPin } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { Category } from '@/types';

const CITIES = ['Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa'];

const GST_RATE = 0.18;

function isPerPlateItem(features?: string[]) {
  return features?.some((f) => f.toLowerCase().includes('per plate')) ?? false;
}

export default function CartPageClient() {
  const { items, total, removeItem, updateQty, clearCart } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState({ name: '', phone: '', city: 'Patna' });
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);
  const [guestCounts, setGuestCounts] = useState<Record<string, number>>({});

  const itemKey = (item: { vendor: { id: string }; package: { id: string } }) =>
    `${item.vendor.id}-${item.package.id}`;
  const getGuests = (key: string) => guestCounts[key] ?? 100;
  const setGuests = (key: string, val: number) =>
    setGuestCounts((prev) => ({ ...prev, [key]: Math.max(1, val) }));

  // Per-plate items: rentalMax + (price × guests) + 18% GST on food; regular: price × qty
  const calcItemTotal = (item: typeof items[0]) => {
    const key = itemKey(item);
    if (isPerPlateItem(item.package.features)) {
      const rental = item.vendor.priceMax ?? 0;
      const food = item.package.price * getGuests(key);
      return rental + food + food * GST_RATE;
    }
    return item.package.price * item.quantity;
  };
  const calculatedTotal = items.reduce((sum, item) => sum + calcItemTotal(item), 0);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => { if (d.success) setCategories(d.data); });
  }, []);

  // Categories already covered by cart items
  const coveredCategories = new Set(items.map((i) => i.vendor.category));

  // Suggested = categories not yet in cart
  const suggested = categories.filter((c) => !coveredCategories.has(c.id));

  const isValidPhone = (v: string) => /^\d{10}$/.test(v.replace(/[\s\-\+\(\)]/g, ''));

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(bookingForm.phone)) return;
    setSubmitting(true);
    try {
      await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookingForm,
          items: items.map((i) => ({
            vendorId: i.vendor.id,
            vendorName: i.vendor.name,
            vendorCategory: i.vendor.category,
            packageName: i.package.name,
            price: i.package.price,
            quantity: i.quantity,
          })),
          total: Math.round(calculatedTotal),
        }),
      });
      setBooked(true);
      clearCart();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-24 min-h-screen bg-[#FFFAF5]">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 via-rose-400 to-rose-500 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { step: 1, label: 'Browse Vendors' },
              { step: 2, label: 'Review Plan' },
              { step: 3, label: 'Expert Consultation' },
              { step: 4, label: 'Wedding Day' },
            ].map(({ step, label }, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 ${step === 2 ? 'opacity-100' : 'opacity-50'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${step === 2 ? 'bg-white text-amber-500 border-white' : 'bg-white/20 text-white border-white/40'}`}>
                    {step}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${step === 2 ? 'text-white' : 'text-white/70'}`}>{label}</span>
                </div>
                {i < 3 && <div className="w-6 sm:w-10 h-px bg-white/30 flex-shrink-0" />}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white font-[Playfair_Display,serif]">Your Wedding Plan</h1>
              <p className="text-white/80 text-sm">{items.length} service{items.length !== 1 ? 's' : ''} selected · Review and consult our wedding expert</p>
            </div>
          </div>

        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {items.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100 max-w-md mx-auto">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <ShoppingCart className="w-10 h-10 text-amber-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2 font-[Playfair_Display,serif]">Your plan is empty</h2>
            <p className="text-gray-500 text-sm mb-6">Start browsing vendors and add packages to build your dream wedding.</p>
            <Link href="/" className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-3 rounded-full font-semibold text-sm hover:opacity-90 transition-all">
              Browse Vendors <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Left: Cart items ── */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-gray-900 text-lg">Selected Services</h2>
                <button onClick={clearCart} className="text-xs text-rose-500 hover:underline font-medium">Clear all</button>
              </div>

              {items.map((item) => (
                <div key={`${item.vendor.id}-${item.package.id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex gap-4 p-4">
                    {/* Vendor image */}
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                      {item.vendor.image && (
                        <Image src={item.vendor.image} alt={item.vendor.name} fill className="object-cover" sizes="80px" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="inline-block bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1">
                        {item.vendor.category.replace(/-/g, ' ')}
                      </span>
                      <h4 className="text-gray-900 font-semibold text-sm leading-tight">{item.vendor.name}</h4>
                      <p className="text-gray-500 text-xs mt-0.5">{item.package.name}</p>
                      {item.package.features?.slice(0, 2).map((f) => (
                        <span key={f} className="inline-block text-[10px] text-gray-400 mr-2">• {f}</span>
                      ))}
                    </div>

                    <button
                      onClick={() => removeItem(item.vendor.id, item.package.id)}
                      className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors flex-shrink-0 self-start"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {isPerPlateItem(item.package.features) ? (
                    <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-xs font-semibold text-amber-800">No. of Guests</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setGuests(itemKey(item), getGuests(itemKey(item)) - 50)}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all text-xs font-bold"
                          >−</button>
                          <input
                            type="number"
                            min={1}
                            value={getGuests(itemKey(item))}
                            onChange={(e) => setGuests(itemKey(item), parseInt(e.target.value) || 1)}
                            onFocus={(e) => e.target.select()}
                            className="w-20 text-center text-sm font-bold border border-amber-200 rounded-lg py-1 outline-none focus:border-amber-400 bg-white"
                          />
                          <button
                            onClick={() => setGuests(itemKey(item), getGuests(itemKey(item)) + 50)}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all text-xs font-bold"
                          >+</button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 flex justify-between">
                        <span>₹{item.package.price.toLocaleString('en-IN')}/plate × {getGuests(itemKey(item))} guests</span>
                        <span className="font-semibold text-gray-700">₹{(item.package.price * getGuests(itemKey(item))).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(item.vendor.id, item.package.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-40 transition-all"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.vendor.id, item.package.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-amber-50 hover:border-amber-300 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold text-gray-900 text-sm">
                        ₹{(item.package.price * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Right: Summary ── */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-24">
                <h3 className="font-bold text-gray-900 mb-4 font-[Playfair_Display,serif]">Order Summary</h3>

                <div className="space-y-4 mb-4">
                  {items.map((item) => {
                    const key = itemKey(item);
                    const perPlate = isPerPlateItem(item.package.features);
                    const guests = getGuests(key);
                    const foodCost = perPlate ? item.package.price * guests : item.package.price * item.quantity;
                    const gst = perPlate ? foodCost * GST_RATE : 0;
                    return (
                      <div key={key} className="space-y-1.5">
                        <p className="text-xs font-semibold text-gray-700 truncate">{item.vendor.name} — {item.package.name}</p>
                        {perPlate ? (
                          <>
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>Rental &amp; Decoration</span>
                              <span className="font-medium text-gray-700">₹{(item.vendor.priceMax ?? 0).toLocaleString('en-IN')}</span>
                            </div>
                            <p className="text-[10px] text-amber-600 -mt-0.5 italic">* Rate negotiable — final cost on discussion</p>
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>Food (₹{item.package.price.toLocaleString('en-IN')} × {guests} guests)</span>
                              <span>₹{foodCost.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>GST @18% (on food)</span>
                              <span>₹{Math.round(gst).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between text-xs font-semibold text-gray-800 border-t border-dashed border-gray-200 pt-1">
                              <span>Item Total</span>
                              <span>₹{Math.round((item.vendor.priceMax ?? 0) + foodCost + gst).toLocaleString('en-IN')}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>{item.package.name}</span>
                            <span className="font-medium text-gray-800">₹{foodCost.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-gray-200 pt-3 mb-1 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700 text-sm">Estimated Total</span>
                    <span className="text-2xl font-bold gradient-text">₹{Math.round(calculatedTotal).toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-gray-400 text-[11px]">* Includes 18% GST on food. Final pricing confirmed by our planners.</p>
                </div>

                <button
                  onClick={() => setShowBooking(true)}
                  className="mt-4 flex items-center justify-center gap-2 w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all hover:shadow-lg text-sm"
                >
                  Consult Wedding Expert <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  href="/"
                  className="mt-2 flex items-center justify-center w-full text-gray-500 text-sm hover:text-gray-700 transition-colors py-2"
                >
                  Continue Browsing
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Complete Your Wedding ── */}
        {suggested.length > 0 && (
          <div className="mt-14">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-gray-900 text-xl font-[Playfair_Display,serif]">Complete Your Wedding</h2>
            </div>
            <p className="text-gray-500 text-sm mb-6 ml-8">
              You haven&apos;t added these yet — explore vendors and add to your plan.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {suggested.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.id}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all"
                >
                  <div className="relative h-32 overflow-hidden">
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute top-2 left-2 w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center text-base shadow-sm">
                      {cat.icon}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-gray-900 text-xs leading-tight mb-1 group-hover:text-amber-600 transition-colors">{cat.name}</p>
                    <div className="flex items-center gap-1 text-amber-600 text-xs font-semibold">
                      Explore <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Booking Modal ── */}
      {showBooking && !booked && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-y-auto max-h-[92vh] relative">

            {/* Premium header strip */}
            <div className="bg-gradient-to-r from-amber-500 to-rose-500 px-7 pt-7 pb-5 rounded-t-3xl">
              <button
                onClick={() => setShowBooking(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-all"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-xl font-bold text-white font-[Playfair_Display,serif]">Consult a Wedding Expert</h2>
              <p className="text-white/80 text-sm mt-1">Share your details — our expert will call you shortly.</p>
            </div>

            <div className="px-7 py-6">
              {/* Order mini-summary */}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 space-y-1.5">
                {items.map((item) => (
                  <div key={itemKey(item)} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate mr-2">{item.vendor.name} — {item.package.name}</span>
                    <span className="font-semibold text-amber-700 flex-shrink-0">₹{Math.round(calcItemTotal(item)).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="border-t border-amber-200 pt-2 flex justify-between font-bold text-sm">
                  <span>Total (incl. GST)</span>
                  <span className="gradient-text">₹{Math.round(calculatedTotal).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <form onSubmit={handleBook} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      value={bookingForm.name}
                      onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 outline-none transition-colors bg-gray-50 focus:bg-white"
                      placeholder="Priya Sharma"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={bookingForm.phone}
                      onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className={`w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-colors border bg-gray-50 focus:bg-white ${bookingForm.phone && !isValidPhone(bookingForm.phone) ? 'border-rose-400 focus:border-rose-500' : 'border-gray-200 focus:border-amber-400'}`}
                      placeholder="10-digit mobile number"
                    />
                    {bookingForm.phone && !isValidPhone(bookingForm.phone) && (
                      <p className="text-xs text-rose-500 mt-1">Enter a valid 10-digit mobile number</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">City *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={bookingForm.city}
                      onChange={(e) => setBookingForm({ ...bookingForm, city: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 outline-none transition-colors appearance-none bg-gray-50 focus:bg-white"
                    >
                      {CITIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting || !isValidPhone(bookingForm.phone)}
                  className="w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold py-4 rounded-xl hover:opacity-90 transition-all disabled:opacity-60 text-sm shadow-lg shadow-amber-200 mt-2"
                >
                  {submitting ? 'Confirming...' : 'Confirm & Get Expert Call'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Popup ── */}
      {booked && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-y-auto max-h-[92vh] animate-scale-in">

            {/* Gradient header with logo */}
            <div className="bg-gradient-to-r from-amber-500 to-rose-500 px-8 pt-8 pb-6 rounded-t-3xl text-center">
              <div className="bg-white rounded-2xl px-5 py-3 inline-flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Image src="/logo.png" alt="ShaadiShopping" width={120} height={75} className="object-contain h-12 w-auto" />
              </div>
              <h2 className="text-2xl font-bold text-white font-[Playfair_Display,serif]">Enquiry Received!</h2>
              <p className="text-white/80 text-xs font-semibold uppercase tracking-widest mt-1">We&apos;ll reach out shortly</p>
            </div>

            <div className="px-7 py-6 text-center">
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Thank you, <span className="font-semibold text-gray-700">{bookingForm.name}</span>! Our wedding expert will call you on <span className="font-semibold text-gray-700">{bookingForm.phone}</span> to understand your requirements and help plan your perfect wedding.
              </p>

              {/* What happens next */}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 text-left space-y-3">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">What happens next</p>
                {[
                  'Our expert reviews your selected services',
                  'We call you within 24 hours to discuss details',
                  'You get a personalised wedding plan & quote',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                    <p className="text-gray-600 text-xs leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>

              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold px-8 py-3 rounded-full hover:opacity-90 transition-all text-sm"
              >
                Back to Home
              </Link>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
