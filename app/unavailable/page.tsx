import type { Metadata } from 'next';
import Unavailable from './Unavailable';

export const metadata: Metadata = { title: 'Not reachable just now — ShaadiShopping', robots: { index: false, follow: false } };

// Shown in place of an admin / Vendor OS / customer screen when the sign-in check itself cannot be made (proxy.ts) — the database
// could not be reached. The address in the browser stays the screen the person asked for, so "Try again" asks for it again.
export default function UnavailablePage() {
  return <Unavailable />;
}
