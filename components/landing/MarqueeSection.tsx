"use client";

import { motion } from "framer-motion";
import { Bricolage_Grotesque } from 'next/font/google';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '800'] });

export default function MarqueeSection() {
  return (
    <div className="w-full bg-neutral-900 py-6 overflow-hidden flex whitespace-nowrap border-y border-neutral-800 relative z-20">
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ ease: "linear", duration: 20, repeat: Infinity }}
        className={`flex gap-12 items-center text-3xl md:text-5xl font-black uppercase tracking-tighter text-white ${bricolage.className}`}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-12">
            <span>Capture Data</span>
            <span className="text-emerald-400">✦</span>
            <span>AI Generates</span>
            <span className="text-emerald-400">✦</span>
            <span>You Get Paid</span>
            <span className="text-emerald-400">✦</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
