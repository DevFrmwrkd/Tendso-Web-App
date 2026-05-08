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
    <div className={`min-h-screen bg-black text-white selection:bg-[#00FF66] selection:text-black overflow-x-hidden ${outfit.className}`} ref={containerRef}>
      <Navbar />

      {/* BACKGROUND NOISE / BLOBS */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      <div className="fixed -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[#1D00FF] rounded-full mix-blend-screen filter blur-[200px] opacity-30 animate-pulse" />
      <div className="fixed top-[20%] -right-[10%] w-[40%] h-[60%] bg-[#8B00FF] rounded-full mix-blend-screen filter blur-[200px] opacity-20" />

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
