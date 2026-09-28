// The couple's proposal pages (/proposal/<secret token>, docs/wedding-os/08-quotation.md §15). The URL itself is the key,
// so nothing that reports the page address elsewhere (analytics) and no marketing popup runs there. Client-safe.
export function isProposalPath(pathname: string | null | undefined): boolean {
  return pathname === '/proposal' || !!pathname?.startsWith('/proposal/');
}
