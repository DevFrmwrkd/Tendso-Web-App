"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Video, Mic, Gift, ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";

const earningRates = [
  {
    icon: Video,
    title: "Video Interview",
    amount: "₱500",
    desc: "Earn directly to your Wise wallet for a successful video interview and 3–5 location photos.",
    featured: false,
  },
  {
    icon: Mic,
    title: "Audio Only",
    amount: "₱300",
    desc: "Perfect for camera-shy owners. Record high-quality audio plus 3–5 photos to earn.",
    featured: false,
  },
  {
    icon: Gift,
    title: "Referral Bonus",
    amount: "₱1,000",
    desc: "Invite another creator. When they complete their first paid submission, you get the bonus.",
    featured: true,
  },
];

export default function EarningsSection() {
  const reduceMotion = useReducedMotion();

  const fadeUp = reduceMotion
    ? {}
    : {
      initial: { opacity: 0, y: 24 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: "-80px" },
    };

  return (
    <section
      id="for-creators"
      className="w-full py-24 sm:py-32 px-6 relative z-10 scroll-mt-24 overflow-hidden"
      style={{ background: "var(--ink)" }}
    >
      {/* Subtle rust glow accents */}
      <div className="absolute top-0 -right-32 w-[500px] h-[500px] rounded-full bg-[var(--rust)]/15 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-32 w-[500px] h-[500px] rounded-full bg-[var(--rust-soft)]/10 blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section marker — § 05 — FOR CREATORS */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-10 sm:mb-14 justify-center"
        >
          <span className="h-px w-10 sm:w-16 bg-[var(--rust-soft)]/50" />
          <p
            className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-medium text-[var(--rust-soft)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            § 05 — FOR CREATORS
          </p>
          <span className="h-px w-10 sm:w-16 bg-[var(--rust-soft)]/50" />
        </motion.div>

        {/* Headline */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
            }}
            className="font-bold text-[var(--khaki)] leading-[0.95] tracking-[-0.01em] mb-6"
          >
            Earn while bringing them{" "}
            <span className="italic" style={{ color: "var(--rust-soft)" }}>
              online.
            </span>
          </motion.h2>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "clamp(1.05rem, 1.5vw, 1.3rem)",
            }}
            className="italic text-[var(--khaki)]/65"
          >
            No selling courses. No deposits. Real cash, direct to your Wise wallet for every business you digitize.
          </motion.p>
        </div>

        {/* Earnings cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 max-w-6xl mx-auto">
          {earningRates.map((rate, idx) => {
            const Icon = rate.icon;
            return (
              <motion.div
                key={rate.title}
                initial={reduceMotion ? {} : { opacity: 0, y: 30 }}
                whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={`flex flex-col h-full rounded-[1.5rem] p-8 sm:p-9 relative overflow-hidden transition-all ${rate.featured
                  ? "bg-[var(--rust)] text-[var(--khaki)] border-2 border-[var(--rust-soft)] shadow-2xl shadow-[var(--rust)]/30"
                  : "bg-[var(--ink-soft)] border border-[var(--khaki)]/15 hover:border-[var(--rust-soft)]/50 hover:shadow-xl"
                  }`}
              >
                {/* Section marker on card */}
                <p
                  className={`text-[10px] uppercase tracking-[0.4em] font-medium mb-5 ${rate.featured ? "text-[var(--khaki)]/70" : "text-[var(--rust-soft)]"
                    }`}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  § 0{idx + 1}
                </p>

                <div
                  className={`mb-6 p-3.5 rounded-2xl w-max border ${rate.featured
                    ? "bg-[var(--khaki)]/15 border-[var(--khaki)]/30"
                    : "bg-[var(--rust)]/15 border-[var(--rust)]/30"
                    }`}
                >
                  <Icon className={`w-7 h-7 ${rate.featured ? "text-[var(--khaki)]" : "text-[var(--rust-soft)]"}`} />
                </div>

                <h3
                  style={{ fontFamily: "var(--font-playfair)" }}
                  className={`text-2xl sm:text-3xl font-bold mb-3 ${rate.featured ? "text-[var(--khaki)]" : "text-[var(--khaki)]"
                    }`}
                >
                  {rate.title}
                </h3>

                <div
                  style={{ fontFamily: "var(--font-playfair)" }}
                  className={`text-5xl sm:text-6xl font-bold tracking-tight mb-5 ${rate.featured ? "text-[var(--khaki)]" : "text-[var(--khaki)]"
                    }`}
                >
                  {rate.amount}
                </div>

                <p
                  className={`text-[15px] leading-relaxed mb-8 ${rate.featured ? "text-[var(--khaki)]/85" : "text-[var(--khaki)]/65"
                    }`}
                >
                  {rate.desc}
                </p>

                <Link href="/login" className="mt-auto">
                  <button
                    className={`w-full py-4 rounded-full font-semibold text-base flex items-center justify-center gap-3 transition-all hover:gap-4 min-h-[52px] ${rate.featured
                      ? "bg-[var(--khaki)] text-[var(--ink)] hover:bg-[var(--khaki-deep)]"
                      : "bg-[var(--rust)] text-[var(--khaki)] hover:bg-[var(--rust-soft)]"
                      }`}
                  >
                    Start Earning <ArrowRight className="w-5 h-5" />
                  </button>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom note */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
        >
          <div className="flex items-center gap-2 text-[var(--khaki)]/60">
            <Wallet className="w-4 h-4" />
            <p
              className="text-[10px] uppercase tracking-[0.4em] font-medium"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Paid in PHP via Wise · usually within 24 hours
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
