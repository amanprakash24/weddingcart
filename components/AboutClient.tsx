'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Heart, MapPin, Phone, Mail, Sparkles, ArrowRight,
  Users, Building2, Store,
  Compass, CalendarCheck, Handshake, PartyPopper,
  LayoutDashboard, Network, ClipboardList, Wallet, MessageSquare,
} from 'lucide-react';

const easeLux = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeLux } },
};

function stagger(children = 0.1, delay = 0) {
  return { hidden: {}, show: { transition: { staggerChildren: children, delayChildren: delay } } };
}

// ── Ecosystem pillars ──────────────────────────────────────────────────────
const ECOSYSTEM = [
  {
    icon: Users,
    label: 'For Couples',
    title: 'One Expert, Every Detail',
    desc: 'A dedicated Wedding Expert curates venues and vendors around your city, guest count, and budget — so you plan a celebration, not a spreadsheet.',
  },
  {
    icon: Building2,
    label: 'For Venues',
    title: 'A Direct Line to Real Couples',
    desc: 'Venues get a verified profile, real enquiries from couples already planning in their city, and a booking pipeline built specifically for weddings.',
  },
  {
    icon: Store,
    label: 'For Vendors',
    title: 'Coordination Without the Chaos',
    desc: 'Makeup artists, decorators, caterers, and every other vendor manage packages, pricing, and bookings from one dashboard built into the same system couples use.',
  },
];

// ── From Shaadi to Vidaai lifecycle ────────────────────────────────────────
const LIFECYCLE = [
  { icon: Compass, title: 'Discovery', desc: 'Explore verified venues and vendors, curated to your city and celebration style.' },
  { icon: CalendarCheck, title: 'Planning', desc: 'A guided wizard turns your vision into a real plan — budget, guest count, functions, dates.' },
  { icon: Handshake, title: 'Booking', desc: 'Compare packages, confirm vendors, and lock in every service for every function.' },
  { icon: PartyPopper, title: 'Execution', desc: 'Timelines, tasks, and vendor coordination run through the Wedding Workspace — nothing falls through the cracks.' },
  { icon: Heart, title: 'Vidaai', desc: 'From the first Shaadi conversation to the final Vidaai, one platform carries the celebration through.' },
];

// ── Vivah OS feature showcase ───────────────────────────────────────────────
const VIVAH_OS_FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'Command Center',
    desc: 'A single, real-time view of every wedding in motion — today\'s follow-ups, upcoming events, and outstanding payments in one place.',
  },
  {
    icon: Network,
    title: 'CRM & Lead Pipeline',
    desc: 'Every enquiry, consultation, and lead moves through one structured pipeline, so no couple waits and no follow-up gets lost.',
  },
  {
    icon: ClipboardList,
    title: 'Wedding Workspace',
    desc: 'Timeline, task board, vendor assignments, and documents for each wedding — the coordination layer that keeps every function on track.',
  },
  {
    icon: Store,
    title: 'Vendor OS',
    desc: 'Vendors manage their own packages, availability, and bookings — coordination that scales without a phone call for every update.',
  },
  {
    icon: Wallet,
    title: 'Finance',
    desc: 'Invoicing, secure payment links, and payout tracking — every rupee of every wedding budget accounted for, transparently.',
  },
  {
    icon: MessageSquare,
    title: 'Customer Portal',
    desc: 'Couples track their own wedding\'s progress, guests, approvals, and budget — always in view, never a mystery.',
  },
];

export default function AboutClient() {
  return (
    <div className="pt-16 bg-[#FFFCF7]">

      {/* ── HERO — cinematic, dark ── */}
      <section className="relative overflow-hidden py-28 sm:py-36" style={{ background: 'linear-gradient(160deg, #1C0E14 0%, #2A1F1B 55%, #150B08 100%)' }}>
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '42px 42px' }} />
        <div className="absolute top-0 left-1/4 w-[32rem] h-[32rem] bg-[#8B1A4A]/10 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[28rem] h-[28rem] bg-[#C5A46D]/10 rounded-full blur-3xl translate-y-1/2 pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="show" variants={stagger(0.15, 0.1)}>
            <motion.div variants={fadeUp} className="flex justify-center mb-9">
              <Image
                src="/logo.jpeg"
                alt="ShaadiShopping Logo"
                width={260}
                height={160}
                className="object-contain drop-shadow-2xl rounded-2xl"
                priority
              />
            </motion.div>

            <motion.div variants={fadeUp} className="ornament-line justify-center mb-6">
              <span className="eyebrow-luxury whitespace-nowrap">Our Story</span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-[1.1]"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              The New Way to{' '}
              <span className="gradient-text-luxury">Plan a Wedding</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-white/60 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed font-light">
              ShaadiShopping is a complete wedding ecosystem — discovery, planning, booking, and execution, for couples, venues, and vendors — built and run on our own technology platform, Vivah OS.
            </motion.p>

            <motion.p variants={fadeUp} className="font-cormorant italic text-[#C5A46D]/70 text-xl mt-5">
              From the first Shaadi conversation to the final Vidaai.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ── HOW WE WORK — factual, not vanity metrics ── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.1)}
          >
            {[
              { title: 'One Wedding Expert', desc: 'Assigned to every couple, from booking to vidaai' },
              { title: 'Free for Couples', desc: 'Browsing, comparing, and booking cost nothing' },
              { title: 'Patna → Bihar', desc: 'Deeply rooted in Patna, expanding across Bihar' },
            ].map(({ title, desc }) => (
              <motion.div key={title} variants={fadeUp} className="py-9 text-center px-6">
                <p className="text-lg font-semibold text-[#2A1F1B] mb-1" style={{ fontFamily: 'var(--font-playfair, serif)' }}>{title}</p>
                <p className="text-sm text-gray-500">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PROBLEM STATEMENT ── */}
      <section className="py-20 sm:py-28 bg-[#FFFCF7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.15)}>
            <motion.p variants={fadeUp} className="eyebrow-luxury mb-4">The Problem</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-semibold text-[#2A1F1B] mb-6 leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Wedding Planning Was Never Meant to Feel This Scattered
            </motion.h2>
            <motion.p variants={fadeUp} className="pull-quote text-[#6B5B4D] max-w-xl mx-auto">
              A venue found on one app. A makeup artist recommended by a cousin. A caterer discovered on WhatsApp. A decorator&apos;s number lost in a forwarded message.
            </motion.p>
            <motion.p variants={fadeUp} className="text-gray-500 text-base leading-relaxed mt-6 max-w-xl mx-auto">
              Every family plans a wedding the same fragmented way — dozens of vendors, no single thread connecting them, and no one person holding the whole celebration in view. We built ShaadiShopping to change that.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ── ECOSYSTEM: Couple / Venue / Vendor ── */}
      <section className="py-20 sm:py-28 bg-[#2A1F1B] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-14" initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.15)}>
            <motion.p variants={fadeUp} className="eyebrow-luxury mb-3 justify-center flex">One Ecosystem</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-semibold text-white leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Built for Every Side of the Celebration
            </motion.h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.12)}
          >
            {ECOSYSTEM.map(({ icon: Icon, label, title, desc }) => (
              <motion.div key={label} variants={fadeUp} className="bg-[#2A1F1B] p-8 sm:p-10">
                <div className="w-12 h-12 rounded-xl border border-[#C5A46D]/25 flex items-center justify-center mb-6">
                  <Icon className="w-5 h-5 text-[#C5A46D]" />
                </div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#C5A46D]/70 mb-3">{label}</p>
                <h3 className="text-xl font-semibold text-white mb-3" style={{ fontFamily: 'var(--font-playfair, serif)' }}>{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FROM SHAADI TO VIDAAI — lifecycle ── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.15)}>
            <motion.p variants={fadeUp} className="eyebrow-luxury mb-3">The Lifecycle</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-semibold text-[#2A1F1B] leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              From <span className="gradient-text-maroon">Shaadi</span> to <span className="gradient-text-maroon">Vidaai</span>
            </motion.h2>
          </motion.div>

          <motion.div
            className="relative"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger(0.12)}
          >
            {/* Connecting line */}
            <div className="hidden lg:block absolute top-7 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, #C5A46D 8%, #C5A46D 92%, transparent)' }} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-4">
              {LIFECYCLE.map(({ icon: Icon, title, desc }, i) => (
                <motion.div key={title} variants={fadeUp} className="relative text-center lg:px-2">
                  <div className="relative z-10 w-14 h-14 mx-auto rounded-full bg-[#FFFCF7] border-2 border-[#C5A46D] flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6 text-[#8B1A4A]" />
                  </div>
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#C5A46D] mb-2">Step {i + 1}</p>
                  <h3 className="text-lg font-semibold text-[#2A1F1B] mb-2" style={{ fontFamily: 'var(--font-playfair, serif)' }}>{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── VIVAH OS FEATURE SHOWCASE ── */}
      <section className="py-20 sm:py-28 bg-[#FAF5EE] relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-14 max-w-2xl mx-auto" initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.15)}>
            <motion.p variants={fadeUp} className="eyebrow-luxury mb-3">The Technology</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-semibold text-[#2A1F1B] mb-4 leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Powered by <span className="gradient-text-maroon">Vivah OS</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-500 text-base leading-relaxed">
              Vivah OS is the operations platform running behind every ShaadiShopping wedding — connecting couples, venues, and vendors on one system, instead of a hundred disconnected calls and messages.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.1)}
          >
            {VIVAH_OS_FEATURES.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25 }}
                className="bg-white/70 backdrop-blur-sm border border-[#C5A46D]/15 rounded-2xl p-7 hover:border-[#C5A46D]/40 hover:shadow-[0_20px_50px_rgba(139,26,74,0.08)] transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-[#8B1A4A]/8 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-[#8B1A4A]" />
                </div>
                <h3 className="font-semibold text-[#2A1F1B] mb-2" style={{ fontFamily: 'var(--font-playfair, serif)' }}>{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FOUNDER STORY ── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">

            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: easeLux }}
              className="relative"
            >
              <div className="relative rounded-3xl overflow-hidden aspect-[4/5] max-w-sm mx-auto lg:mx-0 shadow-2xl">
                <Image
                  src="/images/anisha.jpg"
                  alt="Anisha Kumari — Founder, ShaadiShopping"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 80vw, 400px"
                  priority
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-6 py-5">
                  <p className="text-xl font-semibold text-white" style={{ fontFamily: 'var(--font-playfair, serif)' }}>Anisha Kumari</p>
                  <p className="text-[#C5A46D] font-semibold text-sm">Founder</p>
                  <div className="flex items-center gap-1.5 mt-1 text-white/70 text-xs">
                    <MapPin className="w-3 h-3 text-[#C5A46D]" />
                    Patna, Bihar, India
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -right-4 lg:right-0 bg-white rounded-2xl shadow-xl px-5 py-3 border border-[#C5A46D]/20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #8B1A4A, #C5A46D)' }}>
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
              transition={{ duration: 0.7, ease: easeLux }}
            >
              <p className="eyebrow-luxury mb-3">Meet the Founder</p>
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#2A1F1B] mb-6 leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                A Vision Born from <span className="gradient-text-maroon">Love &amp; Purpose</span>
              </h2>

              <div className="space-y-4 text-gray-600 text-base leading-relaxed">
                <p>
                  <span className="font-semibold text-[#2A1F1B]">Anisha Kumari</span> founded ShaadiShopping with a simple belief — that planning a wedding should feel exciting, not exhausting.
                </p>
                <p>
                  Growing up in Patna, Bihar, she saw families struggle to find reliable vendors for their most important celebrations — a process that was fragmented, time-consuming, and often filled with uncertainty.
                </p>
                <p>
                  That experience became ShaadiShopping — a single platform where couples discover, plan, and book with confidence, and where Vivah OS, the technology she built to run it, keeps every venue, vendor, and moment connected.
                </p>
                <p>
                  Today, ShaadiShopping is Patna&apos;s trusted wedding planning platform, expanding across Bihar — and the mission remains the same:{' '}
                  <span className="font-semibold text-[#8B1A4A]">everything for your big day.</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-4 mt-8">
                <a href="tel:+917646028228" className="btn-luxury inline-flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Talk to Us
                </a>
                <a
                  href="mailto:shaadi.shopping51@gmail.com"
                  className="flex items-center gap-2 border border-[#C5A46D]/40 text-[#8B1A4A] font-semibold px-6 py-3 rounded-full hover:bg-[#FAF5EE] transition-all text-sm"
                >
                  <Mail className="w-4 h-4" /> Email Us
                </a>
              </div>
            </motion.div>
          </div>

          {/* Co-founder */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: easeLux }}
            className="max-w-2xl mx-auto"
          >
            <div className="flex items-center gap-6 bg-[#FAF5EE] rounded-2xl p-7 sm:p-8 border border-[#C5A46D]/15">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center flex-shrink-0 text-white text-xl sm:text-2xl font-semibold"
                style={{ background: 'linear-gradient(135deg, #2A1F1B, #5C1133)', fontFamily: 'var(--font-playfair, serif)' }}
              >
                GS
              </div>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#C5A46D]/80 mb-1">Co-founder</p>
                <p className="text-lg font-semibold text-[#2A1F1B] mb-1.5" style={{ fontFamily: 'var(--font-playfair, serif)' }}>Gaurav Sudhanshu</p>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Co-founded ShaadiShopping alongside Anisha, building Vivah OS — the platform running the CRM, Wedding Workspace, Vendor OS, and finance behind every wedding on ShaadiShopping.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── MISSION / VISION ── */}
      <section className="py-20 sm:py-28 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #1C0E14 0%, #2A1F1B 55%, #150B08 100%)' }}>
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.15)}>
            <motion.p variants={fadeUp} className="eyebrow-luxury mb-4">Our Mission</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-semibold text-white mb-8 leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Every Wedding, <span className="gradient-text-luxury">Held Together</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/60 text-lg leading-relaxed max-w-2xl mx-auto mb-12 font-light">
              We are on a mission to make wedding planning transparent, connected, and joyful — for the couple planning their once-in-a-lifetime day, and for the venues and vendors bringing it to life. ShaadiShopping is the celebration platform; Vivah OS is what makes it run without the chaos.
            </motion.p>

            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
              {[
                { title: 'Discover', desc: 'Browse verified venues and vendors across every wedding category — all in one place.' },
                { title: 'Plan', desc: 'One Wedding Expert, one workspace, and one timeline for every function of the celebration.' },
                { title: 'Celebrate', desc: 'Book with confidence, coordinate without chaos, and arrive at vidaai with nothing left undone.' },
              ].map((item) => (
                <div key={item.title} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                  <p className="text-[#C5A46D] font-semibold text-lg mb-2" style={{ fontFamily: 'var(--font-playfair, serif)' }}>{item.title}</p>
                  <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── EXPANSION STORY ── */}
      <section className="py-20 sm:py-28 bg-[#FFFCF7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-14" initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.15)}>
            <motion.p variants={fadeUp} className="eyebrow-luxury mb-3">Where We&apos;re Headed</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-semibold text-[#2A1F1B] leading-tight" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Rooted in Patna, Built to Grow
            </motion.h2>
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row items-stretch justify-center gap-4 sm:gap-0"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.1)}
          >
            {[
              { stage: 'Today', place: 'Patna', desc: 'Our home — the deepest vendor network and every ShaadiShopping wedding we\'ve run so far.', active: true },
              { stage: 'Expanding', place: 'Bihar', desc: 'Growing city by city, from the same trusted vendor network and Wedding Expert model.', active: true },
              { stage: 'Vision', place: 'India', desc: 'Bringing the same one-expert, one-platform experience to couples across the country.', active: false },
              { stage: 'Vision', place: 'Destination Weddings', desc: 'Coordinated through Vivah OS, wherever the celebration takes place.', active: false },
            ].map((s, i, arr) => (
              <motion.div key={s.place} variants={fadeUp} className="flex-1 relative px-6 py-8 text-center">
                {i < arr.length - 1 && (
                  <div className="hidden sm:block absolute top-1/2 -right-0 w-px h-16 -translate-y-1/2" style={{ background: 'linear-gradient(to bottom, transparent, #C5A46D80, transparent)' }} />
                )}
                <p className={`text-[0.6rem] font-bold uppercase tracking-[0.22em] mb-3 ${s.active ? 'text-[#8B1A4A]' : 'text-gray-400'}`}>{s.stage}</p>
                <p className="text-xl font-semibold text-[#2A1F1B] mb-3" style={{ fontFamily: 'var(--font-playfair, serif)' }}>{s.place}</p>
                <p className="text-gray-500 text-sm leading-relaxed max-w-[220px] mx-auto">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-24 sm:py-32 overflow-hidden" style={{ background: 'linear-gradient(160deg, #100610 0%, #1A0C14 50%, #0E0A08 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(197,164,109,0.07) 0%, transparent 70%)' }} />
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(197,164,109,0.4), transparent)' }} />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger(0.12)}>

            <motion.div variants={fadeUp} className="ornament-line justify-center mb-8">
              <span className="text-[0.55rem] font-medium tracking-[0.4em] uppercase text-[#C5A46D]/60">Get in Touch</span>
            </motion.div>

            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.15] mb-5"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              <span className="block text-white/80 font-light">Let&apos;s Plan Your Dream</span>
              <span className="block gradient-text-luxury">Wedding Together</span>
            </motion.h2>

            <motion.p variants={fadeUp} className="text-white/35 text-sm sm:text-base leading-relaxed mb-12 max-w-lg mx-auto font-light tracking-wide">
              Our team is here Monday to Friday, 10 am – 7 pm. Reach out and let us help you create memories that last a lifetime.
            </motion.p>

            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10 max-w-xl mx-auto">
              {[
                { href: 'tel:+917646028228', label: 'Primary', number: '+91 76460 28228' },
                { href: 'tel:+919942972484', label: 'Alternate', number: '+91 99429 72484' },
              ].map((p) => (
                <a
                  key={p.href}
                  href={p.href}
                  className="group flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                  style={{ background: 'rgba(197,164,109,0.05)', border: '1px solid rgba(197,164,109,0.15)' }}
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

            <motion.div variants={fadeUp}>
              <Link
                href="/plan"
                className="inline-flex items-center gap-3 relative overflow-hidden group rounded-full px-10 py-4 transition-all duration-500 hover:scale-[1.04]"
                style={{ background: 'linear-gradient(135deg, #8B1A4A 0%, #A8234E 50%, #C5A46D 100%)', boxShadow: '0 4px 30px rgba(139,26,74,0.35)' }}
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
