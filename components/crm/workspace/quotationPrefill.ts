import type { LeadWorkspace } from './types';
import { serviceLabel } from '@/lib/serviceLabels';

export type QuotationPrefillLine = {
  description: string;
  category?: string;
  vendorId?: string;
};

const normalize = (value: string) => value.trim().toLowerCase();

type Selection = LeadWorkspace['consultationVendorSelections'][number];

export function consultationQuotationPrefill(
  services: string[],
  selections: Pick<Selection, 'serviceKey' | 'vendorId'>[]
): QuotationPrefillLine[] {
  const vendorByService = new Map(selections.map((selection) => [normalize(selection.serviceKey), selection.vendorId]));
  // The line reads as the service's name ("Photography & Video", not "photo-video"); the vendor is matched on the
  // stored key. The function is left empty — the consultation doesn't say which function a service is for.
  return services.map((service) => {
    const label = serviceLabel(service) ?? service;
    return { description: label, category: label, vendorId: vendorByService.get(normalize(service)) };
  });
}

// The vendor chosen on the consultation for this line's service, if any — offered as a one-click suggestion in the
// quote editor when the line has no vendor yet (e.g. the vendor was selected after the draft was made). Matches the
// line's category or description against the selection's service key or its label ("venue" / "Venue").
export function suggestedVendor<S extends Pick<Selection, 'serviceKey'>>(
  line: { category: string | null | undefined; description: string | null | undefined },
  selections: S[]
): S | null {
  const wanted = [line.category, line.description].filter((v): v is string => !!v && !!v.trim()).map(normalize);
  if (wanted.length === 0) return null;
  return selections.find((s) => wanted.includes(normalize(s.serviceKey)) || wanted.includes(normalize(serviceLabel(s.serviceKey) ?? ''))) ?? null;
}
