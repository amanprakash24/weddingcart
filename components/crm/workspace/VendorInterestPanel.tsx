import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LeadWorkspace } from './types';

type Selection = {
  serviceKey: string;
  categoryId: string | null;
  vendorId: string;
  vendor: { id: string; name: string; city: string; category: { id: string; name: string; slug: string } };
  category: { id: string; name: string; slug: string } | null;
};

type VendorHit = { id: string; name: string; city: string; categoryId: string };

const normalize = (value: string) => value.trim().toLowerCase();

export default function VendorInterestPanel({
  vendorInterest,
  sourceType,
  consultationId,
  services,
  city,
  onSelectionChanged,
}: {
  vendorInterest: LeadWorkspace['vendorInterest'];
  sourceType: string;
  consultationId: string;
  services: string[];
  city: string | null;
  onSelectionChanged?: () => void | Promise<void>;
}) {
  const isConsultation = sourceType === 'CONSULTATION';
  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(isConsultation);
  const [error, setError] = useState<string | null>(null);
  const [activeService, setActiveService] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [vendors, setVendors] = useState<VendorHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyService, setBusyService] = useState<string | null>(null);

  const loadSelections = useCallback(async () => {
    if (!isConsultation) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/crm/consultations/${consultationId}/vendor-selections`);
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? 'Failed to load vendor selections');
      setSelections(payload.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendor selections');
    } finally {
      setLoading(false);
    }
  }, [consultationId, isConsultation]);

  useEffect(() => {
    const timeout = setTimeout(loadSelections, 0);
    return () => clearTimeout(timeout);
  }, [loadSelections]);

  useEffect(() => {
    if (!activeService || query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ search: query.trim(), limit: '20', sort: 'rating' });
        if (city) params.set('city', city);
        const response = await fetch(`/api/vendors?${params}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error ?? 'Failed to search vendors');
        setVendors(payload.data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Failed to search vendors');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [activeService, city, query]);

  const selectionByService = useMemo(
    () => new Map(selections.map((selection) => [normalize(selection.serviceKey), selection])),
    [selections]
  );

  const selectVendor = async (serviceKey: string, vendor: VendorHit) => {
    setBusyService(serviceKey);
    setError(null);
    try {
      const response = await fetch(`/api/crm/consultations/${consultationId}/vendor-selections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceKey, vendorId: vendor.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? 'Failed to select vendor');
      setSelections((current) => [...current.filter((item) => normalize(item.serviceKey) !== normalize(serviceKey)), payload.data]);
      setActiveService(null);
      setQuery('');
      setVendors([]);
      await onSelectionChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select vendor');
    } finally {
      setBusyService(null);
    }
  };

  const removeVendor = async (serviceKey: string) => {
    if (!window.confirm(`Remove the selected vendor for ${serviceKey}?`)) return;
    setBusyService(serviceKey);
    setError(null);
    try {
      const response = await fetch(`/api/crm/consultations/${consultationId}/vendor-selections`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceKey }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? 'Failed to remove vendor');
      setSelections((current) => current.filter((item) => normalize(item.serviceKey) !== normalize(serviceKey)));
      await onSelectionChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove vendor');
    } finally {
      setBusyService(null);
    }
  };

  if (isConsultation) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Vendor Selection</h2>
        <p className="mb-3 text-xs text-gray-500">Shortlist vendors for each customer requirement. Selection is not a booking or enquiry.</p>
        {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {loading ? (
          <p className="text-sm text-gray-400">Loading selections…</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-gray-400">No service requirements recorded.</p>
        ) : (
          <div className="space-y-3">
            {services.map((service) => {
              const key = normalize(service);
              const selection = selectionByService.get(key);
              const active = activeService === service;
              const busy = busyService === service;
              return (
                <div key={key} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium capitalize text-gray-900">{service.replaceAll('-', ' ')}</span>
                    {selection ? (
                      <span className="text-right text-sm text-gray-700">
                        {selection.vendor.name}
                        {selection.category && <span className="block text-xs text-gray-400">{selection.category.name}</span>}
                      </span>
                    ) : <span className="text-xs text-gray-400">No vendor selected</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => { setActiveService(active ? null : service); setQuery(''); setVendors([]); }} className="text-xs font-medium text-amber-700 underline disabled:opacity-50">
                      {selection ? 'Change' : 'Select Vendor'}
                    </button>
                    {selection && <button type="button" disabled={busy} onClick={() => removeVendor(service)} className="text-xs font-medium text-red-600 underline disabled:opacity-50">Remove</button>}
                    {busy && <span className="text-xs text-gray-400">Saving…</span>}
                  </div>
                  {active && (
                    <div className="mt-3 space-y-2">
                      <input aria-label={`Search vendors for ${service}`} autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setVendors([]); }} placeholder="Search vendors by name or city…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
                      {searching && <p className="text-xs text-gray-400">Searching…</p>}
                      {vendors.length > 0 && (
                        <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100">
                          {vendors.map((vendor) => (
                            <button key={vendor.id} type="button" disabled={busy} onClick={() => selectVendor(service, vendor)} className="block w-full px-3 py-2 text-left text-sm hover:bg-amber-50 disabled:opacity-50">
                              <span className="font-medium text-gray-900">{vendor.name}</span>
                              <span className="ml-2 text-xs text-gray-500">{vendor.city}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {!searching && query.trim().length >= 2 && vendors.length === 0 && <p className="text-xs text-gray-400">No vendors found.</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Vendor Interest</h2>
      {vendorInterest.length === 0 ? (
        <p className="text-sm text-gray-400">No vendor interest recorded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {vendorInterest.map((v, i) => (
            <li key={v.vendorId || `${v.vendorCategory}-${i}`} className="text-sm flex justify-between">
              <span className="text-gray-900">{v.vendorName || v.vendorCategory}</span>
              <span className="text-gray-500 text-xs capitalize">{v.vendorCategory}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
