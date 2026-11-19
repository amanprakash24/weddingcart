'use client';

import { useCart } from '@/context/CartContext';
import type { Vendor, Package } from '@/types';
import s from './venue.module.css';

// "Add to my plan" on a package: the same wedding-plan cart the old venue page used. One package per category, as before.
export default function VenuePackageButton({ vendor, pkg }: { vendor: Vendor; pkg: Package }) {
  const { addItem, removeItem, items } = useCart();
  const inPlan = items.some((i) => i.vendor.id === vendor.id && i.package.id === pkg.id);

  function toggle() {
    if (inPlan) return removeItem(vendor.id, pkg.id);
    const sameCategory = items.find((i) => i.vendor.category === vendor.category);
    if (sameCategory) removeItem(sameCategory.vendor.id, sameCategory.package.id);
    addItem(vendor, pkg);
  }

  return (
    <button type="button" className={s.pkBtn} aria-pressed={inPlan} onClick={toggle}>
      {inPlan ? 'In my plan' : 'Add to my plan'}
    </button>
  );
}
