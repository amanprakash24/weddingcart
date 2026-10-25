// Shared classes for the homepage sections (components/home), A+ design (25 Oct 2026).
// Cormorant Garamond for headings, DM Sans for text; both self-hosted in app/layout.tsx.
export const serif = { fontFamily: 'var(--font-cormorant), Georgia, serif' } as const;

export const sectionPad = 'px-4 py-16 sm:px-6 sm:py-20 lg:py-24';
export const container = 'mx-auto max-w-[1240px]';

// Small uppercase label with a gold rule before it
export const eyebrow =
  "flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#8A6A2F] before:h-px before:w-7 before:bg-[#C9A86A] before:content-['']";
export const h2 = 'mt-3 text-[2.2rem] font-semibold leading-[1.05] tracking-[-0.01em] text-[#221714] sm:text-[2.8rem] lg:text-[3.3rem]';
export const accent = 'italic text-[#7A1238]';
export const lede = 'mt-4 max-w-2xl text-base leading-relaxed text-[#4D3E36] sm:text-lg';

const btnBase =
  'inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
export const btnPrimary = `${btnBase} bg-[#7A1238] text-white hover:bg-[#5A0D29] focus-visible:ring-[#7A1238]`;
export const btnOutline = `${btnBase} border border-[#D9C7AA] text-[#221714] hover:border-[#7A1238] hover:text-[#7A1238] focus-visible:ring-[#7A1238]`;
export const btnGold = `${btnBase} bg-[#E9C98E] text-[#1A0E0C] hover:bg-[#F3D9A4] focus-visible:ring-[#E9C98E] focus-visible:ring-offset-[#1A0E0C]`;
export const btnLight = `${btnBase} border border-white/40 text-white hover:bg-white/10 focus-visible:ring-white`;
export const btnWhatsApp = `${btnBase} bg-[#1F7A4D] text-white hover:bg-[#17603C] focus-visible:ring-[#1F7A4D]`;
