"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Wallet, Phone, ArrowRight } from "lucide-react";
import Link from "next/link";

const PHONE_DISPLAY = "0967 145 5245";
const PHONE_TEL = "tel:+639671455245";

export default function CtaSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="w-full py-24 sm:py-28 px-6 relative overflow-hidden flex items-center justify-center bg-white">
      {/* Black slab anchor */}
      <div className="absolute inset-x-4 sm:inset-x-8 lg:inset-x-12 inset-y-4 sm:inset-y-6 bg-neutral-900 rounded-[2rem] sm:rounded-[3rem] z-0" />

      {/* Light-green dot pattern over the slab */}
      <div
        className="absolute inset-x-4 sm:inset-x-8 lg:inset-x-12 inset-y-4 sm:inset-y-6 rounded-[2rem] sm:rounded-[3rem] opacity-[0.18] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at center, #d1fae5 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Emerald glow accent */}
      <div className="absolute -top-20 -right-20 w-[420px] h-[420px] bg-emerald-500/30 rounded-full filter blur-[140px] opacity-50 pointer-events-none" />

      <motion.div
        initial={reduceMotion ? {} : { opacity: 0, y: 24 }}
        whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center text-white max-w-3xl mx-auto flex flex-col items-center py-12 sm:py-16 px-2"
      >
        <p className="text-xs uppercase tracking-widest font-bold text-emerald-400 mb-4">
          Ready when you are
        </p>

        <h2
          style={{ fontFamily: "var(--font-fraunces)" }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] mb-6"
        >
          Your first <span className="italic text-emerald-400">payout</span> is one interview away.
        </h2>

        <p className="text-white/75 text-lg sm:text-xl font-normal mb-10 max-w-xl leading-relaxed">
          Install the app, walk into one local shop, record a short interview. We do the rest. You get paid to your Wise wallet — usually within 24 hours.
        </p>

        {/* Split CTA — creator primary, business secondary */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <Link
            href="/signup"
            className="group flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 px-7 sm:px-8 py-4 sm:py-5 rounded-full font-bold text-base sm:text-lg transition-transform hover:scale-[1.02] shadow-2xl shadow-emerald-500/30 min-h-[56px]"
          >
            <Wallet className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            Start earning
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <a
            href="#for-business"
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white px-7 py-4 rounded-full font-semibold text-base transition-colors border border-white/20 min-h-[56px]"
          >
            I own a business
          </a>
        </div>

        {/* Business owner direct line — small, below */}
        <a
          href={PHONE_TEL}
          className="mt-10 inline-flex items-center gap-2 text-sm text-white/60 hover:text-emerald-300 transition-colors group"
          aria-label={`Business owners — call us at ${PHONE_DISPLAY}`}
        >
          <Phone className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          Business owner? Call us directly: <span className="font-semibold">{PHONE_DISPLAY}</span>
        </a>
      </motion.div>
    </section>
  );
}
