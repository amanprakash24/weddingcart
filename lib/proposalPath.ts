// The couple's proposal pages (/proposal/<secret token>, docs/wedding-os/08-quotation.md §15). The URL itself is the key,
// so nothing that reports the page address elsewhere (analytics) and no marketing popup runs there. Client-safe.
export function isProposalPath(pathname: string | null | undefined): boolean {
  return pathname === '/proposal' || !!pathname?.startsWith('/proposal/');
}

// Vendor OS (/vendor, /vendor/…) has its own shell, so the marketplace chrome (navbar, footer, contact banner, cart, popup) stays out
// of it. Exact on purpose: the PUBLIC pages /vendors/… and /vendor-onboarding also start with "/vendor" and must keep the site chrome.
export function isVendorOsPath(pathname: string | null | undefined): boolean {
  return pathname === '/vendor' || !!pathname?.startsWith('/vendor/');
}
