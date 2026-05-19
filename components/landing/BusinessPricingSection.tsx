"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Zap, Globe2, Check, ArrowRight, Store } from "lucide-react";
import Link from "next/link";

const tiers = [
    {
        name: "Standard",
        price: "1,000",
        tagline: "Your business website, live in 48 hours.",
        icon: Zap,
        featured: false,
        ctaLabel: "Get Started",
        ctaHref: "/login",
        features: [
            "Real coded website (not Wix or template)",
            "Free subdomain: yourbusiness.negosyodigital.ph",
            "AI-enhanced photos from your phone shots",
            "Mobile-optimized — works on every device",
            "Hosted with SSL, fast loading",
            "Free edits within 7 days of launch",
        ],
    },
    {
        name: "With Custom Domain",
        price: "1,500",
        tagline: "Your own .com — fully owned by you.",
        icon: Globe2,
        featured: true,
        ctaLabel: "Get a Custom Domain",
        ctaHref: "/login",
        features: [
            "Everything in Standard",
            "Custom domain (.com / .net / .shop / .store / others)",
            "Year 1 of the domain included free",
            "You own the domain — we never auto-renew",
            "30-day reminder before renewal",
            "Same 24–48 hour deployment",
        ],
    },
];

export default function BusinessPricingSection() {
    const reduceMotion = useReducedMotion();

    const fadeUp = reduceMotion
        ? {}
        : {
            initial: { opacity: 0, y: 24 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, margin: "-80px" },
        };

    return (
        <section
            id="for-business"
            className="w-full py-24 sm:py-32 px-6 relative z-10 scroll-mt-24"
            style={{ background: "var(--khaki)" }}
        >
            <div className="max-w-7xl mx-auto">
                {/* Audience switch band — clear signal this is for business owners */}
                <motion.div
                    {...fadeUp}
                    transition={{ duration: 0.5 }}
                    className="max-w-3xl mx-auto mb-12 relative z-10"
                >
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-[var(--khaki-deep)] border border-[var(--ink)]/15 rounded-2xl px-5 py-4 shadow-sm">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--rust)]/10 border border-[var(--rust)]/30 flex items-center justify-center shrink-0">
                            <Store className="w-6 h-6 text-[var(--rust)]" />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <p
                                className="text-[10px] font-medium uppercase tracking-[0.4em] text-[var(--rust)] mb-1"
                                style={{ fontFamily: "var(--font-mono)" }}
                            >
                                For business owners
                            </p>
                            <p className="text-sm text-[var(--ink)]/75 leading-relaxed">
                                A creator may already be on the way to your shop. Or skip the wait — sign up and we&apos;ll get your website live in 48 hours.
                            </p>
                        </div>
                        <Link
                            href="/signup"
                            className="group inline-flex items-center justify-center gap-2 bg-[var(--ink)] hover:bg-[var(--rust)] text-[var(--khaki)] px-5 py-2.5 rounded-full font-semibold text-sm transition-colors shrink-0 min-h-[40px]"
                        >
                            Get started
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    </div>
                </motion.div>

                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16 relative z-10">
                    <motion.div
                        {...fadeUp}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="flex items-center gap-3 justify-center mb-8"
                    >
                        <span className="h-px w-10 sm:w-16 bg-[var(--rust)]/40" />
                        <p
                            className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-medium text-[var(--rust)]"
                            style={{ fontFamily: "var(--font-mono)" }}
                        >
                            § 04 — THE PRICE
                        </p>
                        <span className="h-px w-10 sm:w-16 bg-[var(--rust)]/40" />
                    </motion.div>

                    <motion.h2
                        {...fadeUp}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        style={{
                            fontFamily: "var(--font-playfair)",
                            fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
                        }}
                        className="font-bold text-[var(--ink)] leading-[0.95] tracking-[-0.01em] mb-6"
                    >
                        ₱1,000 once. <span className="italic" style={{ color: "var(--rust)" }}>Live forever.</span>
                    </motion.h2>

                    <motion.p
                        {...fadeUp}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        style={{
                            fontFamily: "var(--font-playfair)",
                            fontSize: "clamp(1.05rem, 1.5vw, 1.3rem)",
                        }}
                        className="italic text-[var(--ink)]/60"
                    >
                        One-time payment. No monthly fees. No contracts. You only pay once your website is live.
                    </motion.p>
                </div>

                {/* Pricing cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-5xl mx-auto relative z-10">
                    {tiers.map((tier, idx) => {
                        const Icon = tier.icon;
                        return (
                            <motion.div
                                key={tier.name}
                                initial={reduceMotion ? {} : { opacity: 0, y: 30 }}
                                whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5, delay: idx * 0.1 }}
                                className={`relative flex flex-col h-full rounded-[1.5rem] p-8 sm:p-10 overflow-hidden transition-all ${tier.featured
                                    ? "bg-[var(--ink)] text-[var(--khaki)] border-2 border-[var(--rust)] shadow-2xl shadow-[var(--ink)]/25"
                                    : "bg-[var(--khaki-deep)] border border-[var(--ink)]/15 hover:border-[var(--rust)]/50 hover:shadow-xl hover:shadow-[var(--ink)]/10"
                                    }`}
                            >
                                {tier.featured && (
                                    <div
                                        className="absolute top-5 right-5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] bg-[var(--rust)] text-[var(--khaki)]"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        Most Popular
                                    </div>
                                )}

                                <div
                                    className={`mb-5 p-3.5 rounded-2xl w-max border ${tier.featured
                                        ? "bg-[var(--rust)]/15 border-[var(--rust)]/40"
                                        : "bg-[var(--khaki)] border-[var(--ink)]/15"
                                        }`}
                                >
                                    <Icon
                                        className={`w-7 h-7 ${tier.featured ? "text-[var(--rust-soft)]" : "text-[var(--rust)]"
                                            }`}
                                    />
                                </div>

                                <h3
                                    style={{ fontFamily: "var(--font-playfair)" }}
                                    className={`text-3xl sm:text-4xl font-bold mb-2 ${tier.featured ? "text-[var(--khaki)]" : "text-[var(--ink)]"
                                        }`}
                                >
                                    {tier.name}
                                </h3>

                                <p
                                    className={`text-sm mb-7 leading-relaxed italic ${tier.featured ? "text-[var(--khaki)]/65" : "text-[var(--ink)]/60"
                                        }`}
                                    style={{ fontFamily: "var(--font-playfair)" }}
                                >
                                    {tier.tagline}
                                </p>

                                <div className="flex items-baseline gap-2 mb-2">
                                    <span
                                        className={`text-xl font-semibold ${tier.featured ? "text-[var(--khaki)]/50" : "text-[var(--ink)]/40"
                                            }`}
                                        style={{ fontFamily: "var(--font-playfair)" }}
                                    >
                                        ₱
                                    </span>
                                    <span
                                        style={{ fontFamily: "var(--font-playfair)" }}
                                        className={`text-6xl sm:text-7xl font-bold tracking-tight ${tier.featured ? "text-[var(--khaki)]" : "text-[var(--ink)]"
                                            }`}
                                    >
                                        {tier.price}
                                    </span>
                                </div>

                                <p
                                    className={`text-[10px] uppercase tracking-[0.4em] mb-7 font-medium ${tier.featured ? "text-[var(--khaki)]/50" : "text-[var(--ink)]/50"
                                        }`}
                                    style={{ fontFamily: "var(--font-mono)" }}
                                >
                                    One-time · Pay only when live
                                </p>

                                <ul className="space-y-2.5 mb-8">
                                    {tier.features.map((feature, i) => (
                                        <li
                                            key={i}
                                            className={`flex items-start gap-3 text-sm ${tier.featured ? "text-[var(--khaki)]/85" : "text-[var(--ink)]/80"
                                                }`}
                                        >
                                            <span
                                                className={`shrink-0 mt-0.5 rounded-full p-0.5 ${tier.featured
                                                    ? "bg-[var(--rust)]/20 text-[var(--rust-soft)]"
                                                    : "bg-[var(--rust)]/10 text-[var(--rust)]"
                                                    }`}
                                                aria-hidden
                                            >
                                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                            </span>
                                            <span className="leading-relaxed">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link href={tier.ctaHref} className="mt-auto">
                                    <button
                                        className={`w-full py-4 rounded-full font-semibold text-base flex items-center justify-center gap-3 transition-all hover:gap-4 min-h-[52px] ${tier.featured
                                            ? "bg-[var(--rust)] text-[var(--khaki)] hover:bg-[var(--rust-soft)]"
                                            : "bg-[var(--ink)] text-[var(--khaki)] hover:bg-[var(--rust)]"
                                            }`}
                                    >
                                        {tier.ctaLabel}
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>

            </div>
        </section>
    );
}
