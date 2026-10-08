import BusinessPricingSection from "@/components/landing/BusinessPricingSection";
import ChatBot from "@/components/landing/ChatBot";
import CtaSection from "@/components/landing/CtaSection";
import FaqSection from "@/components/landing/FaqSection";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import { LanguageProvider } from "@/components/landing/i18n";
import { loadFeaturedSites } from "@/components/landing/loadFeaturedSites";
import RealSitesSection from "@/components/landing/RealSitesSection";
import { PublicFooter, PublicHeader, PublicPage } from "@/components/r1";

/**
 * Tendso landing (/), in the Round 1 look (board: Landing). White ground,
 * Instrument Serif titles, Onest for everything else, all from the shared
 * Round 1 tokens and components.
 *
 * OWNER-FIRST. The paying customer is the business owner, so every primary
 * action is "Get a website" into /start, and creators keep a secondary path
 * (the hero line, the closing line, the header link and the footer) to
 * /for-creators, where their pitch lives.
 *
 * THE ORDER IS THE BOARD'S: hero → real sites (#sites) → how it works (#how)
 * → price (#price) → questions (#faq) → closing band → footer. The shared
 * header links to those three anchors from every public page.
 *
 * DATA-TRUE, as before: no invented counters, creators or testimonials. The
 * only live data is the curated list of real client sites, read here on the
 * server as well, so its links are in the HTML search engines crawl (the
 * hosted sites have no other link from tendso.com).
 *
 * PRERENDERED, refreshed every five minutes, so a curated change reaches the
 * HTML within about ten minutes (this plus loadFeaturedSites' own cache).
 * Visitors see it at once: the live query replaces the list after load.
 *
 * BILINGUAL (EN/TL), through LanguageProvider and the header's EN/TL switch.
 * Copy lives in components/landing/strings/landing.ts.
 *
 * What the old page had and this one does not, on purpose: the sticky CTA pill
 * (it overlapped the price button; the header CTA stays), the scroll-to-top
 * button and the scroll-reveal animation (not needed on a page this short),
 * the manifesto band (not in the design). The metadata for "/" is the root
 * layout's.
 */
export const revalidate = 300;

export default async function Home() {
    const featuredSites = await loadFeaturedSites();
    // pb-24: room under the footer's last line for the chat button, which stays
    // pinned to the bottom-right corner and would otherwise cover it.
    const footer = <PublicFooter variant="full" className="pb-24" />;
    return (
        <LanguageProvider>
            <PublicPage header={<PublicHeader showLang />} footer={footer}>
                <HeroSection />
                <RealSitesSection initialSites={featuredSites} />
                <HowItWorks />
                <BusinessPricingSection />
                <FaqSection />
                <CtaSection />
            </PublicPage>
            <ChatBot />
        </LanguageProvider>
    );
}
