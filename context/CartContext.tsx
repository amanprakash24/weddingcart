'use client';

import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { CartItem, Vendor, Package } from '@/types';

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

type CartAction =
  | { type: 'ADD_ITEM'; vendor: Vendor; package: Package }
  | { type: 'REMOVE_ITEM'; vendorId: string; packageId: string }
  | { type: 'UPDATE_QTY'; vendorId: string; packageId: string; quantity: number }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_CART' }
  | { type: 'OPEN_CART' }
  | { type: 'CLOSE_CART' }
  | { type: 'HYDRATE'; items: CartItem[] };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const exists = state.items.find(
        (i) => i.vendor.id === action.vendor.id && i.package.id === action.package.id
      );
      if (exists) {
        return {
          ...state,
          isOpen: true,
          items: state.items.map((i) =>
            i.vendor.id === action.vendor.id && i.package.id === action.package.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        ...state,
        isOpen: true,
        items: [...state.items, { vendor: action.vendor, package: action.package, quantity: 1 }],
      };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(
          (i) => !(i.vendor.id === action.vendorId && i.package.id === action.packageId)
        ),
      };
    case 'UPDATE_QTY':
      return {
        ...state,
        items: state.items.map((i) =>
          i.vendor.id === action.vendorId && i.package.id === action.packageId
            ? { ...i, quantity: Math.max(1, action.quantity) }
            : i
        ),
      };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    case 'TOGGLE_CART':
      return { ...state, isOpen: !state.isOpen };
    case 'OPEN_CART':
      return { ...state, isOpen: true };
    case 'CLOSE_CART':
      return { ...state, isOpen: false };
    case 'HYDRATE':
      return { ...state, items: action.items };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  total: number;
  itemCount: number;
  addItem: (vendor: Vendor, pkg: Package) => void;
  removeItem: (vendorId: string, packageId: string) => void;
  updateQty: (vendorId: string, packageId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wc_cart');
      if (saved) dispatch({ type: 'HYDRATE', items: JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('wc_cart', JSON.stringify(state.items));
  }, [state.items]);

  const total = state.items.reduce((sum, i) => sum + i.package.price * i.quantity, 0);
  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  const addItem = useCallback((vendor: Vendor, pkg: Package) =>
    dispatch({ type: 'ADD_ITEM', vendor, package: pkg }), []);
  const removeItem = useCallback((vendorId: string, packageId: string) =>
    dispatch({ type: 'REMOVE_ITEM', vendorId, packageId }), []);
  const updateQty = useCallback((vendorId: string, packageId: string, quantity: number) =>
    dispatch({ type: 'UPDATE_QTY', vendorId, packageId, quantity }), []);
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);
  const openCart = useCallback(() => dispatch({ type: 'OPEN_CART' }), []);
  const closeCart = useCallback(() => dispatch({ type: 'CLOSE_CART' }), []);
  const toggleCart = useCallback(() => dispatch({ type: 'TOGGLE_CART' }), []);

  return (
    <CartContext.Provider value={{ items: state.items, isOpen: state.isOpen, total, itemCount, addItem, removeItem, updateQty, clearCart, openCart, closeCart, toggleCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
