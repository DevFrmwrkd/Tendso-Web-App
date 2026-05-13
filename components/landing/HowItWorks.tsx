"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PhoneCall, Camera, Globe, Phone } from "lucide-react";

const PHONE_DISPLAY = "0967 145 5245";
const PHONE_TEL = "tel:+639671455245";

const steps = [
  {
    num: "01",
    icon: PhoneCall,
    title: "Call or text us",
    desc: "Reach us at 0967 145 5245. We schedule a free 15-minute consultation — no pressure, no commitment.",
  },
  {
    num: "02",
    icon: Camera,
    title: "Our creator visits you",
    desc: "A trained Negosyo Digital creator comes to your shop, takes professional photos, and records a short interview with you.",
  },
  {
    num: "03",
    icon: Globe,
    title: "Live in 24–48 hours",
    desc: "Our AI builds your real coded website — mobile-optimized, hosted on a free subdomain. You only pay ₱1,000 once it's live.",
  },
];

export default function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="how-it-works"
      className="w-full py-20 sm:py-24 px-6 max-w-7xl mx-auto relative z-10"
    >
      <div className="max-w-2xl mx-auto text-center mb-14 sm:mb-16">
        <p className="text-xs uppercase tracking-widest font-bold text-emerald-700 mb-3">
          How it works
        </p>
        <h2
          style={{ fontFamily: "var(--font-fraunces)" }}
          className="text-4xl sm:text-5xl md:text-6xl font-semibold text-neutral-900 leading-[1.05] mb-5"
        >
          Three steps. <span className="italic text-emerald-700">No tech needed.</span>
        </h2>
        <p className="text-base sm:text-lg text-neutral-700 leading-relaxed">
          We do the work. You stay focused on your customers.
        </p>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <motion.li
              key={step.num}
              initial={reduceMotion ? {} : { opacity: 0, y: 24 }}
              whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="relative flex flex-col rounded-3xl bg-white border border-neutral-200 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-900/5 transition-all p-7 sm:p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <span
                  style={{ fontFamily: "var(--font-fraunces)" }}
                  className="text-5xl font-semibold text-emerald-100 leading-none"
                >
                  {step.num}
                </span>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-emerald-700" />
                </div>
              </div>

              <h3
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="text-2xl sm:text-[1.65rem] font-semibold text-neutral-900 mb-3 leading-tight"
              >
                {step.title}
              </h3>
              <p className="text-neutral-700 text-[15px] sm:text-base leading-relaxed">
                {step.desc}
              </p>
            </motion.li>
          );
        })}
      </ol>

      {/* Inline phone CTA after the steps */}
      <div className="mt-12 sm:mt-14 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
        <p className="text-neutral-700 text-base sm:text-lg">
          Ready to start? It begins with a call.
        </p>
        <a
          href={PHONE_TEL}
          className="group inline-flex items-center justify-center gap-3 bg-neutral-900 hover:bg-black text-white px-6 py-3.5 rounded-full font-semibold text-base transition-transform hover:scale-[1.02] shadow-md shadow-neutral-900/15 min-h-[48px]"
          aria-label={`Call us at ${PHONE_DISPLAY}`}
        >
          <Phone className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform" />
          Call {PHONE_DISPLAY}
        </a>
      </div>
    </section>
  );
}
