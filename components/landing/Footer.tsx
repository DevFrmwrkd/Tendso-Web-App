"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useT, type Lang } from "./i18n";

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

export default function Footer() {
    const { lang, setLang } = useT();
    const apkUrl = useQuery(api.settings.get, { key: "apk_download_url" }) as string | null | undefined;
    return (
        <footer className="neo-footer">
            <div className="container-wide">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-8 sm:gap-10 lg:gap-12 items-start">
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            {/* White wordmark — footer is a dark surface, no invert needed.
                                eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/tendso-logo.png"
                                alt="Tendso"
                                width={200}
                                height={36}
                                style={{ display: "block" }}
                            />
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
                            // Direct R2 public URL. The download filename
                            // comes from the R2 storage key, which the
                            // upload pipeline pins to "tendso.apk".
                            <a href={apkUrl} download="tendso.apk">
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
                    <FootCol title="Language">
                        <select
                            value={lang}
                            onChange={(e) => setLang(e.target.value as Lang)}
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
                    <span className="label">© Tendso · {new Date().getFullYear()}</span>
                    <span className="label">Map data: OpenStreetMap · CARTO</span>
                </div>
            </div>
        </footer>
    );
}
