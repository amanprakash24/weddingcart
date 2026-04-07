'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, CheckCircle, ChevronRight, X, User, Phone, MapPin } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { Category } from '@/types';

const CITIES = ['Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Udaipur', 'Goa'];

export default function CartPageClient() {
  const { items, total, removeItem, updateQty, clearCart } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState({ name: '', phone: '', city: 'Patna' });
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => { if (d.success) setCategories(d.data); });
  }, []);

  // Categories already covered by cart items
  const coveredCategories = new Set(items.map((i) => i.vendor.category));

  // Suggested = categories not yet in cart
  const suggested = categories.filter((c) => !coveredCategories.has(c.id));

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookingForm,
          items: items.map((i) => ({
            vendorName: i.vendor.name,
            vendorCategory: i.vendor.category,
            packageName: i.package.name,
            price: i.package.price,
            quantity: i.quantity,
          })),
          total,
        }),
      });
      setBooked(true);
      clearCart();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-16 min-h-screen bg-[#FFFAF5]">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 via-rose-400 to-rose-500 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white font-[Playfair_Display,serif]">Your Wedding Plan</h1>
              <p className="text-white/80 text-sm">{items.length} service{items.length !== 1 ? 's' : ''} selected</p>
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
                </div>
              ))}
            </div>

            {/* ── Right: Summary ── */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-24">
                <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>

                <div className="space-y-2 mb-4">
                  {items.map((item) => (
                    <div key={`${item.vendor.id}-${item.package.id}`} className="flex justify-between text-sm">
                      <span className="text-gray-500 truncate mr-2">{item.vendor.name}</span>
                      <span className="font-medium text-gray-900 flex-shrink-0">₹{(item.package.price * item.quantity).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-3 mb-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Estimated Total</span>
                    <span className="text-2xl font-bold gradient-text">₹{total.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">* Final pricing confirmed by our planners</p>
                </div>

                <button
                  onClick={() => setShowBooking(true)}
                  className="mt-4 flex items-center justify-center gap-2 w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all hover:shadow-lg text-sm"
                >
                  Book Now <ArrowRight className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 animate-scale-in relative">
            <button
              onClick={() => setShowBooking(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-1">Confirm Your Booking</h2>
            <p className="text-gray-500 text-sm mb-5">Our executive will contact you shortly to confirm all details.</p>

            {/* Order mini-summary */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5 space-y-1.5">
              {items.map((item) => (
                <div key={`${item.vendor.id}-${item.package.id}`} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate mr-2">{item.vendor.name} — {item.package.name}</span>
                  <span className="font-semibold text-amber-700 flex-shrink-0">₹{(item.package.price * item.quantity).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="border-t border-amber-200 pt-2 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="gradient-text">₹{total.toLocaleString('en-IN')}</span>
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
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 outline-none transition-colors"
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
                    value={bookingForm.phone}
                    onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 outline-none transition-colors"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">City *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={bookingForm.city}
                    onChange={(e) => setBookingForm({ ...bookingForm, city: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-400 outline-none transition-colors appearance-none"
                  >
                    {CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-60 text-sm"
              >
                {submitting ? 'Confirming...' : 'Confirm Booking'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Success Popup ── */}
      {booked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-scale-in">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-2">Booking Confirmed! 🎉</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-2">
              Your booking is successfully placed.
            </p>
            <p className="text-gray-600 text-sm font-medium mb-6">
              Our executive will connect with you shortly.
            </p>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 text-left space-y-1.5">
              <p className="text-sm text-gray-700"><span className="font-semibold">Name:</span> {bookingForm.name}</p>
              <p className="text-sm text-gray-700"><span className="font-semibold">Phone:</span> {bookingForm.phone}</p>
              <p className="text-sm text-gray-700"><span className="font-semibold">City:</span> {bookingForm.city}</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold px-8 py-3 rounded-full hover:opacity-90 transition-all text-sm"
            >
              Back to Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
