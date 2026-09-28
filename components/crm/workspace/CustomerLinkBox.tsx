'use client';

import { useState } from 'react';
import { buildQuotationMessage, formatQuoteDate } from '@/lib/quotation/message';
import { errorMessage } from './useQuotations';
import type { WorkspaceQuotation } from './types';

// The proposal link for the current quotation (docs/wedding-os/08-quotation.md §15). Only a hash is stored, so the link
// is shown exactly once, right after it is created — to share it again, create a new one (the old one stops working).
// Nothing is sent from here: staff copy the link into their own WhatsApp message.

export default function CustomerLinkBox({ quotation, customerName, eventDate, onChanged }: { quotation: WorkspaceQuotation; customerName: string; eventDate: string | null; onChanged: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);

  const open = quotation.status === 'SENT' && quotation.validUntil !== null && new Date(quotation.validUntil).getTime() > new Date().getTime();
  if (!open && !quotation.hasCustomerLink && !quotation.customerViewedAt) return null;

  const call = async (method: 'POST' | 'DELETE') => {
    if (busy) return;
    if (method === 'POST' && quotation.hasCustomerLink && !window.confirm('Create a new link? The link you shared earlier will stop working.')) return;
    if (method === 'DELETE' && !window.confirm('Turn off the link? The couple will no longer be able to open it.')) return;
    setBusy(true);
    setError(null);
    setCopied(null);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/customer-link`, { method });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(errorMessage(payload));
      setUrl(method === 'POST' ? payload.data.url : null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (what: 'link' | 'message') => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(what === 'link' ? url : buildQuotationMessage(quotation, customerName, { eventDate, proposalUrl: url }));
      setCopied(what);
    } catch {
      setCopied(null);
    }
  };

  const buttonClass = 'min-h-[40px] rounded-xl border border-gray-200 px-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40';

  return (
    <div className="grid gap-2 rounded-xl border border-gray-200 px-3.5 py-3 text-sm" aria-label="Proposal link">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="font-bold text-gray-900">Proposal link</b>
        <span className="text-xs text-gray-500">
          {quotation.customerViewedAt
            ? `Opened by the couple on ${formatQuoteDate(quotation.customerViewedAt)}`
            : quotation.hasCustomerLink
              ? 'Link active · not opened yet'
              : 'No link yet'}
        </span>
      </div>

      {url && (
        <div className="grid gap-1.5">
          <div className="flex gap-2">
            <input readOnly value={url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 font-mono text-xs text-gray-800" aria-label="Proposal link URL" />
            <button type="button" onClick={() => copy('link')} className={buttonClass}>{copied === 'link' ? 'Copied' : 'Copy'}</button>
          </div>
          <button type="button" onClick={() => copy('message')} className={`${buttonClass} justify-self-start`}>
            {copied === 'message' ? 'Message copied' : 'Copy WhatsApp message with link'}
          </button>
          <span className="text-xs text-amber-800">Copy it now and paste it into your WhatsApp message — for safety it is shown only once.</span>
        </div>
      )}

      {open && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => call('POST')} className={buttonClass}>
            {quotation.hasCustomerLink ? 'Create a new link' : 'Create proposal link'}
          </button>
          {quotation.hasCustomerLink && (
            <button type="button" disabled={busy} onClick={() => call('DELETE')} className="min-h-[40px] rounded-xl px-3 text-sm font-medium text-red-700 underline underline-offset-4 disabled:opacity-40">
              Turn off link
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
