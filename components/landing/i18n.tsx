"use client";

/**
 * Lightweight EN/Tagalog localization for the public landing page.
 *
 * The landing is static marketing (no per-request data), so a full i18n library
 * is overkill. This is a React context + a `useT()` hook returning `t(key)`.
 * The chosen language persists in localStorage and is read on mount.
 *
 * Adding copy: add the key to BOTH `en` and `tl` below, then call `t("key")`
 * in the component. A missing `tl` value falls back to `en`, so partial
 * translation never shows a blank — it shows English until the Tagalog lands.
 *
 * Tagalog copy here is natural Taglish (how the audience actually speaks);
 * brand terms (Tendso, ₱, Wise, Gemini) stay verbatim. Have a native speaker
 * review before treating it as final marketing copy.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "tl";

type Dict = Record<string, string>;

const EN: Dict = {
    // Navbar
    "nav.live": "Live in Philippines · expanding",
    "nav.getApp": "Get the app",

    // Hero
    "hero.issue": "Issue No. 01",
    "hero.h1a": "Some hands",
    "hero.h1b": "don't get to ",
    "hero.h1c": "sit still",
    "hero.em": "The Thinking Ends Here. So the work doesn't.",
    "hero.lede":
        "Your hands are full of customers, orders, tools, dough, kids. The internet asks you to stop and design. We built around that — a creator visits, asks a few questions, photographs the work, and your page forms around it. Live in 48 hours. No template. No design tab. No blank page.",
    "hero.tag1": "Photo. Answers. Live page.",
    "hero.tag2": "No template",
    "hero.tag3": "No blank screen",
    "hero.tag4": "Built around the work",
    "hero.tag5": "Live in 48 hours",
    "hero.pickDoor": "Pick a door",
    "hero.doorBusiness": "I own a business",
    "hero.doorBusinessSub": "Page built around my work",
    "hero.doorBusinessNote":
        "Keep cutting, kneading, packing, answering. A creator handles the rest and shows up at your shop within 10 km.",
    "hero.doorCreator": "I want to earn",
    "hero.doorCreatorSub": "Become a certified creator",
    // NOTE: this replaces the stale "₱500 video / ₱300 audio" line with the 50% model.
    "hero.doorCreatorNote":
        "Help owners who can't stop working. Keep 50% of every site you sell — from ₱500 up to ₱2,500, plus ₱1,000 per referral. Paid in 48 hours.",
    "hero.scroll": "Or scroll — find creators near you on the map below.",
    "hero.counterCreators": "creators",
    "hero.counterBusinesses": "live sites",
    "hero.counterCities": "cities",
    "hero.counterCountries": "countries",

    // Business pricing
    "price.eyebrow": "§ 04 — The price",
    "price.liveForever": "Live forever.",
    "price.lede":
        "One-time payment. No monthly fees. No contracts. You only pay once your website is live and you've approved it.",
    "price.oneTime": "One-time · pay only when live",
    "price.footnote":
        "No card on file. No fine print. No charges later. ◆ International pricing matches PH until local launch.",

    // CTA
    "cta.title": "Your work deserves a page.",
    "cta.subtitle": "Live in 48 hours. Pay only when you're happy with it.",
    "cta.business": "I own a business",
    "cta.creator": "I want to earn as a creator",

    // FAQ
    "faq.title": "Questions, answered.",
};

const TL: Dict = {
    // Navbar
    "nav.live": "Live sa Pilipinas · palawak pa",
    "nav.getApp": "Kunin ang app",

    // Hero
    "hero.issue": "Isyu Blg. 01",
    "hero.h1a": "May mga kamay",
    "hero.h1b": "na hindi ",
    "hero.h1c": "mapakali",
    "hero.em": "Dito nagtatapos ang isip. Para hindi matigil ang trabaho.",
    "hero.lede":
        "Puno ang kamay mo ng customer, order, gamit, masa, anak. Ang internet, gusto kang patigilin para mag-design. Doon kami umangkop — may creator na bibisita, magtatanong, kukuha ng litrato ng trabaho mo, at bubuo ng page paligid niyan. Live sa loob ng 48 oras. Walang template. Walang design tab. Walang blangkong page.",
    "hero.tag1": "Litrato. Sagot. Live na page.",
    "hero.tag2": "Walang template",
    "hero.tag3": "Walang blangkong screen",
    "hero.tag4": "Binuo sa trabaho mo",
    "hero.tag5": "Live sa 48 oras",
    "hero.pickDoor": "Pumili ng pinto",
    "hero.doorBusiness": "May negosyo ako",
    "hero.doorBusinessSub": "Page na binuo sa trabaho ko",
    "hero.doorBusinessNote":
        "Ituloy mo lang ang paggupit, pagmasa, pag-empake, pagsagot. Ang creator ang bahala sa iba at pupunta sa tindahan mo sa loob ng 10 km.",
    "hero.doorCreator": "Gusto kong kumita",
    "hero.doorCreatorSub": "Maging certified creator",
    "hero.doorCreatorNote":
        "Tulungan ang mga may-ari na hindi makatigil sa trabaho. Panatilihin ang 50% ng bawat site na maibenta mo — mula ₱500 hanggang ₱2,500, plus ₱1,000 kada referral. Bayad sa loob ng 48 oras.",
    "hero.scroll": "O mag-scroll — hanapin ang mga creator malapit sa'yo sa mapa sa ibaba.",
    "hero.counterCreators": "mga creator",
    "hero.counterBusinesses": "live na site",
    "hero.counterCities": "mga lungsod",
    "hero.counterCountries": "mga bansa",

    // Business pricing
    "price.eyebrow": "§ 04 — Ang presyo",
    "price.liveForever": "Live habambuhay.",
    "price.lede":
        "Isang bayad lang. Walang buwanang bayad. Walang kontrata. Magbabayad ka lang kapag live na ang website mo at na-approve mo na.",
    "price.oneTime": "Isang beses · bayad lang kapag live na",
    "price.footnote":
        "Walang card na nakatago. Walang maliit na letra. Walang sorpresang singil. ◆ Pantay ang presyo sa ibang bansa sa PH hanggang sa lokal na launch.",

    // CTA
    "cta.title": "May karapatan ang trabaho mo sa sariling page.",
    "cta.subtitle": "Live sa 48 oras. Magbayad lang kapag masaya ka na dito.",
    "cta.business": "May negosyo ako",
    "cta.creator": "Gusto kong kumita bilang creator",

    // FAQ
    "faq.title": "Mga tanong, nasagot na.",
};

const DICTS: Record<Lang, Dict> = { en: EN, tl: TL };

interface LangCtx {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LangCtx | null>(null);

const STORAGE_KEY = "tendso.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>("en");

    // Read persisted choice on mount (client-only, avoids SSR mismatch).
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === "en" || saved === "tl") setLangState(saved);
        } catch {
            /* localStorage unavailable — stay on default */
        }
    }, []);

    const setLang = (l: Lang) => {
        setLangState(l);
        try {
            localStorage.setItem(STORAGE_KEY, l);
        } catch {
            /* ignore */
        }
    };

    const t = (key: string): string => {
        return DICTS[lang][key] ?? EN[key] ?? key; // tl → en → raw key
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

/** Access the active language + translator. Safe outside a provider (defaults to EN). */
export function useT(): LangCtx {
    const ctx = useContext(LanguageContext);
    if (!ctx) {
        // Fallback so a component used outside the provider never crashes.
        return { lang: "en", setLang: () => {}, t: (k) => EN[k] ?? k };
    }
    return ctx;
}
