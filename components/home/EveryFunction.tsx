import Link from 'next/link';
import { accent, btnPrimary, container, eyebrow, h2, sectionPad, serif } from './styles';

const FUNCTIONS = [
  { name: 'Tilak', text: 'Hall, catering, pandit', color: 'text-[#7A1238]' },
  { name: 'Janeu', text: 'Pandit, havan, family lunch', color: 'text-[#8A4B12]' },
  { name: 'Haldi', text: 'Marigold decor, photos', color: 'text-[#8A6A2F]' },
  { name: 'Mehndi', text: 'Artists, seating, music', color: 'text-[#2F6B45]' },
  { name: 'Sangeet', text: 'Stage, DJ, lights', color: 'text-[#4B3F7A]' },
  { name: 'Wedding', text: 'Venue, mandap, baraat, band', color: 'text-white', main: true },
  { name: 'Reception', text: 'Lawn or hall, menu, film', color: 'text-[#221714]' },
  { name: 'Anniversary', text: 'Dinner, decor, cake', color: 'text-[#7A1238]' },
  { name: 'Griha Pravesh', text: 'Puja, flowers, catering', color: 'text-[#2F6B45]' },
];

export default function EveryFunction() {
  return (
    <section data-depth aria-labelledby="home-functions" className={`bg-[#F4ECDF] ${sectionPad}`}>
      <div className={`${container} grid items-center gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16`}>
        <div>
          <p className={eyebrow}>Every function, one plan</p>
          <h2 id="home-functions" className={h2} style={serif}>From Tilak to Reception, <span className={accent}>nothing slips</span></h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#4D3E36] sm:text-lg">
            Each function needs a different venue size, decor and menu. Your Wedding Expert plans them together, so the dates, vendors and budget add up.
          </p>
          <Link href="/plan" className={`${btnPrimary} mt-7 bg-[#221714] hover:bg-[#3A2A24]`}>Plan my functions</Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5">
          {FUNCTIONS.map((f) => (
            <li key={f.name} data-tilt className={`rounded-[22px] p-4 last:col-span-2 sm:p-6 sm:last:col-span-1 ${f.main ? 'bg-[#7A1238]' : 'border border-[#E2D3BC] bg-white'}`}>
              <span className={`block text-[1.5rem] font-semibold leading-none sm:text-[1.8rem] ${f.color}`} style={serif}>{f.name}</span>
              <p className={`mt-2 text-sm leading-snug ${f.main ? 'text-[#F4DCE5]' : 'text-[#4D3E36]'}`}>{f.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
