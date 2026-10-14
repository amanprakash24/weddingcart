// Custom GA4 events through the gtag already loaded by components/GoogleAnalytics.tsx (never loaded on /proposal).
// No-ops when gtag isn't there (server render, blocked by the browser, or the proposal pages).
export type AnalyticsEvent = 'growth_partner_cta_click' | 'growth_partner_registered' | 'growth_partner_referral_submitted';

export function trackEvent(name: AnalyticsEvent, params: Record<string, string | number> = {}): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', name, params);
  } catch {
    // analytics must never break the page
  }
}
