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

export default function AboutPage() {
  return (
    <div className="pt-16">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-950 via-rose-950 to-gray-950 py-24 sm:py-32">
        {/* Decorative blobs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger(0.15, 0.1)}
          >
            {/* Big Logo */}
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

            {/* Founder visual */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-amber-100 to-rose-100 aspect-[4/5] max-w-sm mx-auto lg:mx-0 shadow-2xl">
                {/* Decorative pattern */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <span className="text-5xl font-bold text-white font-[Playfair_Display,serif]">A</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-800 font-[Playfair_Display,serif]">Anisha Kumari</p>
                    <p className="text-amber-600 font-semibold mt-1 text-sm">Founder & CEO</p>
                    <div className="flex items-center justify-center gap-1.5 mt-3 text-gray-500 text-sm">
                      <MapPin className="w-4 h-4 text-rose-400" />
                      Patna, Bihar, India
                    </div>
                    <div className="flex gap-1 justify-center mt-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
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

            {/* Founder story */}
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
                  href="tel:+917070486987"
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
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.15)}
          >
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
      <section className="py-16 bg-gradient-to-r from-amber-50 to-rose-50 border-t border-amber-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.15)}
          >
            <motion.div variants={fadeUp} className="flex justify-center mb-6">
              <Image src="/logo.jpeg" alt="ShaadiShopping" width={120} height={75} className="object-contain" />
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-bold text-gray-900 font-[Playfair_Display,serif] mb-3">
              Let&apos;s Plan Your Dream Wedding Together
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-500 text-base mb-8 max-w-xl mx-auto">
              Our team is here Monday to Friday, 10am to 7pm. Reach out and let us help you create memories that last a lifetime.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="tel:+917070486987"
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold px-8 py-3.5 rounded-full hover:opacity-90 transition-all hover:shadow-lg text-sm"
              >
                <Phone className="w-4 h-4" /> +91 70704 86987
              </a>
              <a
                href="mailto:hello@shaadishopping.com"
                className="flex items-center gap-2 border border-gray-300 text-gray-700 font-semibold px-8 py-3.5 rounded-full hover:border-amber-400 hover:text-amber-600 transition-all text-sm"
              >
                <Mail className="w-4 h-4" /> hello@shaadishopping.com
              </a>
              <Link
                href="/plan"
                className="flex items-center gap-2 bg-gray-900 text-white font-semibold px-8 py-3.5 rounded-full hover:bg-gray-800 transition-all text-sm"
              >
                <Sparkles className="w-4 h-4" /> Start Planning <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
