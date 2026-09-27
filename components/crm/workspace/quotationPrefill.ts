import type { LeadWorkspace } from './types';

export type QuotationPrefillLine = {
  description: string;
  category?: string;
  vendorId?: string;
};

const normalize = (value: string) => value.trim().toLowerCase();

export function consultationQuotationPrefill(
  services: string[],
  selections: LeadWorkspace['consultationVendorSelections']
): QuotationPrefillLine[] {
  const vendorByService = new Map(selections.map((selection) => [normalize(selection.serviceKey), selection.vendorId]));
  return services.map((service) => ({
    description: service,
    category: service,
    vendorId: vendorByService.get(normalize(service)),
  }));
}
