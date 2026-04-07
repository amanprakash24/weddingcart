'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { usePathname } from 'next/navigation';

export default function CartFAB() {
  const { itemCount } = useCart();
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) return null;
  if (pathname === '/cart') return null;
  if (itemCount === 0) return null;

  return (
    <Link
      href="/cart"
      aria-label="View wedding plan cart"
      style={{ touchAction: 'manipulation', zIndex: 9990 }}
      className="fixed bottom-24 right-5 flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white pl-4 pr-5 py-3 rounded-full shadow-2xl hover:shadow-amber-200 hover:scale-105 transition-all duration-200 animate-fade-in"
    >
      <div className="relative">
        <ShoppingCart className="w-5 h-5" />
        <span className="absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center bg-white text-amber-600 text-[10px] font-bold rounded-full">
          {itemCount}
        </span>
      </div>
      <span className="text-sm font-semibold">View Cart</span>
    </Link>
  );
}
