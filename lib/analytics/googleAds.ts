// Reuses the gtag.js instance already loaded in app/layout.tsx (GA4) — no
// second Google tag is installed here, this just fires a Google Ads
// conversion event through the same window.gtag.
declare global {
  interface Window {
    gtag?: (command: 'js' | 'config' | 'event' | 'set', ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const CONVERSION_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID;
const CONVERSION_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;

// Fires the Google Ads "lead submitted" conversion for a successful /plan
// wizard consultation request — call this only after a confirmed-success API
// response, never on page view, step navigation, or a failed submission.
// No-ops until NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID/_LABEL are set (see
// .env.example) — deliberately not hardcoded.
export function trackConsultationLeadConversion(): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  if (!CONVERSION_ID || !CONVERSION_LABEL) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Google Ads conversion not tracked: NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID / NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL not set.'
      );
    }
    return;
  }

  window.gtag('event', 'conversion', {
    send_to: `${CONVERSION_ID}/${CONVERSION_LABEL}`,
    value: 1,
    currency: 'INR',
  });
}
