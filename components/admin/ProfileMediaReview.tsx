'use client';

import { useEffect, useState } from 'react';
import { Check, ImageIcon, Video, X } from 'lucide-react';

// Photos and videos vendors uploaded to their business profiles, waiting for a decision (6 Oct 2026). A vendor may use its own
// media on its own quotations straight away; it appears on the PUBLIC Shaadi Shopping listing only after an admin approves it here.
// Reject = never public (the vendor keeps it for their own documents). Nothing to review → the card is not shown at all.
type Pending = {
  photos: { id: string; url: string; businessName: string; uploadedAt: string }[];
  videos: { businessId: string; url: string; isLink: boolean; businessName: string }[];
};

const approveBtn = 'inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50';
const rejectBtn = 'inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50';

export default function ProfileMediaReview() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/admin/profile-media')
      .then((r) => r.json())
      .then((b) => live && b.success && setPending(b.data))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function decide(path: string, key: string, approve: boolean) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/profile-media/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approve }) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) setPending(b.data);
      else setError(b.error ?? 'That did not save. Please try again.');
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setBusy(null);
  }

  if (!pending || pending.photos.length + pending.videos.length === 0) return null;

  // Photos grouped under the business that uploaded them, in the order they arrived.
  const byBusiness = new Map<string, Pending['photos']>();
  for (const photo of pending.photos) byBusiness.set(photo.businessName, [...(byBusiness.get(photo.businessName) ?? []), photo]);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <h3 className="text-sm font-bold text-gray-900">Vendor photos and videos waiting for approval</h3>
      <p className="mt-0.5 text-xs text-gray-600">
        Approve to show on the vendor&apos;s public listing. Reject to keep it off the listing — the vendor can still use it on their own quotations. Check that
        each one is a real photo of that business.
      </p>

      {[...byBusiness.entries()].map(([businessName, photos]) => (
        <div key={businessName} className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
            <ImageIcon className="h-3.5 w-3.5" aria-hidden /> {businessName} · {photos.length} photo{photos.length > 1 ? 's' : ''}
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a review thumbnail of an address we stored ourselves; no layout to optimise */}
                  <img src={photo.url} alt={`Photo uploaded by ${businessName}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                </a>
                <div className="flex gap-2 p-2">
                  <button type="button" disabled={busy !== null} onClick={() => decide(`photos/${photo.id}`, photo.id, true)} className={approveBtn}>
                    <Check className="h-3 w-3" aria-hidden /> Approve
                  </button>
                  <button type="button" disabled={busy !== null} onClick={() => decide(`photos/${photo.id}`, photo.id, false)} className={rejectBtn}>
                    <X className="h-3 w-3" aria-hidden /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {pending.videos.map((video) => (
        <div key={video.businessId} className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
            <Video className="h-3.5 w-3.5" aria-hidden /> {video.businessName} · video
          </p>
          {video.isLink ? (
            <a href={video.url} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-xs font-medium text-indigo-600 underline">
              {video.url}
            </a>
          ) : (
            <video src={video.url} controls preload="metadata" className="mt-2 max-h-64 w-full rounded-lg bg-black" />
          )}
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy !== null} onClick={() => decide(`videos/${video.businessId}`, video.businessId, true)} className={approveBtn}>
              <Check className="h-3 w-3" aria-hidden /> Approve
            </button>
            <button type="button" disabled={busy !== null} onClick={() => decide(`videos/${video.businessId}`, video.businessId, false)} className={rejectBtn}>
              <X className="h-3 w-3" aria-hidden /> Reject
            </button>
          </div>
        </div>
      ))}

      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
