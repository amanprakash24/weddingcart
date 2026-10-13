'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, KeyRound, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import { PROFILE_CHANGED, PROFILE_LIMITS, type MyProfile as Profile, type ProfileErrors } from '@/lib/admin/myProfile';
import { TEAM_ROLE_LABELS } from '@/lib/admin/ourTeam';

// "My profile" (13 Oct 2026): your photo, your name and your designation — what the rest of the Command Center shows for you.
// Everything is about the signed-in person and saved through /api/admin/profile; the photo is uploaded through /api/upload first.

const field = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100';
const label = 'mb-1.5 block text-xs font-semibold text-gray-600';
const card = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm';
const dark = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-gray-900 px-5 text-sm font-semibold text-white disabled:opacity-50';
const light = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700 disabled:opacity-50';
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];


export default function MyProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<'details' | 'photo' | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/admin/profile')
      .then((r) => r.json())
      .then((b) => {
        if (!live) return;
        if (!b.success) return setLoadError(b.error ?? 'Could not load your profile.');
        setProfile(b.data);
        setName(b.data.name ?? '');
        setDesignation(b.data.designation ?? '');
      })
      .catch(() => live && setLoadError('Could not reach the server. Please try again.'));
    return () => {
      live = false;
    };
  }, []);

  async function save(body: Record<string, unknown>, what: 'details' | 'photo') {
    setBusy(what);
    setError(null);
    setErrors({});
    setSaved(false);
    try {
      const res = await fetch('/api/admin/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.success) {
        setProfile(b.data);
        setSaved(true);
        window.dispatchEvent(new Event(PROFILE_CHANGED));
      } else {
        setErrors(b.fieldErrors ?? {});
        if (!b.fieldErrors || b.fieldErrors.photoUrl) setError(b.fieldErrors?.photoUrl ?? b.error ?? 'That did not save. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    }
    setBusy(null);
  }

  async function pick(file: File | undefined) {
    if (!file || busy) return;
    setError(null);
    setSaved(false);
    if (!PHOTO_TYPES.includes(file.type)) return setError('Please choose a JPG, PNG or WebP photo.');
    if (file.size > PROFILE_LIMITS.photoMaxBytes) return setError('That photo is over 10 MB. Please choose a smaller one.');
    setBusy('photo');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const b = await res.json().catch(() => ({}));
      if (!res.ok || !b.success || !b.url) {
        setError(b.error ?? 'The photo did not upload. Please try again.');
        setBusy(null);
        return;
      }
      await save({ photoUrl: b.url }, 'photo');
    } catch {
      setError('Could not reach the server. Please try again.');
      setBusy(null);
    }
  }

  if (loadError) return <p role="alert" className="text-sm text-red-600">{loadError}</p>;
  if (!profile) return <p className="text-sm text-gray-500">Loading…</p>;

  const changed = name.trim() !== (profile.name ?? '') || designation.trim() !== (profile.designation ?? '');
  const signIn = [profile.hasCode && 'mobile number + 6-digit code', profile.hasPassword && 'email + password'].filter(Boolean).join(', or ') || 'nothing yet';
  const since = new Date(profile.since).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <div className="max-w-2xl space-y-5">
      <section className={card} aria-labelledby="photo-heading">
        <h2 id="photo-heading" className="sr-only">Your photo</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={profile.name} photoUrl={profile.photoUrl} size={96} />
          <div className="min-w-0 flex-1 basis-48">
            <p className="break-words text-lg font-bold text-gray-900">{profile.name ?? 'No name yet'}</p>
            <p className="text-sm text-gray-600">{[profile.designation, TEAM_ROLE_LABELS[profile.role]].filter(Boolean).join(' · ')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input ref={picker} type="file" accept={PHOTO_TYPES.join(',')} className="sr-only" id="profile-photo" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
              <label htmlFor="profile-photo" className={`${light} ${busy ? 'pointer-events-none opacity-50' : ''}`}><Camera className="h-3.5 w-3.5" aria-hidden /> {busy === 'photo' ? 'Uploading…' : profile.photoUrl ? 'Change photo' : 'Add your photo'}</label>
              {profile.photoUrl && (
                <button type="button" disabled={busy !== null} onClick={() => void save({ photoUrl: null }, 'photo')} className={light}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove photo</button>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">JPG, PNG or WebP, up to 10 MB. A clear photo of your face works best.</p>
          </div>
        </div>
      </section>

      <section className={card} aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-sm font-bold text-gray-900">Your details</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void save({ name, designation }, 'details');
          }}
        >
          <div>
            <label htmlFor="profile-name" className={label}>Your name</label>
            <input id="profile-name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} maxLength={PROFILE_LIMITS.nameMax} autoComplete="name" className={field} aria-invalid={Boolean(errors.name)} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="profile-designation" className={label}>Designation (optional)</label>
            <input id="profile-designation" value={designation} onChange={(e) => { setDesignation(e.target.value); setSaved(false); }} maxLength={PROFILE_LIMITS.designationMax} placeholder="e.g. Founder & CEO" autoComplete="organization-title" className={field} aria-invalid={Boolean(errors.designation)} />
            {errors.designation && <p className="mt-1 text-xs text-red-600">{errors.designation}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy !== null || !changed || name.trim().length < 2} className={dark}>{busy === 'details' ? 'Saving…' : 'Save'}</button>
            {saved && !changed && <p role="status" className="text-sm font-medium text-emerald-700">Saved.</p>}
          </div>
        </form>
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      <section className={card} aria-labelledby="signin-heading">
        <h2 id="signin-heading" className="text-sm font-bold text-gray-900">Your sign-in</h2>
        <dl className="mt-3 space-y-2 text-sm text-gray-700">
          <div className="flex gap-2"><dt className="w-32 shrink-0 text-gray-500">Role</dt><dd className="font-medium">{TEAM_ROLE_LABELS[profile.role]}</dd></div>
          <div className="flex gap-2"><dt className="w-32 shrink-0 text-gray-500">Mobile number</dt><dd className="font-medium">{profile.mobile ?? 'Not registered yet'}</dd></div>
          {profile.email && <div className="flex gap-2"><dt className="w-32 shrink-0 text-gray-500">Email</dt><dd className="break-all font-medium">{profile.email}</dd></div>}
          <div className="flex gap-2"><dt className="w-32 shrink-0 text-gray-500">Signs in with</dt><dd className="font-medium">{signIn}</dd></div>
          <div className="flex gap-2"><dt className="w-32 shrink-0 text-gray-500">On the team since</dt><dd className="font-medium">{since}</dd></div>
        </dl>
        <Link href="/admin/account" className={`${light} mt-4`}><KeyRound className="h-3.5 w-3.5" aria-hidden /> Change your mobile number or code</Link>
      </section>
    </div>
  );
}
