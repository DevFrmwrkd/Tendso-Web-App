"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const footColStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    fontSize: 14,
};

const footSelStyle: React.CSSProperties = {
    appearance: "none",
    border: "1px solid oklch(40% 0.015 260)",
    background: "transparent",
    color: "oklch(85% 0.008 85)",
    padding: "10px 12px",
    fontFamily: "var(--neo-mono)",
    fontSize: 11,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    cursor: "pointer",
    width: "100%",
    borderRadius: 8,
};

function FootCol({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="label" style={{ marginBottom: 16 }}>{title}</div>
            <div style={footColStyle}>{children}</div>
        </div>
    );
}

export default function Footer({
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
    const apkUrl = useQuery(api.settings.get, { key: "apk_download_url" }) as string | null | undefined;
    return (
        <footer className="neo-footer">
            <div className="container-wide">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-8 sm:gap-10 lg:gap-12 items-start">
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <span
                                style={{
                                    fontFamily: "var(--neo-serif)",
                                    fontStyle: "italic",
                                    fontSize: 36,
                                    letterSpacing: "-.02em",
                                }}
                            >
                                Negosyo
                            </span>{" "}
                            <span
                                className="mono"
                                style={{
                                    letterSpacing: ".18em",
                                    textTransform: "uppercase",
                                    fontSize: 13,
                                    color: "oklch(70% 0.010 85)",
                                }}
                            >
                                Digital
                            </span>
                        </div>
                        <p
                            style={{
                                maxWidth: "44ch",
                                color: "oklch(72% 0.010 85)",
                                lineHeight: 1.5,
                                fontSize: 14,
                            }}
                        >
                            A platform for the people who build for everyone else. Two doors, one map, one app — and a competitive moat the size of a country.
                        </p>
                    </div>
                    <FootCol title="Get the app">
                        {apkUrl ? (
                            // Routed through /api/download-apk so the browser
                            // saves the file as "negosyo-digital.apk" instead
                            // of the cryptic R2 key. Upload pipeline untouched.
                            <a href="/api/download-apk">
                                Android · Direct APK
                            </a>
                        ) : (
                            <Link href="/signup">Android · Direct APK</Link>
                        )}
                        <span style={{ opacity: 0.5 }}>iOS · Coming soon</span>
                        <Link href="/knowledge">Knowledge base</Link>
                        <Link href="/help-faq">Help</Link>
                    </FootCol>
                    <FootCol title="Legal">
                        <Link href="/privacy-policy">Privacy</Link>
                        <Link href="/terms-of-service">Terms</Link>
                        <Link href="/contact">Contact</Link>
                    </FootCol>
                    <FootCol title="Region">
                        <select
                            value={country}
                            onChange={(e) => onCountryChange?.(e.target.value)}
                            style={footSelStyle}
                            aria-label="Country"
                        >
                            <option value="PH">🇵🇭 Philippines</option>
                            <option value="ID">🇮🇩 Indonesia</option>
                            <option value="MX">🇲🇽 Mexico</option>
                            <option value="VN">🇻🇳 Vietnam</option>
                        </select>
                        <select
                            value={lang}
                            onChange={(e) => onLangChange?.(e.target.value)}
                            style={footSelStyle}
                            aria-label="Language"
                        >
                            <option value="en">English</option>
                            <option value="tl">Tagalog</option>
                        </select>
                    </FootCol>
                </div>
                <div
                    style={{
                        marginTop: 48,
                        paddingTop: 24,
                        borderTop: "1px solid oklch(40% 0.015 260)",
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        color: "oklch(60% 0.010 85)",
                    }}
                >
                    <span className="label">© Negosyo Digital · {new Date().getFullYear()}</span>
                    <span className="label">Map data: OpenStreetMap · CARTO</span>
                </div>
            </div>
        </footer>
    );
}
