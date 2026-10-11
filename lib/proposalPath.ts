// The couple's proposal pages (/proposal/<secret token>, docs/wedding-os/08-quotation.md §15). The URL itself is the key,
// so nothing that reports the page address elsewhere (analytics) and no marketing popup runs there. Client-safe.
export function isProposalPath(pathname: string | null | undefined): boolean {
  return pathname === '/proposal' || !!pathname?.startsWith('/proposal/');
}

// Vendor OS (/vendor, /vendor/…) has its own shell, so the marketplace chrome (navbar, footer, contact banner, cart, popup) stays out
// of it. Exact on purpose: the PUBLIC pages /vendors/… and /vendor-onboarding also start with "/vendor" and must keep the site chrome.
// Where the "free wedding consultation" popup must NOT open: it is a prompt for couples. Not for the team (admin), a business at
// work (Vendor OS), a couple reading their private proposal, or someone signing up to work with us — a Growth Partner, or a business
// filling in the registration form (/vendor-onboarding), whose form the popup used to cover after ten seconds.
export function isCouplePromptPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !(pathname === '/admin' || pathname.startsWith('/admin/') || isVendorOsPath(pathname) || isProposalPath(pathname) || pathname.startsWith('/growth-partner') || pathname === '/vendor-onboarding' || pathname.startsWith('/vendor-onboarding/'));
}

export function isVendorOsPath(pathname: string | null | undefined): boolean {
  return pathname === '/vendor' || !!pathname?.startsWith('/vendor/') || pathname === '/workspace';
}
