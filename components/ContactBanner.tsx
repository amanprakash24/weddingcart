'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, Phone, Mail } from 'lucide-react';

const WhatsAppIcon = () => (
  <svg viewBox="0 0 32 32" className="w-4 h-4 fill-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 2C8.28 2 2 8.28 2 16c0 2.46.67 4.76 1.83 6.74L2 30l7.45-1.79A13.93 13.93 0 0 0 16 30c7.72 0 14-6.28 14-14S23.72 2 16 2zm0 25.5a11.44 11.44 0 0 1-5.83-1.6l-.42-.25-4.42 1.06 1.1-4.3-.28-.44A11.47 11.47 0 0 1 4.5 16C4.5 9.6 9.6 4.5 16 4.5S27.5 9.6 27.5 16 22.4 27.5 16 27.5zm6.3-8.57c-.34-.17-2.03-1-2.35-1.12-.32-.11-.55-.17-.78.17-.23.34-.9 1.12-1.1 1.35-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.02-1.9-2.36-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59H9.8c-.2 0-.54.07-.82.37-.28.3-1.08 1.06-1.08 2.58s1.1 2.99 1.26 3.2c.16.2 2.17 3.32 5.26 4.65.74.32 1.31.51 1.76.65.74.23 1.41.2 1.94.12.59-.09 1.82-.74 2.07-1.46.26-.72.26-1.34.18-1.46-.07-.12-.28-.2-.62-.37z"/>
  </svg>
);

export default function ContactBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 13000);
    return () => clearTimeout(t);
  }, []);

  if (pathname.startsWith('/admin') || !visible) return null;

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-2.5">

      {/* Expanded concierge panel */}
      {expanded && (
        <div
          className="w-[296px] bg-[#FFFAF5] rounded-2xl border border-[#C9A96E]/20 animate-slide-up"
          style={{
            boxShadow: '0 8px 40px rgba(28,18,8,0.12), 0 2px 8px rgba(28,18,8,0.06)',
            transformOrigin: 'bottom right',
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-4">
            <div>
              <p className="text-[0.6rem] text-[#C9A96E] font-semibold tracking-[0.24em] uppercase mb-1.5">
                Wedding Concierge
              </p>
              <h3 className="font-[Playfair_Display,serif] font-semibold text-[#1C1208] text-[1.05rem] leading-snug">
                Need Wedding Guidance?
              </h3>
              <p className="text-[#9A8A7A] text-[0.78rem] leading-relaxed mt-1.5">
                Our experts are here to help — no pressure, just honest guidance.
              </p>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="flex-shrink-0 ml-3 mt-0.5 w-6 h-6 flex items-center justify-center text-[#C9A96E]/50 hover:text-[#C9A96E] transition-colors rounded-full"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-px mx-5 bg-[#C9A96E]/15" />

          {/* Actions */}
          <div className="px-5 py-4 space-y-2">
            {/* WhatsApp — primary */}
            <a
              href="https://wa.me/917070486987"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full bg-[#8B1A4A] text-white px-4 py-3 rounded-xl text-sm font-semibold hover:bg-[#7A1640] transition-colors"
            >
              <WhatsAppIcon />
              Chat on WhatsApp
            </a>

            {/* Call + Email — secondary */}
            <div className="flex gap-2">
              <a
                href="tel:+917646028228"
                className="flex-1 flex items-center justify-center gap-1.5 border border-[#C9A96E]/25 text-[#7A6A5A] px-3 py-2.5 rounded-xl text-xs font-medium hover:border-[#C9A96E]/50 hover:text-[#8B1A4A] transition-all"
              >
                <Phone className="w-3.5 h-3.5" />
                Call
              </a>
              <a
                href="mailto:hello@shaadishopping.com"
                className="flex-1 flex items-center justify-center gap-1.5 border border-[#C9A96E]/25 text-[#7A6A5A] px-3 py-2.5 rounded-xl text-xs font-medium hover:border-[#C9A96E]/50 hover:text-[#8B1A4A] transition-all"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Floating pill — collapsed */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2.5 bg-[#1C1208] text-[#C9A96E] pl-3.5 pr-4 py-2.5 rounded-full hover:bg-[#2A1C0E] hover:scale-[1.02] transition-all animate-fade-in"
          style={{ boxShadow: '0 4px 24px rgba(28,18,8,0.28)' }}
        >
          {/* Gold pulse dot — replaces the bright green */}
          <span className="relative flex w-2 h-2 flex-shrink-0">
            <span
              className="absolute inline-flex w-full h-full rounded-full bg-[#C9A96E]/50 animate-ping"
              style={{ animationDuration: '2.5s' }}
            />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-[#C9A96E]" />
          </span>
          <span className="text-[0.72rem] font-semibold tracking-[0.06em] whitespace-nowrap">
            Wedding Expert Available
          </span>
        </button>
      )}

    </div>
  );
}
