'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Heart, MapPin, Phone, Mail, Star, Users, Award, Sparkles, ArrowRight, CheckCircle } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

function stagger(children = 0.1, delay = 0) {
  return { hidden: {}, show: { transition: { staggerChildren: children, delayChildren: delay } } };
}

const VALUES = [
  {
    icon: Heart,
    title: 'Love for Every Couple',
    desc: 'We believe every couple deserves a perfect wedding, regardless of budget or background. We work tirelessly to make your dream day a reality.',
    color: 'bg-rose-50 text-rose-500',
  },
  {
    icon: CheckCircle,
    title: 'Verified Vendors Only',
    desc: 'Every vendor on our platform is personally verified for quality, reliability, and professionalism — so you never have to worry.',
    color: 'bg-amber-50 text-amber-500',
  },
  {
    icon: Users,
    title: 'Community First',
    desc: 'We are building a community of couples and vendors across India, rooted in trust, transparency, and shared celebrations.',
    color: 'bg-emerald-50 text-emerald-500',
  },
  {
    icon: Award,
    title: 'Excellence Always',
    desc: 'From the vendors we list to the support we provide, we hold ourselves to the highest standards — because your wedding deserves nothing less.',
    color: 'bg-purple-50 text-purple-500',
  },
];

const STATS = [
  { value: '10,000+', label: 'Happy Couples' },
  { value: '500+',    label: 'Verified Vendors' },
  { value: '25+',     label: 'Cities Covered' },
  { value: '4.9★',   label: 'Average Rating' },
];

export default function AboutClient() {
  return (
    <div className="pt-16">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-950 via-rose-950 to-gray-950 py-24 sm:py-32">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="show" variants={stagger(0.15, 0.1)}>
            <motion.div variants={fadeUp} className="flex justify-center mb-10">
              <div className="relative w-64 sm:w-80 h-auto">
                <Image
                  src="/logo.jpeg"
                  alt="ShaadiShopping Logo"
                  width={320}
                  height={200}
                  className="object-contain drop-shadow-2xl rounded-2xl"
                  priority
                />
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              Our Story
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 font-[Playfair_Display,serif] leading-tight"
            >
              Everything for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400">
                Your Big Day
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-white/70 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed"
            >
              ShaadiShopping was born from a simple belief — that planning your wedding should feel exciting, not exhausting. We are India&apos;s most trusted wedding marketplace, connecting couples with the best vendors across the country.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.1)}
          >
            {STATS.map(({ value, label }) => (
              <motion.div key={label} variants={fadeUp} className="py-10 text-center px-6">
                <p className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-rose-500 font-[Playfair_Display,serif] mb-1">
                  {value}
                </p>
                <p className="text-sm text-gray-500 font-medium">{label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FOUNDER ── */}
      <section className="py-20 sm:py-28 bg-[#FFFAF5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="relative rounded-3xl overflow-hidden aspect-[4/5] max-w-sm mx-auto lg:mx-0 shadow-2xl">
                <Image
                  src="/images/anisha.jpg"
                  alt="Anisha Kumari — Founder & CEO, ShaadiShopping"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 80vw, 400px"
                  priority
                />
                {/* Name badge overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-6 py-5">
                  <p className="text-xl font-bold text-white font-[Playfair_Display,serif]">Anisha Kumari</p>
                  <p className="text-amber-300 font-semibold text-sm">Founder & CEO</p>
                  <div className="flex items-center gap-1.5 mt-1 text-white/70 text-xs">
                    <MapPin className="w-3 h-3 text-rose-300" />
                    Patna, Bihar, India
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -right-4 lg:right-0 bg-white rounded-2xl shadow-xl px-5 py-3 border border-amber-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-5 h-5 text-white fill-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Founded in</p>
                  <p className="text-sm font-bold text-gray-800">Patna, Bihar</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-amber-600 text-sm font-semibold uppercase tracking-wider mb-3">Meet the Founder</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-6 leading-tight">
                A Vision Born from{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-rose-500">
                  Love & Purpose
                </span>
              </h2>

              <div className="space-y-4 text-gray-600 text-base leading-relaxed">
                <p>
                  <span className="font-semibold text-gray-800">Anisha Kumari</span> founded ShaadiShopping with a dream — to make wedding planning accessible, joyful, and stress-free for every couple in India.
                </p>
                <p>
                  Growing up in Patna, Bihar, she witnessed how families struggled to find reliable vendors for their most important celebrations. The process was fragmented, time-consuming, and often filled with uncertainty.
                </p>
                <p>
                  With a passion for weddings and a deep understanding of the Indian market, Anisha built ShaadiShopping from the ground up — a single platform where couples can discover, compare, and book the best wedding vendors across the country, all with complete confidence.
                </p>
                <p>
                  Today, ShaadiShopping serves thousands of couples from Bihar to Bangalore, from Goa to Gujarat — and the mission remains the same: <span className="font-semibold text-amber-600">everything for your big day.</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-4 mt-8">
                <a
                  href="tel:+917646028228"
                  className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold px-6 py-3 rounded-full hover:opacity-90 transition-all hover:shadow-lg text-sm"
                >
                  <Phone className="w-4 h-4" /> Talk to Us
                </a>
                <a
                  href="mailto:hello@shaadishopping.com"
                  className="flex items-center gap-2 border border-amber-300 text-amber-700 font-semibold px-6 py-3 rounded-full hover:bg-amber-50 transition-all text-sm"
                >
                  <Mail className="w-4 h-4" /> Email Us
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-amber-950 via-rose-950 to-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.15)}>
            <motion.p variants={fadeUp} className="text-amber-400 text-sm font-semibold uppercase tracking-wider mb-4">
              Our Mission
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-bold text-white mb-8 font-[Playfair_Display,serif] leading-tight">
              Making Dream Weddings{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400">
                Accessible to All
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/70 text-lg leading-relaxed max-w-2xl mx-auto mb-12">
              We are on a mission to transform the Indian wedding industry — making it more transparent, accessible, and joyful. From small-town celebrations to grand destination weddings, ShaadiShopping is for every couple, every budget, and every dream.
            </motion.p>

            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
              {[
                { title: 'Discover', desc: 'Browse 500+ verified vendors across 20+ categories and 25+ cities — all in one place.' },
                { title: 'Compare', desc: 'Read real reviews, compare packages and prices, and shortlist the perfect vendors for your day.' },
                { title: 'Book', desc: 'Book with confidence knowing every vendor is verified and our team is here to support you.' },
              ].map((item) => (
                <div key={item.title} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                  <p className="text-amber-400 font-bold text-lg font-[Playfair_Display,serif] mb-2">{item.title}</p>
                  <p className="text-white/60 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.15)}
          >
            <motion.p variants={fadeUp} className="text-rose-500 text-sm font-semibold uppercase tracking-wider mb-2">
              What We Stand For
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-gray-900 font-[Playfair_Display,serif]">
              Our Core Values
            </motion.h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.12)}
          >
            {VALUES.map(({ icon: Icon, title, desc, color }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25 }}
                className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className={`w-12 h-12 rounded-xl ${color} bg-opacity-20 flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 font-[Playfair_Display,serif]">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CONTACT CTA ── */}
      <section className="relative py-24 sm:py-32 overflow-hidden" style={{ background: 'linear-gradient(160deg, #100610 0%, #1A0C14 50%, #0E0A08 100%)' }}>

        {/* Ambient gold glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(197,164,109,0.07) 0%, transparent 70%)' }} />
        {/* Top border shimmer */}
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(197,164,109,0.4), transparent)' }} />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.12)}>

            {/* Eyebrow */}
            <motion.div variants={fadeUp} className="flex items-center justify-center gap-3 mb-8">
              <div className="h-px w-14" style={{ background: 'linear-gradient(to right, transparent, rgba(197,164,109,0.45))' }} />
              <span className="text-[0.55rem] font-medium tracking-[0.4em] uppercase text-[#C5A46D]/60">Get in Touch</span>
              <div className="h-px w-14" style={{ background: 'linear-gradient(to left, transparent, rgba(197,164,109,0.45))' }} />
            </motion.div>

            {/* Heading */}
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.15] mb-5"
              style={{ fontFamily: 'var(--font-playfair, Playfair Display, serif)' }}
            >
              <span className="block text-white/80 font-light">Let&apos;s Plan Your Dream</span>
              <span className="block" style={{ background: 'linear-gradient(135deg, #e8d5b0 0%, #C5A46D 45%, #a07c45 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Wedding Together
              </span>
            </motion.h2>

            <motion.p variants={fadeUp} className="text-white/35 text-sm sm:text-base leading-relaxed mb-12 max-w-lg mx-auto font-light tracking-wide">
              Our team is here Monday to Friday, 10 am – 7 pm. Reach out and let us help you create memories that last a lifetime.
            </motion.p>

            {/* Phone cards */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10 max-w-xl mx-auto">
              {[
                { href: 'tel:+917646028228', label: 'Primary', number: '+91 76460 28228' },
                { href: 'tel:+916201732422', label: 'Alternate', number: '+91 62017 32422' },
              ].map((p) => (
                <a
                  key={p.href}
                  href={p.href}
                  className="group flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: 'rgba(197,164,109,0.05)',
                    border: '1px solid rgba(197,164,109,0.15)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(197,164,109,0.4)'; (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(197,164,109,0.09)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(197,164,109,0.15)'; (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(197,164,109,0.05)'; }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(197,164,109,0.1)', border: '1px solid rgba(197,164,109,0.2)' }}>
                    <Phone className="w-4 h-4 text-[#C5A46D]/70" />
                  </div>
                  <div className="text-left">
                    <p className="text-[0.6rem] uppercase tracking-[0.25em] text-[#C5A46D]/40 mb-0.5">{p.label}</p>
                    <p className="text-white/75 font-medium text-sm tracking-wide">{p.number}</p>
                  </div>
                </a>
              ))}
            </motion.div>


            {/* Primary CTA */}
            <motion.div variants={fadeUp}>
              <Link
                href="/plan"
                className="inline-flex items-center gap-3 relative overflow-hidden group rounded-full px-10 py-4 transition-all duration-500 hover:scale-[1.04]"
                style={{
                  background: 'linear-gradient(135deg, #8B1A4A 0%, #A8234E 50%, #C5A46D 100%)',
                  boxShadow: '0 4px 30px rgba(139,26,74,0.35)',
                }}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
                <Sparkles className="w-4 h-4 text-white/80 relative z-10 flex-shrink-0" />
                <span className="relative z-10 text-white font-semibold text-sm tracking-[0.08em]">Begin Your Wedding Journey</span>
                <ArrowRight className="w-4 h-4 text-white/70 relative z-10 flex-shrink-0 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>

              <p className="mt-5 text-[0.6rem] text-white/18 tracking-[0.25em] uppercase">Every love story deserves to be celebrated</p>
            </motion.div>

          </motion.div>
        </div>
      </section>

    </div>
  );
}
