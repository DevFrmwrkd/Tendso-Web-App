"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Search, Send, Sparkles, BadgeCheck, Wallet, ArrowRight } from "lucide-react";
import { BASE_PRICE, PRICE_CEILING, UNLOCK_THRESHOLD, commissionFor, formatPHP } from "@/lib/pricing";

const flowSteps = [
  {
    icon: Search,
    label: "Find a business",
    desc: "Walk into a local barber shop, restaurant, salon, or auto repair. Pitch the ₱999 website.",
  },
  {
    icon: Send,
    label: "Submit through the app",
    desc: "Collect info, take 3–5 photos, record an audio or video interview. Submit in one tap.",
  },
  {
    icon: Sparkles,
    label: "AI builds the site",
    desc: "Our AI builds a real coded website in 24–48 hours. We enhance the photos automatically.",
  },
  {
    icon: BadgeCheck,
    label: "Client approves & pays",
    desc: "Owner reviews the live website. They pay ₱999 only when they accept it.",
  },
  {
    icon: Wallet,
    label: "You get paid",
    desc: `Keep 50% of every sale, straight to your Wise wallet (usually within 24 hours). You start at the ${formatPHP(BASE_PRICE)} launch price (${formatPHP(commissionFor(BASE_PRICE))} to you). After ${UNLOCK_THRESHOLD} successful submissions you unlock price-setting — charge up to ${formatPHP(PRICE_CEILING)} and keep half (up to ${formatPHP(commissionFor(PRICE_CEILING))}).`,
  },
];

export default function CreatorEarningFlow() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="earning-flow"
      className="w-full py-20 sm:py-24 px-6 max-w-7xl mx-auto relative z-10"
    >
      <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
        <p className="text-xs uppercase tracking-widest font-bold text-amber-700 mb-3">
          The earning flow
        </p>
        <h2
          style={{ fontFamily: "var(--font-fraunces)" }}
          className="text-4xl sm:text-5xl md:text-6xl font-semibold text-neutral-900 leading-[1.05] mb-5"
        >
          From hustle to <span className="italic text-amber-700">payout.</span>
        </h2>
        <p className="text-base sm:text-lg text-neutral-700 leading-relaxed">
          Five steps. No deposits. No selling courses. Real money to your Wise wallet.
        </p>
      </div>

      {/* DESKTOP: horizontal flow with connectors */}
      <ol className="hidden md:flex items-stretch justify-between gap-2 lg:gap-3 max-w-6xl mx-auto">
        {flowSteps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <motion.li
              key={step.label}
              initial={reduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="relative flex-1 flex flex-col items-center text-center"
            >
              {/* Connector line to the right (not on last item) */}
              {idx < flowSteps.length - 1 && (
                <div className="absolute top-7 left-[60%] right-[-40%] h-px bg-gradient-to-r from-amber-300 to-amber-100 z-0" aria-hidden />
              )}

              <div className="relative z-10 w-14 h-14 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center mb-4 shadow-sm">
                <Icon className="w-6 h-6 text-amber-700" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-1">
                Step {idx + 1}
              </p>
              <h3
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="text-lg lg:text-xl font-semibold text-neutral-900 mb-2 leading-tight"
              >
                {step.label}
              </h3>
              <p className="text-xs lg:text-sm text-neutral-600 leading-relaxed px-1">
                {step.desc}
              </p>
            </motion.li>
          );
        })}
      </ol>

      {/* MOBILE: vertical timeline */}
      <ol className="md:hidden flex flex-col gap-5 max-w-md mx-auto">
        {flowSteps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <motion.li
              key={step.label}
              initial={reduceMotion ? {} : { opacity: 0, x: -16 }}
              whileInView={reduceMotion ? {} : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="relative flex gap-4 items-start"
            >
              {/* Vertical connector */}
              {idx < flowSteps.length - 1 && (
                <span
                  className="absolute left-[27px] top-[60px] bottom-[-20px] w-px bg-amber-200"
                  aria-hidden
                />
              )}

              <div className="relative z-10 shrink-0 w-14 h-14 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center shadow-sm">
                <Icon className="w-6 h-6 text-amber-700" />
              </div>

              <div className="flex-1 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-0.5">
                  Step {idx + 1}
                </p>
                <h3
                  style={{ fontFamily: "var(--font-fraunces)" }}
                  className="text-lg font-semibold text-neutral-900 mb-1.5 leading-tight"
                >
                  {step.label}
                </h3>
                <p className="text-sm text-neutral-700 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {/* Money breakdown panel */}
      <div className="mt-14 sm:mt-16 max-w-3xl mx-auto rounded-3xl bg-neutral-900 text-white p-7 sm:p-10 border border-neutral-800 shadow-xl shadow-neutral-900/15">
        <p className="text-xs uppercase tracking-widest font-bold text-amber-400 mb-3">
          Where the ₱999 goes
        </p>
        <h3
          style={{ fontFamily: "var(--font-fraunces)" }}
          className="text-2xl sm:text-3xl font-semibold mb-6"
        >
          Transparent split. <span className="italic text-amber-400">No hidden cuts.</span>
        </h3>

        <ul className="space-y-3">
          <li className="flex items-center gap-4 py-3 border-b border-white/10">
            <span className="text-amber-400 font-bold text-sm w-12 shrink-0">₱500</span>
            <span className="flex-1 text-white/85 text-sm sm:text-base">You earn — 50% of every website you sell (₱500 at the starter price, up to ₱2,500 as you unlock higher pricing)</span>
            <ArrowRight className="w-4 h-4 text-white/40" aria-hidden />
          </li>
          <li className="flex items-center gap-4 py-3 border-b border-white/10">
            <span className="text-amber-400 font-bold text-sm w-12 shrink-0">₱1,000</span>
            <span className="flex-1 text-white/85 text-sm sm:text-base">Referral bonus — when someone you invited completes their first paid submission</span>
            <ArrowRight className="w-4 h-4 text-white/40" aria-hidden />
          </li>
          <li className="flex items-center gap-4 py-3">
            <span className="text-white/50 font-bold text-sm w-12 shrink-0">50%</span>
            <span className="flex-1 text-white/65 text-sm sm:text-base">Platform share — AI build cost, hosting, and platform keeps the system running</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
