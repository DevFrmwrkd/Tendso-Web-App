"use client";

import { motion } from "framer-motion";
import { Camera, Banknote, Sparkles, Users } from "lucide-react";
import { Bricolage_Grotesque } from 'next/font/google';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '600', '800'] });

const features = [
  {
    icon: Camera,
    title: "Capture The Story",
    desc: "Simply visit a local MSME, take a few photos, and record a short audio/video interview using your device. No coding required."
  },
  {
    icon: Sparkles,
    title: "AI-Powered Generation",
    desc: "Our platform uses advanced AI to transcribe your interview and automatically build a fully deployed, highly optimized website."
  },
  {
    icon: Banknote,
    title: "Earn Real Income",
    desc: "Get paid up to PHP 1,000 for every successfully deployed business website. Direct withdrawals to your local bank account via Wise."
  },
  {
    icon: Users,
    title: "Referral Ecosystem",
    desc: "Multiply your earnings by inviting other creators. When they succeed, you receive massive bonuses straight to your wallet."
  }
];

export default function FeaturesSection() {
  return (
    <section id="features" className="w-full py-24 md:py-32 px-6 max-w-7xl mx-auto relative z-10">
      <div className="mb-16 md:mb-20">
        <motion.h2
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className={`text-4xl sm:text-5xl md:text-7xl font-black uppercase tracking-tighter text-neutral-900 ${bricolage.className}`}
        >
          The Creator <span className="text-emerald-600">Ecosystem.</span>
        </motion.h2>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: "100px" }}
          viewport={{ once: true }}
          className="h-2 bg-emerald-500 mt-6 rounded-full"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {features.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: idx * 0.1, duration: 0.6 }}
              className="group p-8 md:p-10 rounded-[2rem] bg-white border border-neutral-200 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/10 transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/60 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
              <div className="relative mb-8 p-4 bg-emerald-50 rounded-2xl inline-block border border-emerald-200">
                <Icon className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className={`relative text-2xl md:text-3xl font-bold mb-4 text-neutral-900 ${bricolage.className}`}>{item.title}</h3>
              <p className="relative text-neutral-700 text-base md:text-lg font-light leading-relaxed">{item.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
