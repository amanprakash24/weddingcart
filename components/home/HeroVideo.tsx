'use client';

import { useEffect, useRef } from 'react';

const VIDEO = '/videos/homepage-hd.mp4';

// The founder's homepage video (public/videos/homepage.mp4), played silently in the hero arch. The page uses
// homepage-hd.mp4 (19 Nov 2026): the middle 600x720 of the original at full resolution, lightly sharpened, 5.9 MB.
// The arch only ever shows the middle of the video, so nothing visible is lost, and it is much sharper than the old
// 720x406 copy (homepage-web.mp4, kept for now). The original file stays as it is.
// The poster shows at once, so the first screen never waits for the video. The video file is only fetched after the
// page has loaded, and not at all for people who ask their device for reduced motion or to save data.
export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reduce || saveData) return;
    video.src = VIDEO;
    video.play().catch(() => {});
  }, []);

  return (
    <video
      ref={ref}
      className="h-full w-full object-cover"
      poster="/images/homepage-poster-hd.jpg"
      muted
      loop
      playsInline
      preload="none"
      aria-label="Wedding entrances and stages decorated with arches and flowers"
    />
  );
}
