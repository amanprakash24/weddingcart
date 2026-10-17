import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { btnPrimary, container, eyebrow, h2, lede, sectionPad, serif } from './styles';

const STEPS = [
  { title: 'Tell us about your wedding', text: 'Your date, guest count, budget and the functions you are planning.' },
  { title: 'Get a shortlist', text: 'Venues and vendors in Patna that fit your budget and style, with real prices.' },
  { title: 'Visit and compare', text: 'We arrange site visits and quotations so you can decide calmly.' },
  { title: 'Book and celebrate', text: 'Your expert coordinates with every vendor through to the vidai.' },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="home-how" className={`scroll-mt-28 bg-[var(--ivory)] ${sectionPad}`}>
      <div className={container}>
        <p className={eyebrow}>How it works</p>
        <h2 id="home-how" className={h2} style={serif}>Four steps, one person with you</h2>
        <p className={lede}>The same wedding expert stays with you from the first call to the last function.</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-[var(--soft-sand)] bg-white p-6">
              <span className="text-3xl text-[var(--gold-text)]" style={serif}>{i + 1}</span>
              <h3 className="mt-3 text-lg leading-snug text-[var(--deep-dark)]" style={serif}>{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--warm-brown)]">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <Link href="/plan" className={btnPrimary}>Begin your wedding journey <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </div>
      </div>
    </section>
  );
}
