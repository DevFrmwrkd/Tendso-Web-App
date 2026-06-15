import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";
import EarningsSection from "@/components/landing/EarningsSection";
import CreatorEarningFlow from "@/components/landing/CreatorEarningFlow";
import { Camera, Sparkles, Users, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Earn as a Creator — Tendso",
  description: "Get paid to digitize local Filipino businesses. ₱500 per submission (50% of every sale), plus ₱1,000 referral bonus. Direct payouts via Wise.",
};

const flow = [
  {
    icon: Camera,
    title: "Find a business",
    desc: "Barber shop, restaurant, salon, auto repair — any local business that needs a website.",
  },
  {
    icon: Sparkles,
    title: "Pitch ₱999 service",
    desc: "Collect business info, take photos, record a short audio or video interview using the app.",
  },
  {
    icon: Users,
    title: "Submit & get paid",
    desc: "Submit through the app. Once the client pays, your earnings land in your Wise account.",
  },
];

export default function CreatorsPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-amber-500 selection:text-white overflow-x-hidden">
      <Navbar />

      <main className="relative z-10 w-full flex flex-col items-center">
        {/* HERO */}
        <section className="relative w-full pt-28 pb-16 sm:pt-32 sm:pb-20 px-6 overflow-hidden bg-white">
          <div className="absolute -top-32 -right-20 w-[480px] h-[480px] bg-amber-50 rounded-full filter blur-[120px] opacity-80 pointer-events-none" />
          <div className="absolute -bottom-40 -left-32 w-[520px] h-[520px] bg-amber-100/60 rounded-full filter blur-[140px] opacity-70 pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <p className="text-xs uppercase tracking-widest font-bold text-amber-700 mb-4">
              For students, side-hustlers, content creators
            </p>
            <h1
              style={{ fontFamily: "var(--font-fraunces)" }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-neutral-900 leading-[1.05] mb-6 tracking-tight"
            >
              Help owners whose hands are{" "}
              <span className="italic text-amber-700">full.</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-neutral-700 max-w-2xl mx-auto mb-9 leading-relaxed">
              Visit a shop where someone is already working. Photograph the work. Ask a few questions. Submit through the Tendso app. Earn <span className="font-semibold text-neutral-900">₱500 per submission (50% of every sale)</span> — straight to your Wise account.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-black text-white px-7 py-4 rounded-full font-semibold text-base transition-transform hover:scale-[1.02] shadow-lg shadow-neutral-900/15 min-h-[52px]"
              >
                Start as a creator
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/"
                className="flex items-center justify-center gap-2 bg-white border border-neutral-200 hover:border-amber-300 text-neutral-900 px-7 py-4 rounded-full font-semibold text-base transition-colors min-h-[52px]"
              >
                I&apos;m a business owner
              </Link>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS (creator flow) */}
        <section className="w-full py-16 sm:py-20 px-6 max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <p className="text-xs uppercase tracking-widest font-bold text-amber-700 mb-3">
              How it works for creators
            </p>
            <h2
              style={{ fontFamily: "var(--font-fraunces)" }}
              className="text-3xl sm:text-4xl md:text-5xl font-semibold text-neutral-900 leading-[1.1] mb-4"
            >
              Three steps. <span className="italic text-amber-700">Real income.</span>
            </h2>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {flow.map((step, idx) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="rounded-3xl bg-white border border-neutral-200 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-900/5 transition-all p-7"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span
                      style={{ fontFamily: "var(--font-fraunces)" }}
                      className="text-4xl font-semibold text-amber-100"
                    >
                      0{idx + 1}
                    </span>
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-amber-700" />
                    </div>
                  </div>
                  <h3
                    style={{ fontFamily: "var(--font-fraunces)" }}
                    className="text-xl sm:text-2xl font-semibold text-neutral-900 mb-2"
                  >
                    {step.title}
                  </h3>
                  <p className="text-neutral-700 text-[15px] leading-relaxed">{step.desc}</p>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Earnings (preserved verbatim from prior design, re-skinned via its own component) */}
        <EarningsSection />

        {/* Full creator earning flow with money split */}
        <CreatorEarningFlow />
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
