"use client";

import { motion } from "framer-motion";
import { Zap, Globe2, Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Bricolage_Grotesque } from "next/font/google";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["400", "600", "800"] });

const tiers = [
    {
        name: "Standard",
        price: "1,000",
        tagline: "Instant website generation and deployment",
        icon: Zap,
        featured: false,
        ctaLabel: "Get Started",
        ctaHref: "/login",
        features: [
            "Professional website built in 24–48 hours",
            "Free Negosyo subdomain (yourbusiness.negosyo-digital.com)",
            "AI-enhanced photos + business description",
            "Hosted on Cloudflare with SSL",
            "Mobile-optimized — works on every device",
            "Free edits within 7 days of launch",
        ],
    },
    {
        name: "With Custom Domain",
        price: "1,500",
        tagline: "Your own .com — fully owned by you",
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
    return (
        <section
            id="pricing"
            className="w-full py-24 md:py-32 px-6 max-w-7xl mx-auto relative z-10 border-t border-neutral-100"
        >
            {/* Soft ambient backdrop */}
            <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-emerald-100 rounded-full filter blur-[180px] opacity-50 pointer-events-none" />
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-emerald-50 rounded-full filter blur-[160px] opacity-70 pointer-events-none" />

            {/* Header */}
            <div className="text-center mb-16 md:mb-20 relative z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-emerald-200 bg-emerald-50 mb-8"
                >
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span
                        className={`text-emerald-700 text-sm uppercase tracking-widest font-black ${bricolage.className}`}
                    >
                        For Business Owners
                    </span>
                </motion.div>

                <motion.h2
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className={`text-5xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9] text-neutral-900 ${bricolage.className}`}
                >
                    Live in{" "}
                    <span className="text-emerald-600">
                        48 hours.
                    </span>
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="text-neutral-700 text-lg md:text-2xl mt-6 max-w-2xl mx-auto font-light"
                >
                    One-time payment. No monthly fees. No contracts.
                </motion.p>
            </div>

            {/* Pricing cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto relative z-10">
                {tiers.map((tier, idx) => {
                    const Icon = tier.icon;
                    return (
                        <motion.div
                            key={tier.name}
                            initial={{ opacity: 0, y: 60 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.15, duration: 0.6 }}
                            className={`relative flex flex-col h-full rounded-[2.5rem] p-8 md:p-10 overflow-hidden group transition-shadow ${
                                tier.featured
                                    ? "bg-neutral-900 text-white border-2 border-emerald-500 shadow-xl shadow-emerald-500/20"
                                    : "bg-white border border-neutral-200 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/10"
                            }`}
                        >
                            {/* "Most Popular" ribbon */}
                            {tier.featured && (
                                <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white">
                                    Most Popular
                                </div>
                            )}

                            {/* Decorative icon halo */}
                            <div
                                className={`absolute top-0 right-0 p-12 opacity-10 group-hover:scale-150 transition-transform duration-700 pointer-events-none ${
                                    tier.featured ? "text-emerald-400" : "text-emerald-600"
                                }`}
                            >
                                <Icon className="w-20 h-20" />
                            </div>

                            {/* Foreground icon chip */}
                            <div
                                className={`mb-6 p-5 rounded-2xl w-max border ${
                                    tier.featured
                                        ? "bg-emerald-500/10 border-emerald-500/30"
                                        : "bg-emerald-50 border-emerald-200"
                                }`}
                            >
                                <Icon
                                    className={`w-10 h-10 ${
                                        tier.featured ? "text-emerald-400" : "text-emerald-600"
                                    }`}
                                />
                            </div>

                            {/* Tier name */}
                            <h3
                                className={`text-2xl font-bold uppercase tracking-wide mb-2 ${
                                    tier.featured ? "text-white/80" : "text-neutral-700"
                                } ${bricolage.className}`}
                            >
                                {tier.name}
                            </h3>

                            {/* Tagline */}
                            <p
                                className={`text-sm mb-8 font-light leading-relaxed ${
                                    tier.featured ? "text-white/60" : "text-neutral-600"
                                }`}
                            >
                                {tier.tagline}
                            </p>

                            {/* Price */}
                            <div className="flex items-baseline gap-2 mb-8">
                                <span
                                    className={`text-2xl font-bold ${
                                        tier.featured ? "text-white/40" : "text-neutral-400"
                                    } ${bricolage.className}`}
                                >
                                    PHP
                                </span>
                                <span
                                    className={`text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter ${
                                        tier.featured ? "text-white" : "text-neutral-900"
                                    } ${bricolage.className}`}
                                >
                                    {tier.price}
                                </span>
                            </div>

                            <p
                                className={`text-xs uppercase tracking-widest mb-8 font-bold ${
                                    tier.featured ? "text-white/40" : "text-neutral-500"
                                }`}
                            >
                                One-time · No Hidden Fees
                            </p>

                            {/* Features list */}
                            <ul className="space-y-3 mb-10">
                                {tier.features.map((feature, i) => (
                                    <li
                                        key={i}
                                        className={`flex items-start gap-3 text-sm ${
                                            tier.featured ? "text-white/80" : "text-neutral-700"
                                        }`}
                                    >
                                        <span
                                            className={`shrink-0 mt-0.5 rounded-full p-0.5 ${
                                                tier.featured
                                                    ? "bg-emerald-500/20 text-emerald-400"
                                                    : "bg-emerald-100 text-emerald-700"
                                            }`}
                                        >
                                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                        </span>
                                        <span className="leading-relaxed">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            <Link href={tier.ctaHref} className="mt-auto">
                                <button
                                    className={`w-full py-4 md:py-5 rounded-full font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all hover:gap-5 ${
                                        tier.featured
                                            ? "bg-emerald-500 text-white hover:bg-emerald-400"
                                            : "bg-neutral-900 text-white hover:bg-emerald-600"
                                    } ${bricolage.className}`}
                                >
                                    {tier.ctaLabel}
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </Link>
                        </motion.div>
                    );
                })}
            </div>

            {/* Footnote */}
            <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="text-center text-neutral-500 text-xs md:text-sm mt-10 max-w-2xl mx-auto font-light leading-relaxed relative z-10"
            >
                After year 1, custom domain renewal is approximately{" "}
                <span className="text-neutral-700 font-medium">₱1,120/year (~$20)</span> — paid directly to the registrar.
                We don&apos;t auto-renew. Full control stays with you.
            </motion.p>
        </section>
    );
}
