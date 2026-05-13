"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Bricolage_Grotesque } from 'next/font/google';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['800'] });

export default function CtaSection() {
  return (
    <section className="w-full py-32 md:py-40 px-6 relative overflow-hidden flex items-center justify-center">
      {/* Skewed emerald block, like the original — now emerald instead of neon */}
      <div className="absolute inset-0 bg-emerald-500 skew-y-[-3deg] scale-110 z-0 origin-bottom-left" />

      {/* Subtle dot grid on top of the block, for texture */}
      <div
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          transform: 'skewY(-3deg) scale(1.1)',
          transformOrigin: 'bottom left',
        }}
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-200px" }}
        className="relative z-10 text-center text-white max-w-4xl mx-auto flex flex-col items-center"
      >
        <h2 className={`text-5xl sm:text-6xl md:text-9xl font-black uppercase tracking-tighter leading-[0.85] mb-8 ${bricolage.className}`}>
          Empower <br /> Local <br /> Stores.
        </h2>
        <p className="text-white/90 text-lg sm:text-xl md:text-3xl font-medium mb-12 max-w-2xl px-4 leading-relaxed">
          Help small businesses leap into the digital age while earning a sustainable income.
        </p>
        <Link href="/login">
          <motion.button
            whileHover={{ scale: 1.05, rotate: -1 }}
            whileTap={{ scale: 0.95 }}
            className={`bg-neutral-900 text-emerald-400 px-8 md:px-12 py-5 md:py-6 rounded-full font-black text-lg sm:text-xl md:text-2xl tracking-widest uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-4 shadow-2xl shadow-neutral-900/30 ${bricolage.className}`}
          >
            Become a Creator <ArrowRight className="w-6 h-6 md:w-8 md:h-8" />
          </motion.button>
        </Link>
      </motion.div>
    </section>
  );
}
