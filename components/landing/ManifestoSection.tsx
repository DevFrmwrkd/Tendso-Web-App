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
                            They did not come here to become{" "}
                            <em style={{ fontStyle: "italic" }}>designers</em>.
                            <br />
                            <span style={{ color: "var(--neo-creator)" }}>They came here to keep the business moving.</span>
                        </p>
                        <div
                            className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-8"
                            style={{ borderTop: "1px solid var(--neo-rule)" }}
                        >
                            <Beat
                                label="What we respect"
                                big="The work"
                                sub="Sari-sari stores, salons, barangay clinics — the shops where someone is already kneading, cutting, or fixing while you read this."
                            />
                            <Beat
                                label="How fast"
                                big="48 hrs"
                                sub="From the day a creator walks into your shop to the day your page is live. You keep working through all of it."
                            />
                            <Beat
                                label="What it takes from you"
                                big="A photo"
                                sub="A few answers. A guided review. That's the whole ask. We built the rest around the work."
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
