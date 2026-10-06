'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, ImagePlus, Loader2, Trash2, Upload, Video } from 'lucide-react';
import { PROFILE_LIMITS, PROFILE_STEP_WORDS, type ProfileErrors } from '@/lib/venue/profile';
import type { ProfileView } from '@/services/venueProfile.service';

// "Your business profile" (6 Oct 2026) — the first thing a vendor completes after signing in: name, logo, photos, and optionally
// a video and a GST number. It is the letterhead of every quotation and invoice the business sends. Photos and video are usable
// at once on the business's own documents; they show on the public Shaadi Shopping listing only after Shaadi Shopping approves
// them. Until the name, the logo and three photos are in, the rest of Vendor OS stays behind this page (VendorShell).

const STATUS_WORDS = { PENDING: 'Waiting for approval', APPROVED: 'On your public listing', REJECTED: 'Not on your public listing' } as const;
const STATUS_TONE = { PENDING: 'bg-amber-50 text-amber-800 ring-amber-200', APPROVED: 'bg-emerald-50 text-emerald-800 ring-emerald-200', REJECTED: 'bg-stone-100 text-stone-600 ring-stone-200' } as const;

const card = 'rounded-[24px] border border-[#E8DCC8] bg-white p-6 shadow-[0_10px_30px_rgba(42,31,27,0.04)] sm:p-8';
const eyebrow = 'flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#B08D55]';
const field = 'w-full rounded-xl border border-[#E8DCC8] bg-[#FFFCF7] px-4 py-3.5 text-base text-[#2A1F1B] outline-none transition placeholder:text-[#B5A898] focus:border-[#C5A46D] focus:bg-white focus:ring-2 focus:ring-[#C5A46D]/25';
const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#8B1A4A]';
const primary = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#8B1A4A] px-6 text-sm font-semibold text-white transition disabled:opacity-40';
const secondary = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[#8B1A4A]/40 px-6 text-sm font-semibold text-[#8B1A4A] transition hover:bg-[#8B1A4A]/5 disabled:opacity-40';

// A phone photo is often 5–10 MB; the server takes 4 MB and keeps a 1600px copy anyway. So a large photo is scaled down here
// first — the vendor never has to resize anything by hand, and less is sent over a mobile connection.
async function fitForUpload(file: File, maxEdge: number): Promise<File> {
  if (file.size <= 3 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file; // the server will say so if it is still too large
  }
}

const videoLength = (file: File) =>
  new Promise<number | null>((resolve) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(el.src);
      resolve(Number.isFinite(el.duration) ? el.duration : null);
    };
    el.onerror = () => resolve(null);
    el.src = URL.createObjectURL(file);
  });

type Busy = 'save' | 'logo' | 'photo' | 'video' | string | null; // a photo id while it is being removed

export default function ProfileScreen() {
  const [p, setP] = useState<ProfileView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', gstin: '' });
  const [link, setLink] = useState('');
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<{ where: 'details' | 'logo' | 'photos' | 'video'; text: string; bad: boolean } | null>(null);
  const [saved, setSaved] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/vendor-os/profile')
      .then((r) => r.json())
      .then((b) => {
        if (!live) return;
        if (b.success) {
          setP(b.data);
          setForm({ name: b.data.name ?? '', gstin: b.data.gstin ?? '' });
        } else setLoadError(b.error ?? 'Your profile could not be loaded. Please try again.');
      })
      .catch(() => live && setLoadError('Could not reach Vivah OS — please check your connection.'));
    return () => {
      live = false;
    };
  }, []);

  // One request → the fresh profile, or the sentence to show beside the thing that was being done.
  async function send(where: NonNullable<typeof notice>['where'], input: RequestInfo, init: RequestInit): Promise<boolean> {
    setNotice(null);
    try {
      const res = await fetch(input, init);
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        setP(b.data);
        setErrors({});
        return true;
      }
      setErrors(b.fieldErrors ?? {});
      if (!b.fieldErrors) setNotice({ where, text: b.error ?? 'Something went wrong. Please try again.', bad: true });
    } catch {
      setNotice({ where, text: 'Could not reach Vivah OS — please check your connection and try again.', bad: true });
    }
    return false;
  }

  async function saveDetails() {
    if (busy) return;
    setBusy('save');
    setSaved(false);
    if (await send('details', '/api/vendor-os/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })) setSaved(true);
    setBusy(null);
  }

  async function uploadImage(kind: 'logo' | 'photo', file: File | undefined) {
    if (!file || busy) return;
    setBusy(kind);
    const body = new FormData();
    body.append('file', await fitForUpload(file, kind === 'logo' ? PROFILE_LIMITS.logoMaxEdge * 2 : PROFILE_LIMITS.imageMaxEdge));
    await send(kind === 'logo' ? 'logo' : 'photos', kind === 'logo' ? '/api/vendor-os/profile/logo' : '/api/vendor-os/profile/photos', { method: 'POST', body });
    setBusy(null);
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || !p) return;
    const room = p.limits.photosMax - p.photos.length;
    const chosen = [...files].slice(0, Math.max(room, 0));
    for (const f of chosen) await uploadImage('photo', f);
    if (files.length > chosen.length) setNotice({ where: 'photos', text: `You can keep up to ${p.limits.photosMax} photos — the extra ${files.length - chosen.length} were not added.`, bad: true });
  }

  async function removePhoto(id: string) {
    if (busy) return;
    setBusy(id);
    await send('photos', `/api/vendor-os/profile/photos/${id}`, { method: 'DELETE' });
    setBusy(null);
  }

  async function uploadVideo(file: File | undefined) {
    if (!file || busy) return;
    const tooBig = file.size > PROFILE_LIMITS.videoBytes;
    const seconds = await videoLength(file);
    if (tooBig || (seconds !== null && seconds > PROFILE_LIMITS.videoSeconds + 1)) {
      setNotice({ where: 'video', text: `Please choose a video of up to ${PROFILE_LIMITS.videoSeconds} seconds and ${PROFILE_LIMITS.videoBytes / (1024 * 1024)} MB — or paste a YouTube or Instagram link instead.`, bad: true });
      return;
    }
    setBusy('video');
    setNotice(null);
    try {
      const sig = await (await fetch('/api/vendor-os/profile/video-signature', { method: 'POST' })).json();
      if (!sig.success) throw new Error(sig.error ?? 'Could not start the upload');
      const body = new FormData();
      body.append('file', file);
      body.append('api_key', sig.apiKey);
      body.append('timestamp', String(sig.timestamp));
      body.append('signature', sig.signature);
      body.append('folder', sig.folder);
      body.append('tags', sig.tags);
      const stored = await (await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`, { method: 'POST', body })).json();
      if (!stored.secure_url) throw new Error('The video did not upload. Please try again.');
      await send('video', '/api/vendor-os/profile/video', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: stored.secure_url }) });
    } catch (err) {
      setNotice({ where: 'video', text: err instanceof Error ? err.message : 'The video did not upload. Please try again.', bad: true });
    }
    setBusy(null);
  }

  async function saveLink() {
    if (busy || !link.trim()) return;
    setBusy('video');
    if (await send('video', '/api/vendor-os/profile/video', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link }) })) setLink('');
    setBusy(null);
  }

  async function removeVideo() {
    if (busy) return;
    setBusy('video');
    await send('video', '/api/vendor-os/profile/video', { method: 'DELETE' });
    setBusy(null);
  }

  if (!p) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-playfair text-3xl text-[#2A1F1B]">Your business profile</h1>
        {loadError ? (
          <p role="alert" className="mt-4 text-sm text-rose-700">{loadError}</p>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-[#6B5B4D]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…</p>
        )}
      </div>
    );
  }

  const complete = p.missing.length === 0;
  const steps = [
    { done: !p.missing.includes('name'), words: 'Business name' },
    { done: !p.missing.includes('logo'), words: 'Logo' },
    { done: !p.missing.includes('photos'), words: `${p.limits.photosMin} photos` },
  ];
  const say = (where: NonNullable<typeof notice>['where']) =>
    notice?.where === where && (
      <p role={notice.bad ? 'alert' : 'status'} className={`text-sm ${notice.bad ? 'text-rose-700' : 'text-emerald-700'}`}>{notice.text}</p>
    );

  return (
    <div className="min-h-screen bg-[#FFFAF5]">
      {/* Header */}
      <div className="bg-[#1E0510] px-5 pb-10 pt-9 sm:pb-12 sm:pt-12">
        <div className="mx-auto max-w-3xl">
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#E8C98A]"><span className="h-px w-8 bg-[#E8C98A]/70" /> {complete ? 'Your business' : 'Welcome to Vivah OS'}</p>
          <h1 className="mt-3 font-playfair text-3xl leading-tight text-[#FFF7EA] sm:text-4xl">{complete ? 'Your business profile' : 'First, set up your business profile'}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#E9D9C3]/80">
            {complete
              ? 'This is what your customers see at the top of every quotation and invoice you send.'
              : `Your name, logo and photos appear on every quotation and invoice you send. Add ${p.missing.map((m) => PROFILE_STEP_WORDS[m]).join(', ').replace(/, ([^,]*)$/, ' and $1')} to start using Vivah OS.`}
          </p>
          <ol className="mt-6 flex flex-wrap gap-2">
            {steps.map((s) => (
              <li key={s.words} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${s.done ? 'bg-[#E8C98A] text-[#2A0614]' : 'border border-[#E8C98A]/40 text-[#F3D9A4]'}`}>
                {s.done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-[#E8C98A]/70" aria-hidden />} {s.words}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <main className="mx-auto -mt-5 max-w-3xl space-y-6 px-5 pb-16">
        {!p.canEdit && <p className={`${card} text-sm text-[#6B5B4D]`}>Only the owner of this business can change its profile.</p>}

        {/* Name + GST number */}
        <section className={`${card} space-y-5`}>
          <p className={eyebrow}><span className="h-px w-8 bg-[#C5A46D]" /> Business details</p>
          <div>
            <label htmlFor="profile-name" className={label}>Business name</label>
            <input id="profile-name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((cur) => ({ ...cur, name: undefined })); }} maxLength={PROFILE_LIMITS.nameMax} disabled={!p.canEdit} placeholder="As your customers know it" className={field} aria-invalid={Boolean(errors.name)} />
            {errors.name && <p className="mt-1.5 text-xs text-rose-700">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="profile-gstin" className={label}>GST number <span className="font-normal normal-case tracking-normal text-[#6B5B4D]">(if you have one)</span></label>
            <input id="profile-gstin" value={form.gstin} onChange={(e) => { setForm({ ...form, gstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15) }); setErrors((cur) => ({ ...cur, gstin: undefined })); }} disabled={!p.canEdit} placeholder="15 characters, e.g. 10ABCDE1234F1Z5" className={`${field} tracking-[0.12em] placeholder:tracking-normal`} aria-invalid={Boolean(errors.gstin)} />
            <p className={`mt-1.5 text-xs ${errors.gstin ? 'text-rose-700' : 'text-[#6B5B4D]'}`}>{errors.gstin ?? 'Leave it empty if you are not registered for GST. You can add it later.'}</p>
          </div>
          {say('details')}
          {saved && <p role="status" className="text-sm text-emerald-700">Saved.</p>}
          {p.canEdit && (
            <button type="button" onClick={saveDetails} disabled={busy !== null || (form.name.trim() === p.name && form.gstin === (p.gstin ?? ''))} className={primary}>
              {busy === 'save' ? 'Saving…' : 'Save details'}
            </button>
          )}
        </section>

        {/* Logo */}
        <section className={`${card} space-y-5`}>
          <p className={eyebrow}><span className="h-px w-8 bg-[#C5A46D]" /> Logo</p>
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E8DCC8] bg-[#FFFCF7]">
              {p.logoUrl ? <Image src={p.logoUrl} alt={`${p.name} logo`} width={224} height={224} className="h-full w-full object-contain p-2" /> : <ImagePlus className="h-7 w-7 text-[#C5A46D]" aria-hidden />}
            </div>
            <div className="min-w-[200px] flex-1 space-y-3">
              <p className="text-sm leading-relaxed text-[#4A3F38]">Shown at the top of your quotations and invoices. A square image works best. JPEG, PNG or WebP.</p>
              {p.canEdit && (
                <>
                  <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void uploadImage('logo', e.target.files?.[0]); e.target.value = ''; }} />
                  <button type="button" onClick={() => logoInput.current?.click()} disabled={busy !== null} className={p.logoUrl ? secondary : primary}>
                    {busy === 'logo' ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Uploading…</> : <><Upload className="h-4 w-4" aria-hidden /> {p.logoUrl ? 'Change logo' : 'Upload logo'}</>}
                  </button>
                </>
              )}
              {say('logo')}
            </div>
          </div>
        </section>

        {/* Photos */}
        <section className={`${card} space-y-5`}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className={eyebrow}><span className="h-px w-8 bg-[#C5A46D]" /> Photos</p>
            <p className="text-xs text-[#6B5B4D]">{p.photos.length} of {p.limits.photosMax}{p.photos.length < p.limits.photosMin ? ` · at least ${p.limits.photosMin} needed` : ''}</p>
          </div>
          <p className="text-sm leading-relaxed text-[#4A3F38]">
            Your own real photos — your hall, lawn, stage, decoration, food. You can use them in your quotations straight away. They appear on your public Shaadi Shopping page after we approve them.
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {p.photos.map((photo) => (
              <li key={photo.id} className="group relative overflow-hidden rounded-2xl border border-[#E8DCC8] bg-[#FFFCF7]">
                <div className="relative aspect-[4/3]">
                  <Image src={photo.url} alt="" fill sizes="(min-width: 640px) 220px, 45vw" className="object-cover" />
                </div>
                <div className="flex items-center justify-between gap-1 px-2.5 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_TONE[photo.status]}`}>{STATUS_WORDS[photo.status]}</span>
                  {p.canEdit && (
                    <button type="button" onClick={() => removePhoto(photo.id)} disabled={busy !== null} aria-label="Remove this photo" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#8B6F5A] hover:bg-[#F0E6D6] disabled:opacity-40">
                      {busy === photo.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                    </button>
                  )}
                </div>
              </li>
            ))}
            {p.canEdit && p.photos.length < p.limits.photosMax && (
              <li>
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { void uploadPhotos(e.target.files); e.target.value = ''; }} />
                <button type="button" onClick={() => photoInput.current?.click()} disabled={busy !== null} className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#C5A46D]/60 bg-[#FFFCF7] text-sm font-semibold text-[#8B1A4A] transition hover:bg-[#FBF3E4] disabled:opacity-50">
                  {busy === 'photo' ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Uploading…</> : <><ImagePlus className="h-6 w-6" aria-hidden /> Add photos</>}
                </button>
              </li>
            )}
          </ul>
          {say('photos')}
        </section>

        {/* Video */}
        <section className={`${card} space-y-5`}>
          <p className={eyebrow}><span className="h-px w-8 bg-[#C5A46D]" /> Video <span className="font-normal normal-case tracking-normal text-[#6B5B4D]">(optional)</span></p>
          {p.video ? (
            <div className="space-y-3">
              {p.video.isLink ? (
                <a href={p.video.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 break-all text-sm font-medium text-[#8B1A4A] underline underline-offset-2"><Video className="h-4 w-4 shrink-0" aria-hidden /> {p.video.url}</a>
              ) : (
                <video src={p.video.url} controls preload="metadata" className="w-full rounded-2xl border border-[#E8DCC8] bg-black" />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${STATUS_TONE[p.video.status]}`}>{STATUS_WORDS[p.video.status]}</span>
                {p.canEdit && <button type="button" onClick={removeVideo} disabled={busy !== null} className={secondary}>{busy === 'video' ? 'Removing…' : 'Remove video'}</button>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[#4A3F38]">A short walk-through of your venue or your work — up to {PROFILE_LIMITS.videoSeconds} seconds. Or paste a link to a video you already have on YouTube or Instagram.</p>
              {p.canEdit && (
                <>
                  <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => { void uploadVideo(e.target.files?.[0]); e.target.value = ''; }} />
                  <button type="button" onClick={() => videoInput.current?.click()} disabled={busy !== null} className={secondary}>
                    {busy === 'video' ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Uploading… please keep this page open</> : <><Upload className="h-4 w-4" aria-hidden /> Upload a video</>}
                  </button>
                  <div>
                    <label htmlFor="profile-video-link" className={label}>Or a YouTube / Instagram link</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input id="profile-video-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className={field} aria-invalid={Boolean(errors.videoLink)} />
                      <button type="button" onClick={saveLink} disabled={busy !== null || !link.trim()} className={`${secondary} shrink-0`}>Save link</button>
                    </div>
                    {errors.videoLink && <p className="mt-1.5 text-xs text-rose-700">{errors.videoLink}</p>}
                  </div>
                </>
              )}
            </div>
          )}
          {say('video')}
        </section>

        {/* Onward */}
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          {complete ? (
            <Link href="/vendor/today" className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-gradient-to-r from-[#8B1A4A] via-[#9E2A55] to-[#C5A46D] px-8 text-base font-semibold text-white shadow-[0_12px_32px_rgba(139,26,74,0.25)] sm:w-auto">
              Go to your dashboard
            </Link>
          ) : (
            <p className="text-sm text-[#6B5B4D]">Still needed: {p.missing.map((m) => PROFILE_STEP_WORDS[m]).join(', ')}.</p>
          )}
        </div>
      </main>
    </div>
  );
}
