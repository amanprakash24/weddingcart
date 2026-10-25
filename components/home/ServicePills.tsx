import Image from 'next/image';
import Link from 'next/link';
import { categoryHref } from '@/lib/home/categoryTiles';
import { serif } from './styles';

// Moving row of services under the hero (A+ "photo pills"). Our own photos from /public; a service without a
// fitting photo yet shows a gold initial instead of an unrelated picture.
const PILLS: { name: string; href: string; photo?: string; pos?: string }[] = [
  { name: 'Venues', href: categoryHref('venue'), photo: '/cat-venue-guides.jpg' },
  { name: 'Decor', href: categoryHref('decorator'), photo: '/cat-decor-flowers.jpg' },
  { name: 'Photo & Video', href: categoryHref('photo-video'), photo: '/cat-photography.jpg' },
  { name: 'Catering', href: categoryHref('catering'), photo: '/images/pill-catering.jpg' },
  { name: 'Bridal Makeup', href: categoryHref('makeup'), photo: '/cat-bridal-fashion.jpg', pos: 'object-[70%_30%]' },
  { name: 'Mehndi', href: categoryHref('mehndi'), photo: '/images/hero-bg.jpg', pos: 'object-[85%_35%]' },
  { name: 'Band & DJ', href: categoryHref('band') },
  { name: 'Pandits', href: '/categories/planning', photo: '/cat-wedding-tips.jpg' },
  { name: 'Invitations', href: '/categories/invitations' },
];

function Row({ copy }: { copy: boolean }) {
  return (
    <ul className="flex flex-shrink-0 items-center" aria-hidden={copy || undefined}>
      {PILLS.map((p) => (
        <li key={p.name} className="mx-2">
          <Link
            href={p.href}
            tabIndex={copy ? -1 : undefined}
            className="inline-flex items-center gap-3 rounded-full border border-[#E2D3BC] bg-white py-1.5 pl-1.5 pr-6 shadow-[0_6px_18px_rgba(34,23,20,0.06)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-[3px] hover:border-[#7A1238] hover:shadow-[0_14px_30px_rgba(122,18,56,0.14)] outline-none focus-visible:border-[#7A1238] focus-visible:ring-2 focus-visible:ring-[#7A1238]/40"
          >
            {p.photo ? (
              <Image src={p.photo} alt="" width={52} height={52} className={`h-[52px] w-[52px] flex-shrink-0 rounded-full object-cover ${p.pos ?? ''}`} />
            ) : (
              <span aria-hidden className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#F8E7BE,#C9A05A)] text-[26px] font-bold text-[#4A0B22]" style={serif}>
                {p.name[0]}
              </span>
            )}
            <span className="whitespace-nowrap text-[23px] font-semibold text-[#221714]" style={serif}>{p.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ServicePills() {
  return (
    <nav aria-label="Wedding services" className="home-pills home-pills-fade overflow-hidden border-y border-[#E2D3BC] bg-[#F4ECDF] py-5">
      {/* Two identical rows so the scroll loops without a jump; the second is hidden from screen readers */}
      <div className="home-pills-track flex w-max">
        <Row copy={false} />
        <Row copy />
      </div>
    </nav>
  );
}
