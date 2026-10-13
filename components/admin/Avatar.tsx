import { initials } from '@/lib/admin/myProfile';

// A team member's face: their photo, or their initials where there is none. Photos are our own uploads (Cloudinary), asked for
// at the size they are shown.
export default function Avatar({ name, photoUrl, size, className = '' }: { name: string | null; photoUrl: string | null; size: number; className?: string }) {
  const box = { width: size, height: size };
  if (photoUrl) {
    const sized = photoUrl.replace('/image/upload/', `/image/upload/c_fill,g_face,w_${size * 2},h_${size * 2},q_auto,f_auto/`);
    // eslint-disable-next-line @next/next/no-img-element -- already sized and formatted by Cloudinary
    return <img src={sized} alt={name ?? 'Profile photo'} width={size} height={size} style={box} className={`flex-shrink-0 rounded-full object-cover ${className}`} />;
  }
  return (
    <span aria-hidden style={{ ...box, fontSize: Math.round(size * 0.38) }} className={`flex flex-shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-800 ${className}`}>
      {initials(name)}
    </span>
  );
}
