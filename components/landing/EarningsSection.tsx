"use client";

import { motion } from "framer-motion";
import { Video, Mic, Gift, ArrowRight } from "lucide-react";
import { Bricolage_Grotesque } from 'next/font/google';
import Link from "next/link";

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '600', '800'] });

const earningRates = [
  {
    icon: Video,
    title: "Video Interview",
    amount: "PHP 500",
    desc: "Earn directly to your wallet for a successful video interview and 3 location photos.",
    featured: false,
  },
  {
    icon: Mic,
    title: "Audio Only",
    amount: "PHP 300",
    desc: "Perfect for camera-shy owners. Record high-quality audio plus 3 photos to earn.",
    featured: false,
  },
  {
    icon: Gift,
    title: "Referral Bonus",
    amount: "PHP 1,000",
    desc: "Invite another creator. When they complete their first paid submission, you get a massive bonus.",
    featured: true,
  }
];

export default function EarningsSection() {
  return (
    <section
      id="earnings"
      className="w-full py-24 md:py-32 px-6 max-w-7xl mx-auto relative z-10 border-t border-neutral-100"
    >
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-100 rounded-full filter blur-[200px] opacity-50 pointer-events-none" />

      <div className="text-center mb-16 md:mb-24 relative z-10">
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           whileInView={{ opacity: 1, scale: 1 }}
           viewport={{ once: true }}
           className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-emerald-200 bg-emerald-50 mb-8"
        >
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <span className={`text-emerald-700 text-sm uppercase tracking-widest font-black ${bricolage.className}`}>Uncapped Income</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`text-5xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter text-neutral-900 ${bricolage.className}`}
        >
          Simple <span className="text-emerald-600">Economics.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-neutral-700 text-lg md:text-2xl mt-6 max-w-2xl mx-auto font-light"
        >
          No complex points systems. No hidden fees. Earn real cash directly via Wise for every MSME you digitize.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative z-10">
        {earningRates.map((rate, idx) => {
          const Icon = rate.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15, duration: 0.6 }}
              className={`flex flex-col h-full rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden group transition-shadow ${
                rate.featured
                  ? "bg-neutral-900 text-white border-2 border-emerald-500 shadow-xl shadow-emerald-500/20"
                  : "bg-white border border-neutral-200 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/10"
              }`}
            >
              <div className={`absolute top-0 right-0 p-8 opacity-10 group-hover:scale-150 transition-transform duration-700 pointer-events-none ${rate.featured ? "text-emerald-400" : "text-emerald-600"}`}>
                <Icon className="w-20 h-20" />
              </div>

              <div className={`mb-6 p-5 rounded-2xl w-max border ${
                rate.featured
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-emerald-50 border-emerald-200"
              }`}>
                <Icon className={`w-10 h-10 ${rate.featured ? "text-emerald-400" : "text-emerald-600"}`} />
              </div>

              <div className="mt-auto pt-10">
                <h3 className={`text-2xl font-bold uppercase tracking-wide mb-2 ${
                  rate.featured ? "text-white/80" : "text-neutral-700"
                } ${bricolage.className}`}>
                  {rate.title}
                </h3>
                <div className={`text-5xl md:text-6xl font-black tracking-tighter mb-6 ${
                  rate.featured ? "text-white" : "text-neutral-900"
                } ${bricolage.className}`}>
                  {rate.amount}
                </div>
                <p className={`text-base md:text-lg font-light leading-relaxed mb-10 ${
                  rate.featured ? "text-white/70" : "text-neutral-600"
                }`}>
                  {rate.desc}
                </p>

                <Link href="/login" className="mt-auto">
                  <button className={`w-full py-4 md:py-5 rounded-full font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all hover:gap-5 ${
                    rate.featured
                      ? "bg-emerald-500 text-white hover:bg-emerald-400"
                      : "bg-neutral-900 text-white hover:bg-emerald-600"
                  } ${bricolage.className}`}>
                    Start Earning <ArrowRight className="w-5 h-5" />
                  </button>
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
