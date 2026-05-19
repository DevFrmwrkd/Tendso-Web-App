"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function HeroSection() {
  const apkUrl = useQuery(api.settings.get, { key: "apk_download_url" }) as string | null;
  const [showIosGuide, setShowIosGuide] = useState(false);
  const deferredPrompt = useRef<any>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const fadeUp = reduceMotion
    ? {}
    : {
      initial: { opacity: 0, y: 24 },
      animate: { opacity: 1, y: 0 },
    };

  return (
    <section
      className="relative w-full overflow-hidden flex items-center min-h-screen pt-28 pb-20 sm:pt-32 sm:pb-28 px-6"
      style={{ background: "var(--khaki)" }}
    >
      {/* Subtle paper grain texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 25%, var(--ink) 0.5px, transparent 1px), radial-gradient(circle at 75% 75%, var(--ink) 0.5px, transparent 1px)",
          backgroundSize: "4px 4px, 6px 6px",
        }}
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto text-center">
        {/* Section marker — § 01 — THE VISION */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-10 sm:mb-14 justify-center"
        >
          <span className="h-px w-10 sm:w-16 bg-[var(--rust)]/40" />
          <p
            className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-medium text-[var(--rust)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            § 01 — THE VISION
          </p>
          <span className="h-px w-10 sm:w-16 bg-[var(--rust)]/40" />
        </motion.div>

        {/* Massive editorial display headline */}
        <motion.h1
          {...fadeUp}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-bold leading-[0.92] tracking-[-0.02em] text-[var(--ink)] mb-8 sm:mb-10 mx-auto"
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "clamp(3.5rem, 11vw, 10rem)",
          }}
        >
          A website
          <br />
          for{" "}
          <span className="italic" style={{ color: "var(--rust)" }}>
            every shop
          </span>
          <br />
          on Earth.
        </motion.h1>

        {/* Italic subhead — editorial style */}
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="italic text-[var(--ink)]/70 max-w-2xl mx-auto leading-relaxed mb-12 sm:mb-14"
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "clamp(1.25rem, 2.4vw, 1.85rem)",
          }}
        >
          Real shops. Real websites. Real fast.
        </motion.p>

        {/* Three-line concrete value prop in body sans */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3 max-w-3xl mx-auto mb-14 sm:mb-16 pb-12 border-b border-[var(--ink)]/15"
        >
          <div className="flex items-baseline gap-2 justify-center sm:justify-start">
            <span
              className="text-[10px] uppercase tracking-[0.3em] text-[var(--rust)] font-semibold"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              01
            </span>
            <p className="text-sm text-[var(--ink)]/80">
              Real coded website — not a template.
            </p>
          </div>
          <div className="flex items-baseline gap-2 justify-center sm:justify-start">
            <span
              className="text-[10px] uppercase tracking-[0.3em] text-[var(--rust)] font-semibold"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              02
            </span>
            <p className="text-sm text-[var(--ink)]/80">
              Live in 48 hours from the call.
            </p>
          </div>
          <div className="flex items-baseline gap-2 justify-center sm:justify-start">
            <span
              className="text-[10px] uppercase tracking-[0.3em] text-[var(--rust)] font-semibold"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              03
            </span>
            <p className="text-sm text-[var(--ink)]/80">
              ₱1,000 once. No monthly fees. Ever.
            </p>
          </div>
        </motion.div>

        {/* CTAs — editorial duo */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5 justify-center"
        >
          <Link
            href="/signup"
            className="group inline-flex items-center justify-center gap-3 bg-[var(--ink)] hover:bg-[var(--rust)] text-[var(--khaki)] px-7 sm:px-9 py-4 sm:py-5 rounded-full font-semibold text-base sm:text-lg transition-all hover:-translate-y-0.5 shadow-lg shadow-[var(--ink)]/15 min-h-[56px]"
          >
            <span>Get your website online</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <a
            href="#for-creators"
            className="group inline-flex items-center justify-center gap-2 text-[var(--ink)] hover:text-[var(--rust)] px-5 py-4 font-medium text-sm sm:text-base transition-colors min-h-[56px]"
          >
            <span className="italic" style={{ fontFamily: "var(--font-playfair)" }}>
              Earn as a creator instead
            </span>
            <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
          </a>
        </motion.div>

        {/* Bottom scroll cue */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="hidden lg:flex absolute bottom-8 right-8 items-center gap-3 text-[var(--ink)]/40"
        >
          <p
            className="text-[10px] uppercase tracking-[0.4em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Scroll
          </p>
          <span className="h-px w-12 bg-[var(--ink)]/30" />
          <ArrowDown className="w-4 h-4" />
        </motion.div>
      </div>

      {/* iOS install guide — still wired so app prompt can be reused elsewhere */}
      {apkUrl && showIosGuide && (
        <div
          className="fixed inset-0 bg-[var(--ink)]/70 backdrop-blur-sm z-[9999] flex items-end justify-center"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="w-full max-w-md mx-4 mb-8 bg-[var(--khaki)] rounded-2xl p-6 text-[var(--ink)] shadow-2xl border border-[var(--ink)]/10"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="text-2xl font-semibold mb-4"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Install Negosyo Digital
            </p>
            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-3 bg-[var(--ink)] text-[var(--khaki)] rounded-xl font-semibold text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
