'use client';

import { useEffect, useRef } from 'react';

const VIDEO = '/videos/homepage-web.mp4';

// The founder's homepage video (public/videos/homepage.mp4), played silently in the hero arch. The page uses a lighter
// copy (homepage-web.mp4, 720px, 2.9 MB instead of 9.2 MB); the original file stays as it is.
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
      poster="/images/homepage-poster.jpg"
      muted
      loop
      playsInline
      preload="none"
      aria-label="Wedding entrances and stages decorated with arches and flowers"
    />
  );
}
