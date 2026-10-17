// Shared classes for the homepage sections (components/home). Colours come from the tokens in app/globals.css.
export const serif = { fontFamily: 'var(--font-playfair), serif' } as const;

export const sectionPad = 'px-4 py-14 sm:px-6 sm:py-20 lg:py-24';
export const container = 'mx-auto max-w-6xl';

// Small uppercase label above a heading. Uses the darker "gold text" token so it is readable on ivory.
export const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--gold-text)]';
export const h2 = 'mt-3 text-[1.9rem] leading-tight text-[var(--deep-dark)] sm:text-[2.4rem]';
export const lede = 'mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--warm-brown)] sm:text-base';

const btnBase =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
export const btnPrimary = `${btnBase} bg-[var(--maroon)] text-white hover:bg-[var(--maroon-dark)] focus-visible:ring-[var(--maroon)]`;
export const btnOutline = `${btnBase} border border-[var(--maroon)]/35 text-[var(--maroon)] hover:bg-[var(--maroon)] hover:text-white focus-visible:ring-[var(--maroon)]`;
export const btnLight = `${btnBase} border border-white/40 text-white hover:bg-white/10 focus-visible:ring-white`;
export const btnWhatsApp = `${btnBase} bg-[#1F7A4D] text-white hover:bg-[#17603C] focus-visible:ring-[#1F7A4D]`;
