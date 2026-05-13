"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Video, Mic, Gift, ArrowRight } from "lucide-react";
import Link from "next/link";

const earningRates = [
  {
    icon: Video,
    title: "Video Interview",
    amount: "₱500",
    desc: "Earn directly to your Wise wallet for a successful video interview and 3 location photos.",
    featured: false,
  },
  {
    icon: Mic,
    title: "Audio Only",
    amount: "₱300",
    desc: "Perfect for camera-shy owners. Record high-quality audio plus 3 photos to earn.",
    featured: false,
  },
  {
    icon: Gift,
    title: "Referral Bonus",
    amount: "₱1,000",
    desc: "Invite another creator. When they complete their first paid submission, you get a massive bonus.",
    featured: true,
  },
];

export default function EarningsSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="earnings"
      className="w-full py-20 sm:py-24 px-6 max-w-7xl mx-auto relative z-10"
    >
      <div className="text-center max-w-2xl mx-auto mb-14">
        <p className="text-xs uppercase tracking-widest font-bold text-emerald-700 mb-3">
          Uncapped income
        </p>
        <h2
          style={{ fontFamily: "var(--font-fraunces)" }}
          className="text-4xl sm:text-5xl md:text-6xl font-semibold text-neutral-900 leading-[1.05] mb-5"
        >
          Simple <span className="italic text-emerald-700">economics.</span>
        </h2>
        <p className="text-base sm:text-lg text-neutral-700 leading-relaxed">
          No complex points systems. No hidden fees. Earn real cash directly via Wise for every business you digitize.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {earningRates.map((rate, idx) => {
          const Icon = rate.icon;
          return (
            <motion.div
              key={rate.title}
              initial={reduceMotion ? {} : { opacity: 0, y: 24 }}
              whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`flex flex-col h-full rounded-3xl p-7 sm:p-8 relative overflow-hidden transition-shadow ${
                rate.featured
                  ? "bg-neutral-900 text-white border-2 border-emerald-500 shadow-xl shadow-emerald-900/20"
                  : "bg-white border border-neutral-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-900/5"
              }`}
            >
              <div
                className={`mb-6 p-4 rounded-2xl w-max border ${
                  rate.featured
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-emerald-50 border-emerald-200"
                }`}
              >
                <Icon className={`w-7 h-7 ${rate.featured ? "text-emerald-400" : "text-emerald-700"}`} />
              </div>

              <h3
                style={{ fontFamily: "var(--font-fraunces)" }}
                className={`text-xl sm:text-2xl font-semibold mb-2 ${
                  rate.featured ? "text-white" : "text-neutral-900"
                }`}
              >
                {rate.title}
              </h3>
              <div
                style={{ fontFamily: "var(--font-fraunces)" }}
                className={`text-5xl sm:text-6xl font-bold tracking-tight mb-5 ${
                  rate.featured ? "text-white" : "text-neutral-900"
                }`}
              >
                {rate.amount}
              </div>
              <p className={`text-[15px] leading-relaxed mb-8 ${rate.featured ? "text-white/75" : "text-neutral-600"}`}>
                {rate.desc}
              </p>

              <Link href="/login" className="mt-auto">
                <button
                  className={`w-full py-4 rounded-full font-semibold text-base flex items-center justify-center gap-3 transition-all hover:gap-4 min-h-[52px] ${
                    rate.featured
                      ? "bg-emerald-500 text-white hover:bg-emerald-400"
                      : "bg-neutral-900 text-white hover:bg-emerald-700"
                  }`}
                >
                  Start Earning <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
