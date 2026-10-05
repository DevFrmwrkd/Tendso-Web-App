"use client";

/**
 * Lightweight EN/Tagalog localization for the public landing pages (the
 * landing at / and /for-creators), plus the shared public header and footer.
 *
 * These pages are static marketing (no per-request data), so a full i18n
 * library is overkill. This is a React context + a `useT()` hook returning
 * `t(key)`. The chosen language persists in localStorage and is read on mount.
 *
 * The copy lives in ./strings, one module per surface (shared header and
 * footer, landing, for-creators). Adding copy: add the key to BOTH `en` and
 * `tl` in the module for its page, then call `t("key")`. A missing `tl`
 * value falls back to `en`, so partial translation never shows a blank: it
 * shows English until the Tagalog lands.
 *
 * Tagalog copy is natural Taglish (how the audience actually speaks); brand
 * terms (Tendso, ₱, Wise, Gemini) stay verbatim. Have a native speaker review
 * it before treating it as final marketing copy.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { strings as forCreatorsStrings } from "./strings/forCreators";
import { strings as landingStrings } from "./strings/landing";
import { strings as sharedStrings } from "./strings/shared";
import type { Dict } from "./strings/types";

export type Lang = "en" | "tl";

const SURFACES = [sharedStrings, landingStrings, forCreatorsStrings];

const EN: Dict = Object.assign({}, ...SURFACES.map((s) => s.en));
const TL: Dict = Object.assign({}, ...SURFACES.map((s) => s.tl));

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
