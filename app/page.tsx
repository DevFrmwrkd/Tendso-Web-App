import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";

import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import ShowcaseSection from "@/components/landing/ShowcaseSection";
import BusinessPricingSection from "@/components/landing/BusinessPricingSection";
import EarningsSection from "@/components/landing/EarningsSection";
import CtaSection from "@/components/landing/CtaSection";

export default function Home() {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        background: "var(--khaki)",
        color: "var(--ink)",
      }}
    >
      <Navbar />

      <main className="relative z-10 w-full flex flex-col items-center">
        {/* § 01 — THE VISION (hero) — business-owner-led NEO LAB editorial */}
        <HeroSection />

        {/* § 02 — HOW IT WORKS (3 steps + phone image relocated here) */}
        <HowItWorks />

        {/* § 03 — REAL WORK (live sites carousel) */}
        <ShowcaseSection />

        {/* § 04 — THE PRICE (₱1,000 / ₱1,500 pricing) */}
        <BusinessPricingSection />

        {/* § 05 — FOR CREATORS (dark navy break — secondary audience) */}
        <EarningsSection />

        {/* § 10 — THE VISION (closing) */}
        <CtaSection />
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
