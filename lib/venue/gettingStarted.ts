import type { Permission } from '@/lib/auth/permissions';

// "Getting started" on Today (Vendor OS): what a business that has just finished its profile should do first, in order. Pure and
// browser-safe. Nothing is stored: each line is done when the thing itself exists (an item on the price list, a UPI ID, an
// enquiry, a quotation that was sent), so the list ticks itself off and is gone for good once everything is there.
//
// A line is only offered to someone who may do it (lib/auth/permissions.ts) — a manager is never told to add a UPI ID.

export type StartKey = 'PRICE_LIST' | 'UPI' | 'ENQUIRY' | 'QUOTATION';

export interface StartFacts {
  offerings: number; // items on "What we offer" that are currently offered
  hasUpi: boolean; // a UPI ID is saved in Settings
  enquiries: number; // the business's own enquiries
  quotationsSent: number; // its own quotations that were sent to a couple
}

export interface StartStep {
  key: StartKey;
  title: string;
  why: string;
  href: string;
  done: boolean;
}

export interface GettingStarted {
  steps: StartStep[];
  doneCount: number;
  // true = nothing to show: every line this person could do is done, or there is none they may do.
  finished: boolean;
}

const STEPS: { key: StartKey; needs: Permission; title: string; why: string; href: string; done: (f: StartFacts) => boolean }[] = [
  { key: 'PRICE_LIST', needs: 'catalog', title: 'Add what you offer and your prices', why: 'Each item becomes a one-tap line when you make a quotation.', href: '/vendor/offerings', done: (f) => f.offerings > 0 },
  { key: 'UPI', needs: 'settings', title: 'Add your UPI ID', why: 'So your customers can pay you from the link you send them.', href: '/vendor/settings', done: (f) => f.hasUpi },
  { key: 'ENQUIRY', needs: 'enquiries', title: 'Add your first enquiry', why: 'Someone who called, walked in or messaged you about a wedding.', href: '/vendor/enquiries/new', done: (f) => f.enquiries > 0 },
  { key: 'QUOTATION', needs: 'quotations', title: 'Send your first quotation', why: 'Open an enquiry, make the quotation and send the link — they accept it on their phone.', href: '/vendor/enquiries', done: (f) => f.quotationsSent > 0 },
];

export function buildGettingStarted(facts: StartFacts, may: (permission: Permission) => boolean): GettingStarted {
  const steps = STEPS.filter((s) => may(s.needs)).map(({ key, title, why, href, done }) => ({ key, title, why, href, done: done(facts) }));
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, finished: steps.length === 0 || doneCount === steps.length };
}
