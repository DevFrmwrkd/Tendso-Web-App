"use client";

import { useState } from "react";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";

import HeroSection from "@/components/landing/HeroSection";
import ShowcaseSection from "@/components/landing/ShowcaseSection";
import HowItWorks from "@/components/landing/HowItWorks";
import ProcessSection from "@/components/landing/ProcessSection";
import ManifestoSection from "@/components/landing/ManifestoSection";
import BusinessPricingSection from "@/components/landing/BusinessPricingSection";
import EarningsSection from "@/components/landing/EarningsSection";
import DirectorySection from "@/components/landing/DirectorySection";
import FaqSection from "@/components/landing/FaqSection";
import CtaSection from "@/components/landing/CtaSection";

import StickyCTA from "@/components/landing/StickyCTA";
import ChatBot from "@/components/landing/ChatBot";
import CreatorSheet from "@/components/landing/CreatorSheet";
import BusinessSheet from "@/components/landing/BusinessSheet";

import type { Creator, LiveBusiness } from "@/components/landing/landingData";

export default function Home() {
    const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
    const [selectedBusiness, setSelectedBusiness] = useState<LiveBusiness | null>(null);

    return (
        <div className="neo min-h-screen overflow-x-hidden">
            <Navbar />

            <main>
                {/* § 01 — Hero with counters + two doors */}
                <HeroSection />

                {/* § 02 — Live map (Convex listPublished → falls back to 4 known sites) */}
                <ShowcaseSection
                    onSelectCreator={setSelectedCreator}
                    onSelectBusiness={setSelectedBusiness}
                />

                {/* § 03 — How it works (two tracks side-by-side) */}
                <HowItWorks />

                {/* § Process — Online Kit pipeline */}
                <ProcessSection />

                {/* § 04 — Pricing (₱1,000 / ₱1,500) */}
                <BusinessPricingSection />

                {/* § 05 — For creators (dark slab — ₱500 / ₱300 / ₱1,000) */}
                <EarningsSection />

                {/* § Manifesto — the 99% statement */}
                <ManifestoSection />

                {/* § 06 — Directory (rails of creators + businesses) */}
                <DirectorySection
                    onSelectCreator={setSelectedCreator}
                    onSelectBusiness={setSelectedBusiness}
                />

                {/* § 08 — FAQ */}
                <FaqSection />

                {/* § 10 — Final CTA (the two doors, big) */}
                <CtaSection />
            </main>

            <Footer />

            <StickyCTA />
            <ChatBot />
            <CreatorSheet creator={selectedCreator} onClose={() => setSelectedCreator(null)} />
            <BusinessSheet business={selectedBusiness} onClose={() => setSelectedBusiness(null)} />
            <ScrollToTop />
        </div>
    );
}
