"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Zap, Globe2, Check, ArrowRight } from "lucide-react";
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

    return (
        <section
            id="pricing"
            className="w-full py-20 sm:py-24 px-6 max-w-7xl mx-auto relative z-10 bg-emerald-50/40 sm:rounded-[2rem] sm:my-12"
        >
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-14 relative z-10">
                <p className="text-xs uppercase tracking-widest font-bold text-emerald-700 mb-3">
                    Pricing · One-time payment
                </p>
                <h2
                    style={{ fontFamily: "var(--font-fraunces)" }}
                    className="text-4xl sm:text-5xl md:text-6xl font-semibold text-neutral-900 leading-[1.05] mb-5"
                >
                    Live in <span className="italic text-emerald-700">48 hours.</span>
                </h2>
                <p className="text-base sm:text-lg text-neutral-700 leading-relaxed">
                    One-time payment. No monthly fees. No contracts. You only pay when your website is live.
                </p>
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
                            className={`relative flex flex-col h-full rounded-[1.75rem] p-7 sm:p-9 overflow-hidden transition-shadow ${
                                tier.featured
                                    ? "bg-neutral-900 text-white border-2 border-emerald-500 shadow-xl shadow-emerald-900/20"
                                    : "bg-white border border-neutral-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-900/5"
                            }`}
                        >
                            {tier.featured && (
                                <div className="absolute top-5 right-5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500 text-white">
                                    Most Popular
                                </div>
                            )}

                            <div
                                className={`mb-5 p-4 rounded-2xl w-max border ${
                                    tier.featured
                                        ? "bg-emerald-500/10 border-emerald-500/30"
                                        : "bg-emerald-50 border-emerald-200"
                                }`}
                            >
                                <Icon
                                    className={`w-7 h-7 ${
                                        tier.featured ? "text-emerald-400" : "text-emerald-700"
                                    }`}
                                />
                            </div>

                            <h3
                                style={{ fontFamily: "var(--font-fraunces)" }}
                                className={`text-2xl sm:text-3xl font-semibold mb-2 ${
                                    tier.featured ? "text-white" : "text-neutral-900"
                                }`}
                            >
                                {tier.name}
                            </h3>

                            <p className={`text-sm mb-6 leading-relaxed ${tier.featured ? "text-white/70" : "text-neutral-600"}`}>
                                {tier.tagline}
                            </p>

                            <div className="flex items-baseline gap-2 mb-2">
                                <span className={`text-xl font-semibold ${tier.featured ? "text-white/50" : "text-neutral-400"}`}>
                                    ₱
                                </span>
                                <span
                                    style={{ fontFamily: "var(--font-fraunces)" }}
                                    className={`text-6xl sm:text-7xl font-bold tracking-tight ${
                                        tier.featured ? "text-white" : "text-neutral-900"
                                    }`}
                                >
                                    {tier.price}
                                </span>
                            </div>

                            <p
                                className={`text-xs uppercase tracking-widest mb-7 font-semibold ${
                                    tier.featured ? "text-white/50" : "text-neutral-500"
                                }`}
                            >
                                One-time · Pay only when live
                            </p>

                            <ul className="space-y-2.5 mb-8">
                                {tier.features.map((feature, i) => (
                                    <li
                                        key={i}
                                        className={`flex items-start gap-3 text-sm ${
                                            tier.featured ? "text-white/85" : "text-neutral-700"
                                        }`}
                                    >
                                        <span
                                            className={`shrink-0 mt-0.5 rounded-full p-0.5 ${
                                                tier.featured
                                                    ? "bg-emerald-500/20 text-emerald-300"
                                                    : "bg-emerald-100 text-emerald-700"
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
                                    className={`w-full py-4 rounded-full font-semibold text-base flex items-center justify-center gap-3 transition-all hover:gap-4 min-h-[52px] ${
                                        tier.featured
                                            ? "bg-emerald-500 text-white hover:bg-emerald-400"
                                            : "bg-neutral-900 text-white hover:bg-emerald-700"
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

            <p className="text-center text-neutral-500 text-xs sm:text-sm mt-8 max-w-2xl mx-auto leading-relaxed relative z-10">
                After year 1, custom domain renewal is approximately{" "}
                <span className="text-neutral-700 font-medium">₱1,120/year (~$20)</span> — paid directly to the registrar.
                We don&apos;t auto-renew. Full control stays with you.
            </p>
        </section>
    );
}
