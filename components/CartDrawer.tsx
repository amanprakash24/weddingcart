'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X, Trash2, Plus, Minus, ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQty, total } = useCart();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen && items.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ zIndex: 10000, touchAction: 'manipulation' }}
        className={`fixed inset-0 drawer-backdrop transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeCart}
      />

      {/* Drawer */}
      <div
        style={{ zIndex: 10001 }}
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-rose-500 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg font-[Playfair_Display,serif]">Wedding Plan</h2>
              <p className="text-white/80 text-xs">{items.length} service{items.length !== 1 ? 's' : ''} selected</p>
            </div>
          </div>
          <button
            onClick={closeCart}
            className="w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart className="w-10 h-10 text-amber-300" />
              </div>
              <h3 className="text-gray-700 font-semibold text-lg mb-2">Your plan is empty</h3>
              <p className="text-gray-400 text-sm mb-6">Start adding vendors to build your dream wedding</p>
              <button
                onClick={closeCart}
                className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-all"
              >
                Browse Vendors
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={`${item.vendor.id}-${item.package.id}`} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1.5">
                      {item.vendor.category.replace('-', ' ')}
                    </span>
                    <h4 className="text-gray-900 font-semibold text-sm line-clamp-1">{item.vendor.name}</h4>
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{item.package.name}</p>
                    <p className="text-amber-600 font-bold text-sm mt-1">
                      ₹{item.package.price.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.vendor.id, item.package.id)}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quantity */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
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
                  <span className="font-bold text-gray-900">
                    ₹{(item.package.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 p-5 flex-shrink-0 space-y-4 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Estimated Total</span>
              <span className="text-2xl font-bold gradient-text">
                ₹{total.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-gray-400 text-xs">
              * Final pricing may vary. Our planners will confirm the exact quote.
            </p>
            <Link
              href="/plan"
              onClick={closeCart}
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all hover:shadow-lg text-sm"
            >
              Proceed to Plan
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={closeCart}
              className="w-full text-gray-500 text-sm hover:text-gray-700 transition-colors py-1"
            >
              Continue Browsing
            </button>
          </div>
        )}
      </div>
    </>
  );
}
