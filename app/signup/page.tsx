"use client";

import { SignUp } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/public/logo.png";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function SignupPage() {
    return (
        <div
            className="min-h-screen w-full overflow-x-hidden relative flex items-start sm:items-center justify-center px-6 py-12 sm:py-16"
            style={{ background: "var(--khaki)", color: "var(--ink)" }}
        >
            {/* Paper grain */}
            <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-multiply"
                style={{
                    backgroundImage:
                        "radial-gradient(circle at 25% 25%, var(--ink) 0.5px, transparent 1px), radial-gradient(circle at 75% 75%, var(--ink) 0.5px, transparent 1px)",
                    backgroundSize: "4px 4px, 6px 6px",
                }}
            />
            {/* Soft green halos */}
            <div className="absolute -top-32 -right-20 w-[480px] h-[480px] bg-[var(--rust)]/8 rounded-full filter blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-40 -left-32 w-[520px] h-[520px] bg-[var(--rust-soft)]/12 rounded-full filter blur-[140px] pointer-events-none" />

            {/* BACK TO HOME */}
            <Link
                href="/"
                className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-2.5 text-[var(--ink)]/70 hover:text-[var(--rust)] transition-colors group z-20"
            >
                <span className="w-9 h-9 rounded-full border border-[var(--ink)]/15 bg-[var(--khaki-deep)] flex items-center justify-center shadow-sm group-hover:border-[var(--rust)]/50 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </span>
                <span className="font-semibold tracking-wide text-sm">Back home</span>
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md mt-12 sm:mt-0 relative z-10"
            >
                {/* Section marker */}
                <div className="flex items-center gap-3 mb-8 justify-center">
                    <span className="h-px w-10 bg-[var(--rust)]/40" />
                    <p
                        className="text-[10px] uppercase tracking-[0.4em] font-medium text-[var(--rust)]"
                        style={{ fontFamily: "var(--font-mono)" }}
                    >
                        § ACCESS — NEW CREATOR
                    </p>
                    <span className="h-px w-10 bg-[var(--rust)]/40" />
                </div>

                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[var(--ink)]/15 bg-[var(--khaki-deep)] p-1 flex items-center justify-center mb-5 shadow-md shadow-[var(--rust)]/15">
                        <Image src={Logo} alt="" width={56} height={56} className="rounded-xl" />
                    </div>
                    <h1
                        style={{
                            fontFamily: "var(--font-playfair)",
                            fontSize: "clamp(2.25rem, 5vw, 3rem)",
                        }}
                        className="font-bold tracking-[-0.01em] text-center text-[var(--ink)] mb-2 leading-[1.05]"
                    >
                        Join as a <span className="italic" style={{ color: "var(--rust)" }}>creator.</span>
                    </h1>
                    <p
                        className="text-[var(--ink)]/60 text-center italic max-w-xs leading-relaxed"
                        style={{
                            fontFamily: "var(--font-playfair)",
                            fontSize: "1.05rem",
                        }}
                    >
                        Earn ₱300–₱500 per submission. Direct payouts via Wise.
                    </p>
                </div>

                <div className="bg-[var(--khaki-deep)] border border-[var(--ink)]/15 p-6 sm:p-7 rounded-3xl shadow-xl shadow-[var(--ink)]/10">
                    <div className="w-full flex justify-center custom-clerk-wrapper">
                        <SignUp
                            appearance={{
                                elements: {
                                    rootBox: "w-full",
                                    card: "bg-transparent shadow-none p-0",
                                    headerTitle: "hidden",
                                    headerSubtitle: "hidden",
                                    socialButtonsBlockButton:
                                        "border border-[#0f0e14]/15 bg-[#f4ede1] text-[#0f0e14] hover:bg-[#ebe2cf] hover:border-[#2d5a3f]/50 transition-colors rounded-xl",
                                    // Hide TikTok specifically — keep Google + others
                                    socialButtonsBlockButton__tiktok: "!hidden",
                                    socialButtonsProviderIcon__tiktok: "!hidden",
                                    socialButtonsBlockButtonText: "font-semibold text-sm text-[#0f0e14]",
                                    formButtonPrimary:
                                        "bg-[#0f0e14] hover:bg-[#2d5a3f] text-[#f4ede1] shadow-md shadow-[#0f0e14]/20 transition-colors font-semibold text-sm rounded-xl h-12 normal-case",
                                    formFieldInput:
                                        "bg-[#f4ede1] border border-[#0f0e14]/15 text-[#0f0e14] placeholder:text-[#0f0e14]/40 focus:border-[#2d5a3f] focus:ring-1 focus:ring-[#2d5a3f] rounded-xl h-12 text-[15px]",
                                    formFieldLabel: "text-[10px] uppercase tracking-[0.3em] font-bold text-[#0f0e14]/70",
                                    dividerLine: "bg-[#0f0e14]/15",
                                    dividerText: "text-[#0f0e14]/50 font-medium text-[10px] uppercase tracking-[0.3em]",
                                    footerActionText: "text-[#0f0e14]/65",
                                    footerActionLink: "text-[#2d5a3f] hover:text-[#0f0e14] font-semibold underline decoration-[#2d5a3f]/40 underline-offset-4 italic",
                                    identityPreviewText: "text-[#0f0e14]",
                                    identityPreviewEditButtonIcon: "text-[#2d5a3f]",
                                    formFieldInputShowPasswordButton: "text-[#0f0e14]/50 hover:text-[#0f0e14]",
                                    formResendCodeLink: "text-[#2d5a3f] hover:text-[#0f0e14]",
                                },
                                variables: {
                                    colorBackground: "#ebe2cf",
                                    colorText: "#0f0e14",
                                    colorPrimary: "#0f0e14",
                                    colorInputText: "#0f0e14",
                                    colorInputBackground: "#f4ede1",
                                    fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif",
                                    borderRadius: "0.75rem",
                                },
                            }}
                            routing="hash"
                            forceRedirectUrl="/onboarding"
                            signInUrl="/login"
                        />
                    </div>
                </div>

                <p
                    className="text-center mt-7 text-sm text-[var(--ink)]/65"
                    style={{ fontFamily: "var(--font-playfair)" }}
                >
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className="font-semibold italic text-[var(--rust)] hover:text-[var(--ink)] transition-colors underline decoration-[var(--rust)]/40 underline-offset-4"
                    >
                        Log in
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
