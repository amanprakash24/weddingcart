import Image from 'next/image';

// The Vivah OS logo (founder's own design, confirmed 28 Oct 2026): a gold domed mandap over a maroon-and-gold infinity —
// "VIVAH" in maroon, "OS" in gold. Masters (with the tagline) are kept outside the repo; the site uses the mark as an image
// and sets the name in type so it stays sharp at every size. `tone="light"` for dark backgrounds.
const MARK_RATIO = 198 / 256; // width / height of /images/vivah-os/mark.png

export function VivahOsMark({ size = 40, tone = 'dark', title }: { size?: number; tone?: 'dark' | 'light'; title?: string }) {
  return (
    <Image
      src={tone === 'light' ? '/images/vivah-os/mark-on-dark.png' : '/images/vivah-os/mark.png'}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      width={Math.round(size * MARK_RATIO)}
      height={size}
      className="shrink-0"
      priority
    />
  );
}

export default function VivahOsLogo({ size = 40, tone = 'dark', byline = true }: { size?: number; tone?: 'dark' | 'light'; byline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Vivah OS by Shaadi Shopping" role="img">
      <VivahOsMark size={size} tone={tone} />
      <span className="flex flex-col leading-none" aria-hidden>
        <span className="font-cormorant text-[1.65rem] font-bold tracking-[0.04em]">
          <span style={{ color: tone === 'light' ? '#FBF1E1' : '#7A1238' }}>VIVAH</span>{' '}
          <span style={{ color: tone === 'light' ? '#E2BE7E' : '#B8873E' }}>OS</span>
        </span>
        {byline && <span className="mt-1 text-[10px] font-semibold tracking-[0.16em]" style={{ color: tone === 'light' ? '#D9CBB8' : '#6B5A4E' }}>BY SHAADI SHOPPING</span>}
      </span>
    </span>
  );
}
