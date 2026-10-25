'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Vendor } from '@/types';
import { Star, ChevronDown, Sparkles } from 'lucide-react';
import {
  PlanFormData, SERVICE_ICONS, SERVICE_LABELS, EST_RANGES,
  buildChecklist, cateringEstimate, venueTag, emptyVenueMessage,
} from '@/lib/planPreview';

interface Props {
  form: PlanFormData;
  step: number;
}

// Live preview of the real plan the user will get, shown inline in the /plan
// wizard before submission — real venues/estimates, never fabricated content.
// Single instance, repositioned via CSS grid by the parent (PlanPageClient):
// normal block flow on mobile, sticky sidebar at lg:+. The `lg:block`
// override below keeps content always-expanded on desktop regardless of the
// `collapsed` state, which only governs the mobile collapsible header.
export default function LivePlanPreview({ form, step }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [venues, setVenues] = useState<Vendor[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);

  const hasStarted = Boolean(form.weddingDate);

  // Deferred via setTimeout (matching LeadWorkspaceClient.tsx's `load`
  // pattern) so the fetch-triggering setState isn't called synchronously
  // within the effect body itself (react-hooks/set-state-in-effect). The
  // `cancelled` guard additionally protects against a stale response landing
  // after the user has already changed city again — WeddingDashboardClient's
  // one-shot post-submit venue fetch doesn't need this since city can't
  // change there, but here it can change repeatedly pre-submission.
  useEffect(() => {
    if (!hasStarted) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      setVenuesLoading(true);
      fetch(`/api/vendors?category=venue&city=${encodeURIComponent(form.city)}&limit=2&sort=rating`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled && d.success) setVenues(d.data); })
        .finally(() => { if (!cancelled) setVenuesLoading(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [form.city, hasStarted]);

  const { catering, min: minCatering, max: maxCatering } = cateringEstimate(form.guestCount, form.foodPreference, form.days);
  const selectedServices = form.services.filter((s) => SERVICE_LABELS[s]);
  const checklistTeaser = buildChecklist(form.weddingDate, form.services).slice(0, 2);
  const empty = emptyVenueMessage(form.city);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="lg:hidden w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" /> See your live preview
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      <div className={`${collapsed ? 'hidden lg:block' : 'block'} px-5 pb-5 lg:pt-5 space-y-5`}>
        <p className="hidden lg:flex items-center gap-2 font-semibold text-gray-900 text-sm">
          <Sparkles className="w-4 h-4 text-amber-500" /> Your Live Preview
        </p>

        {!hasStarted ? (
          <p className="text-gray-400 text-sm leading-relaxed">
            Fill in your date and city to see a live preview of your plan.
          </p>
        ) : (
          <>
            {/* Venues */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Top venues in {form.city}</p>
              {venuesLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
                </div>
              ) : venues.length > 0 ? (
                <div className="space-y-2">
                  {venues.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 border border-gray-100 rounded-xl p-2">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-amber-100 to-rose-100">
                        {v.image && <Image src={v.image} alt={v.name} fill className="object-cover" sizes="48px" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 truncate">{v.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full">{venueTag(v)}</span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> {v.rating}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-amber-800 font-medium text-xs">{empty.title}</p>
                  <p className="text-gray-500 text-[11px] mt-0.5">{empty.body}</p>
                </div>
              )}
            </div>

            {/* Catering estimate */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Catering estimate</p>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-sm font-bold text-green-700">
                  ₹{(minCatering / 100000).toFixed(1)}–{(maxCatering / 100000).toFixed(1)} L
                </p>
                <p className="text-[11px] text-gray-500">{catering.icon} {catering.label} · {form.guestCount} guests</p>
              </div>
            </div>

            {/* Selected services */}
            {selectedServices.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your services</p>
                <div className="space-y-1.5">
                  {selectedServices.map((svc) => (
                    <div key={svc} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 flex items-center gap-1.5">
                        <span>{SERVICE_ICONS[svc] || '✨'}</span> {SERVICE_LABELS[svc]}
                      </span>
                      <span className="text-rose-600 font-medium">{EST_RANGES[svc]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist teaser */}
            {checklistTeaser.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your checklist</p>
                <div className="space-y-1.5">
                  {checklistTeaser.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" /> {item.label}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Full checklist unlocks after you submit.</p>
              </div>
            )}

            {step >= 4 && (
              <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
                This is a live preview from your answers — your expert will refine it after your call.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
