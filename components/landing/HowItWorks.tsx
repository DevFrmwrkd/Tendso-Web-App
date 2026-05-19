"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Send, Camera, Globe, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import HeroImg from "@/public/Images/hero-image.png";

const steps = [
  {
    num: "01",
    icon: Send,
    title: "Sign up online",
    desc: "Create your free account. Tell us about your shop. No commitment, no consultation needed.",
  },
  {
    num: "02",
    icon: Camera,
    title: "A creator visits you",
    desc: "A trained Negosyo Digital creator comes to your shop. Professional photos. A short interview. That's all.",
  },
  {
    num: "03",
    icon: Globe,
    title: "Live in 24–48 hours",
    desc: "Our AI builds your real coded website — mobile-optimized, hosted, SSL-secured. You only pay ₱1,000 once it's live.",
  },
];

export default function HowItWorks() {
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
      id="how-it-works"
      className="relative w-full py-24 sm:py-32 px-6 overflow-hidden"
      style={{ background: "var(--khaki)" }}
    >
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section marker */}
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
            § 02 — HOW IT WORKS
          </p>
          <span className="h-px w-10 sm:w-16 bg-[var(--rust)]/40" />
        </motion.div>

        {/* Big editorial headline */}
        <motion.h2
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center font-bold leading-[0.95] tracking-[-0.01em] text-[var(--ink)] mb-6 sm:mb-8"
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
          }}
        >
          Three steps. <span className="italic" style={{ color: "var(--rust)" }}>No tech.</span>
        </motion.h2>

        <motion.p
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center italic text-[var(--ink)]/60 max-w-xl mx-auto mb-16 sm:mb-20"
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "clamp(1.1rem, 1.6vw, 1.4rem)",
          }}
        >
          We do the work. You stay focused on your customers.
        </motion.p>

        {/* Image + steps split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-20 items-center mb-16">
          {/* LEFT — Phone image (moved from hero) */}
          <motion.div
            initial={reduceMotion ? {} : { opacity: 0, scale: 0.96 }}
            whileInView={reduceMotion ? {} : { opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md mx-auto lg:max-w-none group"
          >
            {/* Khaki-deep glow halo */}
            <div className="absolute inset-0 -m-8 bg-[var(--khaki-deep)] rounded-full blur-3xl pointer-events-none opacity-60" />
            <div className="absolute inset-0 -m-4 bg-[var(--rust)]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex items-center justify-center">
              <Image
                src={HeroImg}
                alt="Creator submitting an interview through the Negosyo Digital app — the kind of work that builds your website"
                width={800}
                height={1600}
                className="w-full h-auto max-h-[640px] object-contain drop-shadow-[0_40px_80px_rgba(15,14,20,0.25)] transition-transform duration-500 ease-out group-hover:-translate-y-2"
                priority={false}
                sizes="(max-width: 1024px) 90vw, 560px"
              />
            </div>
          </motion.div>

          {/* RIGHT — The three steps */}
          <ol className="space-y-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.li
                  key={step.num}
                  initial={reduceMotion ? {} : { opacity: 0, x: 20 }}
                  whileInView={reduceMotion ? {} : { opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: idx * 0.12 }}
                  className="relative group"
                >
                  <div className="grid grid-cols-[auto_1fr] gap-5 sm:gap-7 py-6 sm:py-7 border-b border-[var(--ink)]/15">
                    {/* Big number — editorial style */}
                    <div className="flex items-start">
                      <span
                        className="text-[var(--rust)]/30 group-hover:text-[var(--rust)]/60 transition-colors leading-none"
                        style={{
                          fontFamily: "var(--font-playfair)",
                          fontSize: "clamp(3rem, 5vw, 4.5rem)",
                          fontWeight: 700,
                        }}
                      >
                        {step.num}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className="w-5 h-5 text-[var(--rust)]" />
                        <h3
                          className="text-2xl sm:text-3xl text-[var(--ink)] tracking-tight font-bold"
                          style={{ fontFamily: "var(--font-playfair)" }}
                        >
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-[15px] sm:text-base text-[var(--ink)]/70 leading-relaxed max-w-md">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>

        {/* Inline CTA after the steps */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-center pt-4"
        >
          <p
            className="text-[var(--ink)]/70 italic"
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "clamp(1.05rem, 1.5vw, 1.25rem)",
            }}
          >
            It begins with a sign-up.
          </p>
          <Link
            href="/signup"
            className="group inline-flex items-center justify-center gap-3 bg-[var(--ink)] hover:bg-[var(--rust)] text-[var(--khaki)] px-7 py-4 rounded-full font-semibold text-base transition-all hover:-translate-y-0.5 shadow-lg shadow-[var(--ink)]/15 min-h-[52px]"
          >
            Get started
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
