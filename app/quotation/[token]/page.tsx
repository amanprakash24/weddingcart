// /quotation/<token>: the same client page as /proposal/<token> — the address the CRM's WhatsApp message carries
// (20 Nov 2026). Same component, same scope wrapper, same rate limit and no-index rules; nothing is duplicated.
export { default, metadata } from '../../proposal/[token]/page';

// Route segment config has to be written here, not re-exported.
export const dynamic = 'force-dynamic';
