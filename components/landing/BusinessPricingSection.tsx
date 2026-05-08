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
        accent: "#00FF66",
        accentSoft: "rgba(0,255,102,0.10)",
        accentBorder: "rgba(0,255,102,0.30)",
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
        accent: "#00F0FF",
        accentSoft: "rgba(0,240,255,0.12)",
        accentBorder: "rgba(0,240,255,0.40)",
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
        <section id="pricing" className="w-full py-32 px-6 max-w-7xl mx-auto relative z-10 border-t border-white/5">
            {/* Background ambient glow */}
            <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-[#00F0FF] rounded-full mix-blend-screen filter blur-[250px] opacity-10 pointer-events-none" />
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#00FF66] rounded-full mix-blend-screen filter blur-[200px] opacity-10 pointer-events-none" />

            {/* Header */}
            <div className="text-center mb-20 relative z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/10 mb-8"
                >
                    <span className="w-3 h-3 rounded-full bg-[#00F0FF] animate-pulse" />
                    <span
                        className={`text-[#00F0FF] text-sm uppercase tracking-widest font-black ${bricolage.className}`}
                    >
                        For Business Owners
                    </span>
                </motion.div>

                <motion.h2
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className={`text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9] ${bricolage.className}`}
                >
                    Live in{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF66] to-[#00F0FF]">
                        48 hours.
                    </span>
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="text-white/60 text-lg md:text-2xl mt-6 max-w-2xl mx-auto font-light"
                >
                    One-time payment. No monthly fees. No contracts.
                </motion.p>
            </div>

            {/* Pricing cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto relative z-10">
                {tiers.map((tier, idx) => {
                    const Icon = tier.icon;
                    return (
                        <motion.div
                            key={tier.name}
                            initial={{ opacity: 0, y: 60 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.15, duration: 0.6 }}
                            className={`relative flex flex-col h-full rounded-[2.5rem] p-10 backdrop-blur-md overflow-hidden group ${
                                tier.featured
                                    ? "bg-gradient-to-b from-[#00F0FF]/10 to-transparent border-2"
                                    : "bg-white/5 border"
                            }`}
                            style={{
                                borderColor: tier.featured ? tier.accentBorder : "rgba(255,255,255,0.10)",
                            }}
                        >
                            {/* "Most Popular" ribbon for the featured tier */}
                            {tier.featured && (
                                <div
                                    className="absolute top-6 right-6 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                                    style={{
                                        backgroundColor: tier.accent,
                                        color: "#000",
                                    }}
                                >
                                    Most Popular
                                </div>
                            )}

                            {/* Decorative icon halo behind */}
                            <div
                                className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-150 transition-transform duration-700 pointer-events-none"
                                style={{ color: tier.accent }}
                            >
                                <Icon className="w-20 h-20" />
                            </div>

                            {/* Foreground icon chip */}
                            <div
                                className="mb-6 p-5 rounded-2xl w-max border backdrop-blur-xl bg-black/40"
                                style={{ borderColor: tier.accentBorder }}
                            >
                                <Icon className="w-10 h-10" style={{ color: tier.accent }} />
                            </div>

                            {/* Tier name */}
                            <h3
                                className={`text-2xl font-bold uppercase text-white/80 tracking-wide mb-2 ${bricolage.className}`}
                            >
                                {tier.name}
                            </h3>

                            {/* Tagline */}
                            <p className="text-white/60 text-sm mb-8 font-light leading-relaxed">
                                {tier.tagline}
                            </p>

                            {/* Price */}
                            <div className="flex items-baseline gap-2 mb-8">
                                <span
                                    className={`text-2xl font-bold text-white/40 ${bricolage.className}`}
                                >
                                    PHP
                                </span>
                                <span
                                    className={`text-7xl md:text-8xl font-black text-white tracking-tighter ${bricolage.className}`}
                                >
                                    {tier.price}
                                </span>
                            </div>

                            <p className="text-white/40 text-xs uppercase tracking-widest mb-8 font-bold">
                                One-time · No Hidden Fees
                            </p>

                            {/* Features list */}
                            <ul className="space-y-3 mb-10">
                                {tier.features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3 text-white/80 text-sm">
                                        <span
                                            className="shrink-0 mt-0.5 rounded-full p-0.5"
                                            style={{
                                                backgroundColor: tier.accentSoft,
                                                color: tier.accent,
                                            }}
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
                                    className={`w-full py-5 rounded-full font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all hover:opacity-90 hover:gap-5 ${bricolage.className}`}
                                    style={{
                                        backgroundColor: tier.featured ? tier.accent : "rgba(255,255,255,0.10)",
                                        color: tier.featured ? "#000" : "#fff",
                                        border: tier.featured ? "none" : `1px solid ${tier.accentBorder}`,
                                    }}
                                >
                                    {tier.ctaLabel}
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </Link>
                        </motion.div>
                    );
                })}
            </div>

            {/* Footnote on renewals */}
            <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="text-center text-white/40 text-xs md:text-sm mt-10 max-w-2xl mx-auto font-light leading-relaxed"
            >
                After year 1, custom domain renewal is approximately{" "}
                <span className="text-white/60">₱1,120/year (~$20)</span> — paid directly to the registrar.
                We don&apos;t auto-renew. Full control stays with you.
            </motion.p>
        </section>
    );
}
