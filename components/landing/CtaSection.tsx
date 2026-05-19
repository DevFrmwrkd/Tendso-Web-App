"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export default function CtaSection() {
  const reduceMotion = useReducedMotion();

  const fadeUp = reduceMotion
    ? {}
    : {
      initial: { opacity: 0, y: 30 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: "-100px" },
    };

  return (
    <section
      className="relative w-full overflow-hidden flex items-center justify-center min-h-[90vh] py-28 sm:py-36 px-6"
      style={{ background: "var(--ink)" }}
    >
      {/* Faint grain texture */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 25%, var(--khaki) 0.5px, transparent 1px), radial-gradient(circle at 75% 75%, var(--khaki) 0.5px, transparent 1px)",
          backgroundSize: "4px 4px, 6px 6px",
        }}
      />

      {/* Rust glow accents */}
      <div className="absolute top-0 -right-20 w-[500px] h-[500px] rounded-full bg-[var(--rust)]/20 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-[600px] h-[600px] rounded-full bg-[var(--rust-soft)]/12 blur-[160px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto w-full text-center">
        {/* Section marker — § 10 — THE VISION (matches NEO LAB screenshot) */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-12 sm:mb-16 justify-center"
        >
          <span className="h-px w-12 bg-[var(--rust-soft)]/50" />
          <p
            className="text-[11px] sm:text-xs uppercase tracking-[0.45em] font-medium text-[var(--rust-soft)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            § 10 — THE VISION
          </p>
          <span className="h-px w-12 bg-[var(--rust-soft)]/50" />
        </motion.div>

        {/* Massive editorial closing statement */}
        <motion.h2
          {...fadeUp}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-bold leading-[0.92] tracking-[-0.02em] text-[var(--khaki)] mb-10 sm:mb-14 mx-auto"
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "clamp(3.75rem, 13vw, 12rem)",
          }}
        >
          No business left
          <br />
          <span className="italic" style={{ color: "var(--rust-soft)" }}>
            offline.
          </span>
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="italic text-[var(--khaki)]/70 max-w-xl mx-auto mb-14 sm:mb-16"
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "clamp(1.15rem, 1.8vw, 1.6rem)",
          }}
        >
          Sign up in two minutes. We do the rest. You only pay ₱1,000 once your site is live.
        </motion.p>

        {/* Split CTAs */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-5"
        >
          <Link
            href="/signup"
            className="group flex items-center justify-center gap-3 bg-[var(--rust)] hover:bg-[var(--rust-soft)] text-[var(--khaki)] px-8 sm:px-10 py-5 rounded-full font-bold text-base sm:text-lg transition-all hover:-translate-y-0.5 shadow-2xl shadow-[var(--rust)]/30 min-h-[60px]"
          >
            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            Get your website online
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="#for-business"
            className="flex items-center justify-center gap-2 bg-[var(--khaki)]/10 hover:bg-[var(--khaki)]/20 text-[var(--khaki)] px-7 py-5 rounded-full font-semibold text-base transition-colors border border-[var(--khaki)]/25 min-h-[60px]"
          >
            See pricing
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Creator footnote — small text link */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="mt-10"
        >
          <Link
            href="#for-creators"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--khaki)]/55 hover:text-[var(--rust-soft)] transition-colors group italic"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Earn ₱300–₱500 as a creator instead
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>

        {/* Bottom signature mark */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 sm:mt-20 flex items-center justify-center gap-4"
        >
          <span className="h-px w-12 bg-[var(--khaki)]/20" />
          <p
            className="text-[10px] uppercase tracking-[0.5em] text-[var(--khaki)]/40"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Negosyo Digital · Real shops. Real fast.
          </p>
          <span className="h-px w-12 bg-[var(--khaki)]/20" />
        </motion.div>
      </div>
    </section>
  );
}
