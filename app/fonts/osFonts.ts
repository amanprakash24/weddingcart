import localFont from 'next/font/local';

// The type for Venue OS, Vendor OS and Client OS (the founder's spec, 11 Nov 2026): Poppins for headings, Inter for text.
// Self-hosted like the site's other fonts (app/layout.tsx), so a build never downloads a font. Files and their SIL Open Font
// Licences are in this folder. Applied only inside the apps (the .os-theme wrapper), never on the public website.
export const osInter = localFont({
  src: [{ path: './Inter-latin-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-os-inter',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'sans-serif'],
});

export const osPoppins = localFont({
  src: [
    { path: './Poppins-500-latin.woff2', weight: '500', style: 'normal' },
    { path: './Poppins-600-latin.woff2', weight: '600', style: 'normal' },
    { path: './Poppins-700-latin.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-os-poppins',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'sans-serif'],
});

export const osFontClasses = `${osInter.variable} ${osPoppins.variable}`;
