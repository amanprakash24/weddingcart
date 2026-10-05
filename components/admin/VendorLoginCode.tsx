'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';

// The vendor's 6-digit login code, on an approved registration (6 Oct 2026). The vendor signs in at /vendor/login with the mobile
// number given at registration + this code. It is shown ONCE — when the registration is approved (`firstCode`) or when an admin
// asks for a new one here — because only its hash is stored. A new code ends the old one and signs the vendor out everywhere.
export default function VendorLoginCode({ vendorId, mobile, firstCode }: { vendorId: string; mobile: string; firstCode?: string }) {
  const [code, setCode] = useState<string | null>(firstCode ?? null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/login-code`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        setCode(body.loginCode);
        setAsking(false);
        setCopied(false);
      } else {
        setError(res.status === 404 ? 'This vendor has no login yet — there is no mobile number linked to it.' : (body.error ?? 'Could not make a new code. Please try again.'));
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setBusy(false);
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setError('Could not copy — please select the code and copy it yourself.');
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-gray-700">
      {code ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 font-semibold text-gray-900">
            <KeyRound className="h-3.5 w-3.5" aria-hidden /> Login code for this vendor
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="select-all rounded-lg bg-white px-3 py-1.5 font-mono text-lg font-bold tracking-[0.3em] text-gray-900 ring-1 ring-amber-200">{code}</span>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:border-gray-400">
              {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />} {copied ? 'Copied' : 'Copy code'}
            </button>
          </div>
          <p>
            The vendor signs in at <span className="font-medium">/vendor/login</span> with mobile <span className="font-medium">{mobile}</span> and this code.
          </p>
          <p className="font-medium text-amber-800">Shown only now. Put it in the terms paper before you leave this page — it cannot be shown again, only replaced.</p>
        </div>
      ) : asking ? (
        <div className="space-y-2">
          <p>Make a new login code? The vendor&apos;s current code stops working and they are signed out on every device.</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={issue} className="rounded-full bg-gray-900 px-3 py-1.5 font-medium text-white disabled:opacity-50">
              {busy ? 'Making…' : 'Make a new code'}
            </button>
            <button type="button" disabled={busy} onClick={() => setAsking(false)} className="rounded-full border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="inline-flex items-center gap-1.5 font-medium text-gray-700 hover:text-gray-900">
          <KeyRound className="h-3.5 w-3.5" aria-hidden /> New login code (lost code, or a vendor who never had one)
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    </div>
  );
}
