// Booking lines created from a quotation can be "custom" — a service the coordinator quoted before
// choosing which vendor delivers it. Such a BookingItem has no vendorId and this placeholder name.
// Conversion (services/weddingConversion.service.ts) turns each into a "pick a vendor" task instead of
// a VendorBooking. Before this, every vendor-less item was reported as "vendor no longer exists",
// which is wrong for a line that never had a vendor.
export const UNASSIGNED_VENDOR_NAME = 'To be assigned';

export interface ConvertibleItem {
  packageName: string;
  vendorName: string;
  vendorCategory: string;
  price: number; // per unit
  quantity: number;
}

// What a VendorBooking's agreed price is: the unit price times the quantity. Conversion used to
// copy only the unit price, so "500 plates × ₹800" became a ₹800 vendor booking.
export function agreedPriceFor(item: Pick<ConvertibleItem, 'price' | 'quantity'>): number {
  return item.price * item.quantity;
}

export function isUnassignedItem(item: Pick<ConvertibleItem, 'vendorName'>): boolean {
  return item.vendorName === UNASSIGNED_VENDOR_NAME;
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// The activity-log line and the follow-up task for an item that cannot become a VendorBooking yet.
export function planVendorlessItem(item: ConvertibleItem): { summary: string; taskTitle: string; taskDescription: string } {
  if (isUnassignedItem(item)) {
    return {
      summary: `No vendor assigned yet for "${item.packageName}" (${item.vendorCategory}) — ${inr(agreedPriceFor(item))} to allocate`,
      taskTitle: `Assign a vendor for "${item.packageName}"`,
      taskDescription: `Quoted as a custom line (${item.vendorCategory}): ${item.quantity} × ${inr(item.price)} = ${inr(agreedPriceFor(item))}. Choose the vendor and add the vendor booking.`,
    };
  }
  // Legacy case, wording unchanged: a real vendor that has since been removed.
  return {
    summary: `Skipped converting "${item.packageName}" (${item.vendorName}) — vendor no longer exists`,
    taskTitle: `Assign replacement vendor for "${item.packageName}"`,
    taskDescription: `Original vendor "${item.vendorName}" (${item.vendorCategory}) no longer exists. Original price: ${item.price}.`,
  };
}
