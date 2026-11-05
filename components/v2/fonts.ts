import localFont from "next/font/local";

/**
 * Design v2 typefaces.
 *
 * Onest is the whole system (landing and app); JetBrains Mono is used only for
 * tiny uppercase labels. The files are the same self-hosted woff2 the rest of the
 * site already ships (public/fonts, see app/self-hosted-fonts.css), loaded through
 * next/font/local rather than next/font/google: this repo moved off
 * next/font/google after a Google Fonts fetch failed during a production build
 * (2026-09-28), and a font is not worth a broken deploy.
 *
 * The variables are only defined on the element that carries `v2Fonts`
 * (see V2Root), so nothing outside a v2 scope can pick them up.
 */
const onest = localFont({
    src: [
        { path: "../../public/fonts/onest-latin-400-normal.woff2", weight: "400", style: "normal" },
        { path: "../../public/fonts/onest-latin-500-normal.woff2", weight: "500", style: "normal" },
        { path: "../../public/fonts/onest-latin-600-normal.woff2", weight: "600", style: "normal" },
        { path: "../../public/fonts/onest-latin-700-normal.woff2", weight: "700", style: "normal" },
    ],
    variable: "--font-v2-onest",
    display: "swap",
});

const mono = localFont({
    src: [{ path: "../../public/fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" }],
    variable: "--font-v2-mono",
    display: "swap",
    preload: false,
});

/** className that defines --font-v2-onest and --font-v2-mono. */
export const v2Fonts = `${onest.variable} ${mono.variable}`;
