// The couple's proposal pages (/proposal/<secret token>, docs/wedding-os/08-quotation.md §15) — and the same page at
// /quotation/<secret token> (20 Nov 2026), the address the CRM's WhatsApp message carries. The URL itself is the key, so
// nothing that reports the page address elsewhere (analytics) and no marketing popup runs there. Client-safe.
export function isProposalPath(pathname: string | null | undefined): boolean {
  return pathname === '/proposal' || !!pathname?.startsWith('/proposal/') || pathname === '/quotation' || !!pathname?.startsWith('/quotation/');
}

// Where the "free wedding consultation" popup may open: the homepage only (24 Nov 2026, the founder's decision). It used to open on
// every public page and covered forms people came to fill in — a review from the QR (/review), a vendor's registration, a listing.
export function isCouplePromptPath(pathname: string | null | undefined): boolean {
  return pathname === '/';
}

// Vendor OS (/vendor, /vendor/…) has its own shell, so the marketplace chrome (navbar, footer, contact banner, cart, popup) stays out
// of it. Exact on purpose: the PUBLIC pages /vendors/… and /vendor-onboarding also start with "/vendor" and must keep the site chrome.
// Also My Wedding (/my-wedding, 28 Oct 2026) and its sign-in page (/customer/login) — the couple's side of Vivah OS has its own shell too.
// And a venue's own enquiry page (/enquire/<slug>, 11 Nov 2026): the venue's brand, powered by Vivah OS — no Shaadi Shopping chrome or popup.
export function isVendorOsPath(pathname: string | null | undefined): boolean {
  return pathname === '/vendor' || !!pathname?.startsWith('/vendor/') || pathname === '/workspace' || pathname === '/my-wedding' || !!pathname?.startsWith('/my-wedding/') || pathname === '/customer/login' || !!pathname?.startsWith('/enquire/');
}
