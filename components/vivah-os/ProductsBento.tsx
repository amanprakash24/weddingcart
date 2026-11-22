// "Interactive Tech Stack Bento Grid with Hover Effects" (the founder, 12 Nov 2026) for the Vivah OS page: the four products,
// each with its own logo. On a computer a tile lifts, glows and opens its list on hover (and on keyboard focus); on a phone,
// which has no hover, every list is simply shown. Only what each product does today is listed.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import VivahOsLogo from '@/components/vivah-os/VivahOsLogo';
import type { Product } from '@/lib/productName';

const PRODUCTS: { product: Product; who: string; points: string[]; href: string; cta: string; className: string; glow: string }[] = [
  {
    product: 'VENUE',
    who: 'For banquet halls, lawns and hotels — and the vendors they work with.',
    points: ['Enquiries from every source, with follow-ups', 'Quotations from your price list, per plate or per function', 'Bookings, payments by UPI and money still to collect', 'Weddings function by function, with your team'],
    href: '/vendor-onboarding',
    cta: 'Request early access',
    className: 'md:col-span-2 md:row-span-2',
    glow: 'from-[#7B3FF2]/40',
  },
  {
    product: 'VENDOR',
    who: 'For photographers, DJs, bands, decorators, bouncers and more.',
    points: ['Your own enquiries and price list', 'Quotations the couple accepts on their phone', 'Payments and your team'],
    href: '/vendor-onboarding',
    cta: 'Request early access',
    className: 'md:col-span-2',
    glow: 'from-[#FF6B8B]/35',
  },
  {
    product: 'CLIENT',
    who: 'For the couple and their family.',
    points: ['Functions, payments and receipts', 'Guests and RSVP', 'Documents and the people to call'],
    href: '/customer/login',
    cta: 'Couple sign-in',
    className: '',
    glow: 'from-[#7DD3FC]/35',
  },
  {
    product: 'VIVAH',
    who: 'For the Shaadi Shopping team.',
    points: ['Sends couples to your business', 'Tracks what came through Shaadi Shopping'],
    href: '/plan',
    cta: 'Plan with Shaadi Shopping',
    className: '',
    glow: 'from-[#E9C98E]/35',
  },
];

export default function ProductsBento() {
  return (
    <ul className="grid gap-4 md:auto-rows-[minmax(190px,auto)] md:grid-cols-4">
      {PRODUCTS.map((p) => (
        <li key={p.product} className={p.className}>
          <Link
            href={p.href}
            className="group relative flex h-full min-h-[190px] flex-col gap-3 overflow-hidden rounded-[26px] border border-white/12 bg-white/[0.06] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl outline-none transition duration-300 hover:-translate-y-1 hover:border-[#C4B5FD]/60 hover:bg-white/[0.1] hover:shadow-[0_24px_60px_-24px_rgba(123,63,242,0.9)] focus-visible:-translate-y-1 focus-visible:border-[#C4B5FD] motion-reduce:transform-none motion-reduce:transition-none"
          >
            {/* the tile's own colour, brighter on hover */}
            <span aria-hidden className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br ${p.glow} to-transparent opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100`} />
            <VivahOsLogo size={34} tone="light" product={p.product} />
            <p className="relative text-sm leading-relaxed text-[#CBD5E1]">{p.who}</p>
            <ul className="relative mt-1 flex flex-col gap-1.5 text-sm text-white md:max-h-0 md:overflow-hidden md:opacity-0 md:transition-all md:duration-300 md:group-hover:max-h-60 md:group-hover:opacity-100 md:group-focus-visible:max-h-60 md:group-focus-visible:opacity-100">
              {p.points.map((pt) => (
                <li key={pt} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C4B5FD]" />{pt}</li>
              ))}
            </ul>
            <span className="relative mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-[#DDD6FE]">
              {p.cta} <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
