import type { CSSProperties } from 'react';
import { Check, X } from 'lucide-react';
import HowDepth from './HowDepth';
import s3 from './home3d.module.css';
import { accent, container, eyebrow, h2, sectionPad, serif } from './styles';

const ALONE = [
  'Dozens of calls to venues and vendors',
  "Quotations you can't compare side by side",
  'Weekends lost to venue visits',
  'Chasing every vendor before each function',
];
const WITH_US = [
  'One person to call, from first visit to vidai',
  'A shortlist that fits your guests and budget',
  'Visits arranged, quotations collected for you',
  'Every vendor coordinated, free for families',
];
const STEPS = [
  { title: 'Tell us about your wedding', text: 'Date, guests, budget and functions.' },
  { title: 'Get a shortlist', text: 'Venues and vendors that fit.' },
  { title: 'Visit and compare', text: 'Visits and quotations arranged.' },
  { title: 'Book and celebrate', text: 'We coordinate to the vidai.' },
];

// "Why families plan with us" + the four steps. Keeps the #how-it-works anchor the navbar links to.
// In 3D (19 Nov 2026): the two cards open like a book and the Wedding Expert card swings forward; the steps are a
// staircase of slabs that rise one after another. HowDepth drives both from the scroll position.
export default function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="home-how" className={`${s3.how} scroll-mt-28 overflow-hidden border-y border-[#EADFCC] bg-white ${sectionPad}`}>
      <div className={container}>
        <p className={`${eyebrow} justify-center`}>Why families plan with us</p>
        <h2 id="home-how" className={`${h2} text-center`} style={serif}>Planning alone vs <span className={accent}>with a Wedding Expert</span></h2>

        <div data-how-cards className={`${s3.howCards} mt-12 grid gap-5 md:grid-cols-2`}>
          <div className={`${s3.alone} rounded-[26px] border border-[#EADFCC] bg-[#FBF6EE] p-7 sm:p-9`}>
            <h3 className="text-lg font-bold text-[#6B5A4E]">Planning alone</h3>
            <ul className="mt-5 space-y-3.5 text-base text-[#4D3E36]">
              {ALONE.map((t) => (
                <li key={t} className="flex gap-3"><X className="mt-1 h-4 w-4 flex-shrink-0 text-[#A8988A]" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <div className={`${s3.expert} rounded-[26px] bg-gradient-to-br from-[#7A1238] to-[#4A0B22] p-7 text-white shadow-[0_24px_60px_rgba(122,18,56,0.25)] sm:p-9`}>
            <h3 className="text-lg font-bold text-[#F3E3C3]">With your Wedding Expert</h3>
            <ul className="mt-5 space-y-3.5 text-base">
              {WITH_US.map((t) => (
                <li key={t} className="flex gap-3"><Check className="mt-1 h-4 w-4 flex-shrink-0 text-[#E9C98E]" strokeWidth={2.4} aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
        </div>

        <ol data-how-steps className={`${s3.stairs} mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:items-start`}>
          {STEPS.map((s, i) => (
            <li key={s.title} className={`${s3.stair} ${i === 0 ? s3.stairFirst : ''}`} style={{ '--i': i } as CSSProperties}>
              <span className={`text-[3.2rem] leading-none ${i === 0 ? 'text-[#7A1238]' : 'text-[#8A6A2F]'}`} style={serif}>0{i + 1}</span>
              <h3 className="mt-2.5 text-lg font-bold text-[#221714]">{s.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[#4D3E36]">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
      <HowDepth
        sectionId="how-it-works"
        vars={[
          { sel: '[data-how-cards]', name: '--c', start: 0.95, span: 0.6 },
          { sel: '[data-how-steps]', name: '--s', start: 0.98, span: 0.65 },
        ]}
      />
    </section>
  );
}
