'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { fadeUp } from './animations';

export default function CountUpStat({
  end,
  suffix,
  label,
}: {
  end: number;
  suffix: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const startTime = performance.now();
    const duration = 2000;
    const raf = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(raf);
      else setValue(end);
    };
    requestAnimationFrame(raf);
  }, [end, inView]);

  const formatted = end >= 1000 ? value.toLocaleString('en-IN') : String(value);

  return (
    <motion.div ref={ref} variants={fadeUp} className="text-center lg:px-10">
      <p className="font-cormorant text-4xl sm:text-5xl lg:text-6xl font-light text-[#8B1A4A] leading-none mb-2">
        {formatted}{suffix}
      </p>
      <p className="text-gray-400 text-[0.58rem] sm:text-[0.7rem] tracking-[0.1em] sm:tracking-[0.2em] uppercase">
        {label}
      </p>
    </motion.div>
  );
}
