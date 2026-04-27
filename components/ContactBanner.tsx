'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { X, Mail, Phone } from 'lucide-react';
import Link from 'next/link';

export default function ContactBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  if (pathname.startsWith('/admin')) return null;

  return (
    <div className="fixed bottom-6 right-5 z-50 flex flex-col items-end gap-3">
      {/* Popup */}
      {open && (
        <div className="relative w-[300px] sm:w-[330px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-slide-up">
          {/* Close button */}
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3 p-4 pr-10">
            <div className="text-4xl leading-none flex-shrink-0 mt-1">👰🤵</div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-sm mb-0.5">Have wedding questions?</h3>
              <p className="text-gray-500 text-xs leading-relaxed mb-3">
                Reach out to our wedding experts to plan your Dream Wedding NOW!
              </p>

              {/* Three action icons */}
              <div className="flex items-center gap-3 mb-3">
                {/* Mail */}
                <a
                  href="mailto:hello@shaadishopping.com"
                  className="w-10 h-10 flex items-center justify-center bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all shadow-md"
                  aria-label="Email us"
                  title="Email us"
                >
                  <Mail className="w-5 h-5" />
                </a>

                {/* Call */}
                <a
                  href="tel:+917070486987"
                  className="w-10 h-10 flex items-center justify-center bg-amber-500 text-white rounded-full hover:bg-amber-600 transition-all shadow-md"
                  aria-label="Call us"
                  title="Call us"
                >
                  <Phone className="w-5 h-5" />
                </a>

                {/* WhatsApp */}
                <a
                  href="https://wa.me/917070486987"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 flex items-center justify-center bg-[#25D366] text-white rounded-full hover:bg-[#1ebe5d] transition-all shadow-md"
                  aria-label="WhatsApp us"
                  title="WhatsApp us"
                >
                  <svg viewBox="0 0 32 32" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 2C8.28 2 2 8.28 2 16c0 2.46.67 4.76 1.83 6.74L2 30l7.45-1.79A13.93 13.93 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5a11.44 11.44 0 0 1-5.83-1.6l-.42-.25-4.42 1.06 1.1-4.3-.28-.44A11.47 11.47 0 0 1 4.5 16C4.5 9.6 9.6 4.5 16 4.5S27.5 9.6 27.5 16 22.4 27.5 16 27.5zm6.3-8.57c-.34-.17-2.03-1-2.35-1.12-.32-.11-.55-.17-.78.17-.23.34-.9 1.12-1.1 1.35-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.02-1.9-2.36-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59H9.8c-.2 0-.54.07-.82.37-.28.3-1.08 1.06-1.08 2.58s1.1 2.99 1.26 3.2c.16.2 2.17 3.32 5.26 4.65.74.32 1.31.51 1.76.65.74.23 1.41.2 1.94.12.59-.09 1.82-.74 2.07-1.46.26-.72.26-1.34.18-1.46-.07-.12-.28-.2-.62-.37z"/>
                  </svg>
                </a>

              </div>

              <Link
                href="/plan"
                className="text-rose-600 font-semibold text-xs hover:underline"
                onClick={() => setOpen(false)}
              >
                Get inspired here →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Contact Us floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Contact us"
        className="w-14 h-14 rounded-full shadow-xl hover:scale-110 hover:shadow-2xl transition-all overflow-hidden"
      >
        <Image src="/contact-icon2.png" alt="Contact us" width={56} height={56} className="object-cover w-full h-full" />
      </button>
    </div>
  );
}
