"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Logo, ArrowUpRightIcon } from "./landingPrimitives";

const selectStyle: React.CSSProperties = {
    appearance: "none",
    border: "1px solid var(--neo-rule)",
    background: "var(--neo-paper-3)",
    color: "var(--neo-ink)",
    padding: "8px 12px",
    fontFamily: "var(--neo-mono)",
    fontSize: 11,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    cursor: "pointer",
    borderRadius: 8,
};

export default function Navbar({
    lang = "en",
    country = "PH",
    onLangChange,
    onCountryChange,
}: {
    lang?: string;
    country?: string;
    onLangChange?: (v: string) => void;
    onCountryChange?: (v: string) => void;
} = {}) {
    // Direct APK download URL (admin uploads via /admin/app-release).
    // Falls back to /signup if no APK is currently uploaded.
    const apkUrl = useQuery(api.settings.get, { key: "apk_download_url" }) as string | null | undefined;
    const downloadHref = apkUrl || "/signup";
    const isApk = !!apkUrl;
    return (
        <div className="topbar">
            <div
                className="container-wide flex items-center justify-between gap-3"
                style={{ paddingTop: 12, paddingBottom: 12 }}
            >
                {/* Left cluster — logo + live status (status hides on phones) */}
                <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                    <Link href="/" style={{ textDecoration: "none" }} className="flex-shrink-0">
                        <Logo />
                    </Link>
                    {/* "Live in Philippines · expanding" — hide on <md to avoid wrap/overflow */}
                    <div className="label items-center gap-2 hidden md:flex">
                        <span className="live-dot"></span>
                        Live in Philippines · expanding
                    </div>
                </div>

                {/* Right cluster — selects hide on phones, Get-the-app always visible */}
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <select
                        value={lang}
                        onChange={(e) => onLangChange?.(e.target.value)}
                        style={selectStyle}
                        aria-label="Language"
                        className="hidden sm:inline-block"
                    >
                        <option value="en">EN</option>
                        <option value="tl">Tagalog</option>
                    </select>
                    <select
                        value={country}
                        onChange={(e) => onCountryChange?.(e.target.value)}
                        style={selectStyle}
                        aria-label="Country"
                        className="hidden md:inline-block"
                    >
                        <option value="PH">🇵🇭 Philippines</option>
                        <option value="ID">🇮🇩 Indonesia</option>
                        <option value="MX">🇲🇽 Mexico</option>
                        <option value="VN">🇻🇳 Vietnam</option>
                    </select>
                    <a
                        href={downloadHref}
                        {...(isApk
                            ? { download: "negosyo-digital.apk" }
                            : {})}
                        className="store-btn whitespace-nowrap"
                        style={{ textDecoration: "none", padding: "10px 14px" }}
                    >
                        <span>Get the app</span>
                        <span style={{ opacity: 0.6 }}>
                            <ArrowUpRightIcon />
                        </span>
                    </a>
                </div>
            </div>
        </div>
    );
}
