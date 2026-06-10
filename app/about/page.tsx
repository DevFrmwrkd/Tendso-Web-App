import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";
import {
  PhoneCall,
  Camera,
  Globe,
  Search,
  Send,
  Sparkles,
  Wallet,
  ArrowRight,
  Phone,
} from "lucide-react";

const PHONE_DISPLAY = "0967 145 5245";
const PHONE_TEL = "tel:+639671455245";

export const metadata = {
  title: "About — Tendso",
  description:
    "Tendso pays Filipinos to digitize local businesses. We use AI to build real coded websites in 48 hours. Local businesses get online for ₱1,000. Creators earn ₱300–₱500 per submission.",
};

const businessSteps = [
  {
    icon: PhoneCall,
    title: "Call or text us",
    desc: "Reach us at 0967 145 5245. Free consultation — no pressure, no commitment.",
  },
  {
    icon: Camera,
    title: "Our creator visits you",
    desc: "A trained Tendso creator comes to your shop, takes photos, and records a short interview.",
  },
  {
    icon: Globe,
    title: "Live in 24–48 hours",
    desc: "AI builds your real coded website on a free subdomain. You pay ₱1,000 only when it's live.",
  },
];

const creatorSteps = [
  {
    icon: Search,
    title: "Find a business",
    desc: "Barber shop, restaurant, salon, auto repair — any local business that needs a website.",
  },
  {
    icon: Send,
    title: "Submit through the app",
    desc: "Collect info, take 3–5 photos, record an audio or video interview. Submit in one tap.",
  },
  {
    icon: Sparkles,
    title: "AI builds the site",
    desc: "AI builds a real coded website in 24–48 hours and enhances the photos automatically.",
  },
  {
    icon: Wallet,
    title: "You get paid",
    desc: "₱300 for audio · ₱500 for video. Direct to your Wise wallet. ₱1,000 referral bonus for inviting other creators.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-amber-500 selection:text-white overflow-x-hidden">
      <Navbar />

      <main className="relative z-10 w-full flex flex-col items-center">
        {/* HERO */}
        <section className="relative w-full pt-28 pb-16 sm:pt-32 sm:pb-20 px-6 overflow-hidden bg-white">
          <div className="absolute -top-32 -right-20 w-[480px] h-[480px] bg-amber-50 rounded-full filter blur-[120px] opacity-80 pointer-events-none" />
          <div className="absolute -bottom-40 -left-32 w-[520px] h-[520px] bg-amber-100/60 rounded-full filter blur-[140px] opacity-70 pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <p className="text-xs uppercase tracking-widest font-bold text-amber-700 mb-4">
              About Tendso
            </p>
            <h1
              style={{ fontFamily: "var(--font-fraunces)" }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-neutral-900 leading-[1.05] mb-6 tracking-tight"
            >
              We pay Filipinos to bring local businesses{" "}
              <span className="italic text-amber-700">online.</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-neutral-700 leading-relaxed">
              Two sides, one platform. Local businesses get a real coded website in 48 hours for ₱1,000.
              Creators earn ₱300–₱500 per submission for finding businesses and capturing their story.
              AI does the building in between.
            </p>
          </div>
        </section>

        {/* WHO WE SERVE — two cards */}
        <section className="w-full py-12 sm:py-16 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            <div className="rounded-3xl bg-amber-50/50 border border-amber-100 p-7 sm:p-8">
              <p className="text-xs uppercase tracking-widest font-bold text-amber-700 mb-3">
                For business owners
              </p>
              <h2
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-3 leading-tight"
              >
                Your business, online in 48 hours.
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-5">
                Real coded website (not Wix or template), mobile-optimized, hosted on a free subdomain.
                One-time ₱1,000. No monthly fees. You only pay when it&apos;s live.
              </p>
              <a
                href={PHONE_TEL}
                className="group inline-flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-5 py-3 rounded-full font-semibold text-sm transition-transform hover:scale-[1.02] min-h-[44px]"
              >
                <Phone className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                Call: {PHONE_DISPLAY}
              </a>
            </div>

            <div className="rounded-3xl bg-neutral-900 text-white p-7 sm:p-8 border border-neutral-800">
              <p className="text-xs uppercase tracking-widest font-bold text-amber-400 mb-3">
                For creators
              </p>
              <h2
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="text-2xl sm:text-3xl font-semibold mb-3 leading-tight"
              >
                Get paid to digitize businesses.
              </h2>
              <p className="text-white/75 leading-relaxed mb-5">
                Students, content creators, anyone with a smartphone and hustle. Earn ₱300–₱500 per submission.
                Direct payouts via Wise. ₱1,000 referral bonus for inviting other creators.
              </p>
              <Link
                href="/creators"
                className="group inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-neutral-900 px-5 py-3 rounded-full font-semibold text-sm transition-transform hover:scale-[1.02] min-h-[44px]"
              >
                Become a creator
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* HOW BUSINESSES GET A WEBSITE */}
        <section className="w-full py-16 sm:py-20 px-6 max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <p className="text-xs uppercase tracking-widest font-bold text-amber-700 mb-3">
              For business owners
            </p>
            <h2
              style={{ fontFamily: "var(--font-fraunces)" }}
              className="text-3xl sm:text-4xl md:text-5xl font-semibold text-neutral-900 leading-[1.1] mb-4"
            >
              How a business gets a <span className="italic text-amber-700">website.</span>
            </h2>
            <p className="text-neutral-700 leading-relaxed">
              Three steps. No tech needed on your end. You stay focused on your customers.
            </p>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {businessSteps.map((step, idx) => {
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
                    className="text-xl sm:text-2xl font-semibold text-neutral-900 mb-2 leading-tight"
                  >
                    {step.title}
                  </h3>
                  <p className="text-neutral-700 text-[15px] leading-relaxed">{step.desc}</p>
                </li>
              );
            })}
          </ol>

          <div className="mt-10 text-center">
            <a
              href={PHONE_TEL}
              className="group inline-flex items-center gap-3 bg-neutral-900 hover:bg-black text-white px-6 py-3.5 rounded-full font-semibold text-base transition-transform hover:scale-[1.02] shadow-md shadow-neutral-900/15 min-h-[48px]"
            >
              <Phone className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
              Call us: {PHONE_DISPLAY}
            </a>
          </div>
        </section>

        {/* HOW CREATORS EARN */}
        <section className="w-full py-16 sm:py-20 px-6 bg-amber-50/50 border-y border-amber-100">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl mx-auto text-center mb-12">
              <p className="text-xs uppercase tracking-widest font-bold text-amber-700 mb-3">
                For creators
              </p>
              <h2
                style={{ fontFamily: "var(--font-fraunces)" }}
                className="text-3xl sm:text-4xl md:text-5xl font-semibold text-neutral-900 leading-[1.1] mb-4"
              >
                How a creator <span className="italic text-amber-700">earns.</span>
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                Four steps to your first payout. No deposits. No courses to buy.
              </p>
            </div>

            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              {creatorSteps.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.title}
                    className="rounded-3xl bg-white border border-neutral-200 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-900/5 transition-all p-6 sm:p-7"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span
                        style={{ fontFamily: "var(--font-fraunces)" }}
                        className="text-3xl font-semibold text-amber-100"
                      >
                        0{idx + 1}
                      </span>
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-amber-700" />
                      </div>
                    </div>
                    <h3
                      style={{ fontFamily: "var(--font-fraunces)" }}
                      className="text-lg sm:text-xl font-semibold text-neutral-900 mb-2 leading-tight"
                    >
                      {step.title}
                    </h3>
                    <p className="text-neutral-700 text-sm leading-relaxed">{step.desc}</p>
                  </li>
                );
              })}
            </ol>

            <div className="mt-10 text-center">
              <Link
                href="/creators"
                className="group inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3.5 rounded-full font-semibold text-base transition-transform hover:scale-[1.02] shadow-md shadow-amber-900/20 min-h-[48px]"
              >
                See full creator details
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* WHAT THE WEBSITE INCLUDES */}
        <section className="w-full py-16 sm:py-20 px-6 max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <p className="text-xs uppercase tracking-widest font-bold text-amber-700 mb-3">
              What ₱1,000 gets you
            </p>
            <h2
              style={{ fontFamily: "var(--font-fraunces)" }}
              className="text-3xl sm:text-4xl md:text-5xl font-semibold text-neutral-900 leading-[1.1] mb-4"
            >
              A real website. <span className="italic text-amber-700">Not a template.</span>
            </h2>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 max-w-5xl mx-auto">
            {[
              "Real coded website (not Wix or template)",
              "Mobile-responsive — works on every device",
              "Professional design tailored to your business",
              "Free subdomain: yourbusiness.negosyodigital.ph",
              "AI-enhanced photos from your phone shots",
              "Hosted with SSL · Fast loading",
              "Free edits within 7 days of launch",
              "Live in 24–48 hours",
              "One-time ₱1,000 — no monthly fees",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 p-5 rounded-2xl bg-white border border-neutral-200"
              >
                <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center" aria-hidden>
                  <svg className="w-3 h-3 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-neutral-800 text-[15px] leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FINAL CTA */}
        <section className="w-full py-20 sm:py-24 px-6 relative overflow-hidden flex items-center justify-center bg-white">
          <div className="absolute inset-x-4 sm:inset-x-8 lg:inset-x-12 inset-y-4 sm:inset-y-6 bg-neutral-900 rounded-[2rem] sm:rounded-[3rem] z-0" />
          <div
            className="absolute inset-x-4 sm:inset-x-8 lg:inset-x-12 inset-y-4 sm:inset-y-6 rounded-[2rem] sm:rounded-[3rem] opacity-[0.18] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at center, #F5E4C0 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="absolute -top-20 -right-20 w-[420px] h-[420px] bg-amber-500/30 rounded-full filter blur-[140px] opacity-50 pointer-events-none" />

          <div className="relative z-10 text-center text-white max-w-3xl mx-auto py-10 sm:py-14 px-2">
            <p className="text-xs uppercase tracking-widest font-bold text-amber-400 mb-4">
              Two ways in
            </p>
            <h2
              style={{ fontFamily: "var(--font-fraunces)" }}
              className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-[1.1] mb-8"
            >
              Pick your side.
            </h2>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <a
                href={PHONE_TEL}
                className="group flex items-center justify-center gap-3 bg-amber-500 hover:bg-amber-400 text-neutral-900 px-7 py-4 rounded-full font-bold text-base sm:text-lg transition-transform hover:scale-[1.02] shadow-xl shadow-amber-500/30 min-h-[52px]"
              >
                <Phone className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                I have a business
              </a>
              <Link
                href="/creators"
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white px-7 py-4 rounded-full font-semibold text-base transition-colors border border-white/20 min-h-[52px]"
              >
                I want to be a creator
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
