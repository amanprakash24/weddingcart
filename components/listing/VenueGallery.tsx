'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import s from './venue.module.css';

// The venue's photos as a curved strip (the middle faces you, the ends turn in, like a curved screen), plus every photo
// in a full-screen view and the tour video when the venue has one.
const ANGLES = [-26, -13, 0, 13, 26];

export default function VenueGallery({ name, photos, video }: { name: string; photos: string[]; video: string | null }) {
  const [open, setOpen] = useState<'photos' | 'video' | null>(null);
  const strip = photos.slice(0, 5);
  const angles = strip.length === 5 ? ANGLES : strip.map((_, i) => (i - (strip.length - 1) / 2) * 13);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('keydown', close);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (photos.length === 0 && !video) return null;

  return (
    <section aria-labelledby="venue-photos" className={s.galleryBand}>
      <div className={s.wrap} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p className={s.kicker}>Gallery</p>
          <h2 id="venue-photos" className={s.h2}>See it before you visit</h2>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {video && <button type="button" className={s.linkBtn} onClick={() => setOpen('video')}>Watch the tour</button>}
          {photos.length > 0 && <button type="button" className={s.linkBtn} onClick={() => setOpen('photos')}>All {photos.length} photos</button>}
        </div>
      </div>
      {strip.length > 0 && (
        <div className={s.curve}>
          {strip.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setOpen('photos')}
              aria-label={`${name}, photo ${i + 1} of ${photos.length}. Open all photos`}
              style={{ transform: `rotateY(${angles[i]}deg) translateZ(${Math.abs(angles[i]) * 2.4}px)` }}
            >
              <Image src={src} alt="" fill sizes="(max-width: 760px) 180px, 220px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className={s.lightbox} role="dialog" aria-modal="true" aria-label={open === 'video' ? `${name} tour video` : `All photos of ${name}`}>
          <button type="button" className={s.closeBtn} onClick={() => setOpen(null)} autoFocus>Close</button>
          {open === 'video' && video ? (
            <video src={video} controls autoPlay playsInline style={{ display: 'block', width: '100%', maxWidth: 1000, margin: '0 auto', borderRadius: 16 }} />
          ) : (
            <div className={s.lightboxGrid}>
              {photos.map((src, i) => (
                <div key={src}>
                  <Image src={src} alt={`${name}, photo ${i + 1}`} fill sizes="(max-width: 760px) 100vw, 360px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
