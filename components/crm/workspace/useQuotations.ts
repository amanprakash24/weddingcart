'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceQuotation } from './types';

// The quotations of one lead/enquiry/consultation and every call that changes them, shared by the Next-action card,
// the quotation card and the dialogs. It only wraps the existing routes (/api/quotations/…, /api/bookings/:id) — no new
// behaviour; the server still decides what is allowed and replies with its own message when something is refused.

export function errorMessage(payload: { error?: string; issues?: { message?: string }[] }): string {
  const first = payload.issues?.find((i) => i.message)?.message;
  return first ?? payload.error ?? 'Request failed';
}

export function useQuotations({ sourceType, sourceId, onChanged }: { sourceType: string; sourceId: string; onChanged: () => void }) {
  const [quotations, setQuotations] = useState<WorkspaceQuotation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // The last failure message, readable right after an awaited call (state would still hold the old value inside the caller).
  const lastError = useRef<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/quotations?sourceType=${sourceType}&sourceId=${sourceId}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.success) throw new Error(errorMessage(body));
        setQuotations(body.data);
        setLoadError(null);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [sourceType, sourceId]);

  // Deferred like the other workspace panels (react-hooks/set-state-in-effect).
  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  // One helper for every lifecycle call: shows the server's message on failure, reloads on success.
  const act = useCallback(
    async (id: string, path: string, body?: unknown, okNotice?: string) => {
      setBusyId(id);
      setLoadError(null);
      setNotice(null);
      try {
        const res = await fetch(`/api/quotations/${id}${path}`, {
          method: path ? 'POST' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const payload = await res.json();
        if (!res.ok || !payload.success) throw new Error(errorMessage(payload));
        if (okNotice) setNotice(okNotice);
        load();
        onChanged();
        return payload;
      } catch (e) {
        lastError.current = (e as Error).message;
        setLoadError((e as Error).message);
        load(); // the state may have moved under us (e.g. it just expired) — show the truth
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [load, onChanged]
  );

  // A booking is changed through the existing booking route. Confirming it also creates the wedding (idempotent, retry-safe).
  const setBookingStatus = useCallback(
    async (quotationId: string, bookingId: string, status: 'confirmed' | 'closed', okNotice?: string) => {
      setBusyId(quotationId);
      setLoadError(null);
      setNotice(null);
      try {
        const res = await fetch(`/api/bookings/${bookingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const payload = await res.json();
        if (!res.ok || !payload.success) throw new Error(errorMessage(payload));
        if (okNotice) setNotice(okNotice);
        load();
        onChanged();
        return true;
      } catch (e) {
        lastError.current = (e as Error).message;
        setLoadError((e as Error).message);
        load();
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [load, onChanged]
  );

  return { quotations, loadError, setLoadError, notice, setNotice, busyId, lastError, load, act, setBookingStatus };
}

export type QuotationsApi = ReturnType<typeof useQuotations>;
