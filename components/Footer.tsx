import Link from 'next/link';
import { Heart, Phone, Mail, MapPin, Share2, MessageCircle, PlayCircle, AtSign } from 'lucide-react';

const categories = [
  { label: 'Venues', href: '/categories/venue' },
  { label: 'Makeup Artists', href: '/categories/makeup' },
  { label: 'Mehndi', href: '/categories/mehndi' },
  { label: 'Decorators', href: '/categories/decorator' },
  { label: 'Band & Music', href: '/categories/band' },
  { label: 'DJ', href: '/categories/dj' },
  { label: 'Catering', href: '/categories/catering' },
  { label: 'Photo & Video', href: '/categories/photo-video' },
];

const cities = ['Patna', 'Delhi', 'Mumbai', 'Jaipur', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Udaipur', 'Goa'];

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-300">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-6 h-6 fill-rose-500 text-rose-500" />
              <span className="text-xl font-bold text-white font-[Playfair_Display,serif]">ShaadiShopping</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-1">
              India&apos;s premier wedding planning marketplace. Discover, compare, and book top vendors for your dream wedding.
            </p>
            <p className="text-gray-500 text-xs mb-5">Founded by <span className="text-amber-400 font-medium">Anisha Kumari</span>, Patna, Bihar.</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <a href="tel:+917070486987" className="hover:text-amber-400 transition-colors">+91 70704 86987</a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <a href="mailto:hello@shaadishopping.com" className="hover:text-amber-400 transition-colors">hello@shaadishopping.com</a>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>Patna, Bihar, India</span>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Vendor Categories</h4>
            <ul className="space-y-2">
              {categories.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className="text-sm text-gray-400 hover:text-amber-400 transition-colors hover:pl-1 duration-200 block">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cities */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Top Cities</h4>
            <ul className="space-y-2">
              {cities.map((city) => (
                <li key={city}>
                  <Link href={`/categories/venue?city=${city}`} className="text-sm text-gray-400 hover:text-amber-400 transition-colors hover:pl-1 duration-200 block">
                    {city}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 mb-6">
              {[
                { label: 'About Us', href: '#' },
                { label: 'How It Works', href: '#' },
                { label: 'For Vendors', href: '#' },
                { label: 'Blog', href: '#' },
                { label: 'Careers', href: '#' },
                { label: 'Privacy Policy', href: '#' },
                { label: 'Terms of Service', href: '#' },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-gray-400 hover:text-amber-400 transition-colors hover:pl-1 duration-200 block">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Socials */}
            <div className="flex items-center gap-3">
              {[
                { Icon: Share2, href: '#', label: 'Instagram' },
                { Icon: MessageCircle, href: '#', label: 'Facebook' },
                { Icon: PlayCircle, href: '#', label: 'YouTube' },
                { Icon: AtSign, href: '#', label: 'Twitter' },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:bg-amber-500 hover:text-white transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-500 text-sm text-center">
            © {new Date().getFullYear()} ShaadiShopping. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-gray-500 text-sm">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            <span>in Patna, Bihar for couples across India</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
