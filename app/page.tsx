import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";

import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import EarningsSection from "@/components/landing/EarningsSection";
import ShowcaseSection from "@/components/landing/ShowcaseSection";
import BusinessPricingSection from "@/components/landing/BusinessPricingSection";
import CtaSection from "@/components/landing/CtaSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-emerald-500 selection:text-white overflow-x-hidden">
      <Navbar />

      <main className="relative z-10 w-full flex flex-col items-center">
        {/* Creator-led: side-hustle pitch comes first */}
        <HeroSection />
        <HowItWorks />
        <EarningsSection />
        <ShowcaseSection />

        {/* Business owner sub-section: anchored at #for-business */}
        <BusinessPricingSection />

        <CtaSection />
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
