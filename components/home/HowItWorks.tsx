import { Check, X } from 'lucide-react';
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
export default function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="home-how" className={`scroll-mt-28 border-y border-[#EADFCC] bg-white ${sectionPad}`}>
      <div className={container}>
        <p className={`${eyebrow} justify-center`}>Why families plan with us</p>
        <h2 id="home-how" className={`${h2} text-center`} style={serif}>Planning alone vs <span className={accent}>with a Wedding Expert</span></h2>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="rounded-[26px] border border-[#EADFCC] bg-[#FBF6EE] p-7 sm:p-9">
            <h3 className="text-lg font-bold text-[#6B5A4E]">Planning alone</h3>
            <ul className="mt-5 space-y-3.5 text-base text-[#4D3E36]">
              {ALONE.map((t) => (
                <li key={t} className="flex gap-3"><X className="mt-1 h-4 w-4 flex-shrink-0 text-[#A8988A]" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[26px] bg-gradient-to-br from-[#7A1238] to-[#4A0B22] p-7 text-white shadow-[0_24px_60px_rgba(122,18,56,0.25)] sm:p-9">
            <h3 className="text-lg font-bold text-[#F3E3C3]">With your Wedding Expert</h3>
            <ul className="mt-5 space-y-3.5 text-base">
              {WITH_US.map((t) => (
                <li key={t} className="flex gap-3"><Check className="mt-1 h-4 w-4 flex-shrink-0 text-[#E9C98E]" strokeWidth={2.4} aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
        </div>

        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`border-t-2 pt-5 ${i === 0 ? 'border-[#7A1238]' : 'border-[#E2D3BC]'}`}>
              <span className={`text-[3.2rem] leading-none ${i === 0 ? 'text-[#7A1238]' : 'text-[#8A6A2F]'}`} style={serif}>0{i + 1}</span>
              <h3 className="mt-2.5 text-lg font-bold text-[#221714]">{s.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[#4D3E36]">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
