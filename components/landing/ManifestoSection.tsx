"use client";

function Beat({ label, big, sub }: { label: string; big: string; sub: string }) {
    return (
        <div>
            <div className="label" style={{ marginBottom: 12 }}>{label}</div>
            <div className="counter-num" style={{ fontSize: 44, lineHeight: 1.0, marginBottom: 12 }}>{big}</div>
            <div style={{ fontSize: 14, color: "var(--neo-ink-2)", lineHeight: 1.55 }}>{sub}</div>
        </div>
    );
}

export default function ManifestoSection() {
    return (
        <section style={{ background: "var(--neo-paper-2)" }} className="py-16 sm:py-20 lg:py-[120px]">
            <div className="container-wide">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(160px,1fr)_4fr] gap-6 lg:gap-12">
                    <div className="eyebrow">Manifesto</div>
                    <div>
                        <p
                            className="display-2"
                            style={{
                                fontSize: "clamp(36px, 4.4vw, 64px)",
                                lineHeight: 1.08,
                                letterSpacing: "-.02em",
                            }}
                        >
                            The internet was built for the{" "}
                            <em style={{ fontStyle: "italic" }}>top one percent</em> of businesses.
                            <br />
                            <span style={{ color: "var(--neo-creator)" }}>We&apos;re building it for the other ninety-nine.</span>
                        </p>
                        <div
                            className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-8"
                            style={{ borderTop: "1px solid var(--neo-rule)" }}
                        >
                            <Beat
                                label="Who we serve"
                                big="The 99%"
                                sub="Sari-sari stores. Salons. Barangay clinics. The shops nobody else builds for."
                            />
                            <Beat
                                label="How fast"
                                big="48–72 hrs"
                                sub="From the day a creator walks into your shop to the day your site is live and indexed."
                            />
                            <Beat
                                label="What it takes"
                                big="Zero skill"
                                sub="You don't open a laptop. You don't pick a template. You answer questions about your business."
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
