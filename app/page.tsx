"use client";

import { useState } from "react";

import { LanguageProvider } from "@/components/landing/i18n";
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
        <LanguageProvider>
        <div className="neo min-h-screen overflow-x-hidden">
            <Navbar />

            <main>
                {/* Hero with counters + two doors */}
                <HeroSection />

                {/* Live map (Convex listPublished → falls back to 4 known sites) */}
                <ShowcaseSection
                    onSelectCreator={setSelectedCreator}
                    onSelectBusiness={setSelectedBusiness}
                />

                {/* How it works (two tracks side-by-side) */}
                <HowItWorks />

                {/* Process — Online Kit pipeline */}
                <ProcessSection />

                {/* Manifesto — the 99% statement */}
                <ManifestoSection />

                {/* Directory (rails of creators + businesses) */}
                <DirectorySection
                    onSelectCreator={setSelectedCreator}
                    onSelectBusiness={setSelectedBusiness}
                />

                {/* FAQ */}
                <FaqSection />

                {/* Final CTA (the two doors, big) */}
                <CtaSection />
            </main>

            <Footer />

            <StickyCTA />
            <ChatBot />
            <CreatorSheet creator={selectedCreator} onClose={() => setSelectedCreator(null)} />
            <BusinessSheet business={selectedBusiness} onClose={() => setSelectedBusiness(null)} />
            <ScrollToTop />
        </div>
        </LanguageProvider>
    );
}
