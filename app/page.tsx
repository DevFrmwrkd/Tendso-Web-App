"use client";

import { useRef } from "react";
import { Outfit } from 'next/font/google';

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";

import HeroSection from "@/components/landing/HeroSection";
import MarqueeSection from "@/components/landing/MarqueeSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import BusinessPricingSection from "@/components/landing/BusinessPricingSection";
import ShowcaseSection from "@/components/landing/ShowcaseSection";
import EarningsSection from "@/components/landing/EarningsSection";
import CtaSection from "@/components/landing/CtaSection";

const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '600'] });

export default function Home() {
  const containerRef = useRef(null);

  return (
    <div
      className={`min-h-screen bg-white text-neutral-900 selection:bg-emerald-500 selection:text-white overflow-x-hidden ${outfit.className}`}
      ref={containerRef}
    >
      <Navbar />

      <main className="relative z-10 w-full flex flex-col items-center">
        <HeroSection />
        <MarqueeSection />
        <FeaturesSection />
        <BusinessPricingSection />
        <ShowcaseSection />
        <EarningsSection />
        <CtaSection />
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
