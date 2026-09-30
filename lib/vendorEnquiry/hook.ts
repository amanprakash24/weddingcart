// Called by routes after a vendor link may have changed (a quote saved / revised / discarded, a consultation vendor
// chosen or removed). Keeps the vendor enquiries in step (04-vendor-os.md §9) — best-effort by design: vendor
// enquiries never block sales (blueprint Decision 8), so any failure, including loading the service, is only logged.
// The service is loaded on use, so importing this hook never opens a database connection.
import type { SourceType } from '@/services/leadInbox.service';

export async function afterVendorLinkChange(sourceType: SourceType, sourceId: string, actorId: string | null): Promise<void> {
  try {
    const { vendorEnquiryService } = await import('@/services/vendorEnquiry.service');
    await vendorEnquiryService.syncForSource(sourceType, sourceId, actorId);
  } catch (err) {
    console.error('afterVendorLinkChange: vendor enquiries not updated:', err);
  }
}

// The customer record a quotation belongs to (a quotation carries exactly one of these ids).
export function sourceOfQuotation(q: { leadId?: string | null; enquiryId?: string | null; consultationId?: string | null } | null | undefined): { sourceType: SourceType; sourceId: string } | null {
  if (!q) return null;
  if (q.enquiryId) return { sourceType: 'ENQUIRY', sourceId: q.enquiryId };
  if (q.consultationId) return { sourceType: 'CONSULTATION', sourceId: q.consultationId };
  if (q.leadId) return { sourceType: 'LEAD', sourceId: q.leadId };
  return null;
}
