"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Search, Send, Sparkles, BadgeCheck, Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";

const steps = [
  {
    num: "01",
    icon: Search,
    title: "Find a local shop",
    desc: "Walk into any barber shop, restaurant, salon, or auto repair near you. Show them the ₱1,000 website offer — that's the pitch.",
  },
  {
    num: "02",
    icon: Send,
    title: "Record one interview",
    desc: "Open the app. Snap 3 photos. Record a short audio or video interview with the owner. Submit in one tap.",
  },
  {
    num: "03",
    icon: Sparkles,
    title: "Our AI builds the site",
    desc: "We take it from there. AI writes the copy, enhances the photos, and ships a real coded website in 24–48 hours.",
  },
  {
    num: "04",
    icon: BadgeCheck,
    title: "Owner reviews & pays",
    desc: "The business owner opens their live site, approves it, and pays ₱1,000. No charge until they say yes.",
  },
  {
    num: "05",
    icon: Wallet,
    title: "You get paid",
    desc: "₱300 for audio · ₱500 for video. Direct to your Wise wallet, usually within 24 hours of approval.",
  },
];

export default function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="how-it-works"
      className="relative w-full py-20 sm:py-24 px-6 max-w-7xl mx-auto z-10"
    >
      <div className="max-w-2xl mx-auto text-center mb-14 sm:mb-16">
        <p className="text-xs uppercase tracking-widest font-bold text-emerald-700 mb-3">
          How earning works
        </p>
        <h2
          style={{ fontFamily: "var(--font-fraunces)" }}
          className="text-4xl sm:text-5xl md:text-6xl font-semibold text-neutral-900 leading-[1.05] mb-5"
        >
          From hustle to <span className="italic text-emerald-700">payout.</span>
        </h2>
        <p className="text-base sm:text-lg text-neutral-700 leading-relaxed">
          Five steps. No deposits. No selling courses. Real money to your Wise wallet.
        </p>
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 lg:gap-4">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <motion.li
              key={step.num}
              initial={reduceMotion ? {} : { opacity: 0, y: 24 }}
              whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="relative flex flex-col rounded-3xl bg-white border border-neutral-200 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-900/5 transition-all p-6 sm:p-7"
            >
              <div className="flex items-center justify-between mb-5">
                <span
                  style={{ fontFamily: "var(--font-fraunces)" }}
                  className="text-4xl font-semibold text-emerald-100 leading-none"
                >
                  {step.num}
                </span>
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-emerald-700" />
                </div>
              </div>

              <h3
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="text-xl sm:text-2xl font-semibold text-neutral-900 mb-3 leading-tight"
              >
                {step.title}
              </h3>
              <p className="text-neutral-700 text-sm leading-relaxed">
                {step.desc}
              </p>
            </motion.li>
          );
        })}
      </ol>

      {/* Inline creator CTA after the flow */}
      <div className="mt-12 sm:mt-14 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
        <p className="text-neutral-700 text-base sm:text-lg">
          No experience needed. Start your first interview today.
        </p>
        <Link
          href="/signup"
          className="group inline-flex items-center justify-center gap-2 bg-neutral-900 hover:bg-black text-white px-6 py-3.5 rounded-full font-semibold text-base transition-transform hover:scale-[1.02] shadow-md shadow-neutral-900/15 min-h-[48px]"
        >
          Become a creator
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </section>
  );
}
