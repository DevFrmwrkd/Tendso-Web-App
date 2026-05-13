"use client";

import { SignUp } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/public/logo.png";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function SignupPage() {
    return (
        <div className="min-h-screen w-full bg-white text-neutral-900 selection:bg-emerald-500 selection:text-white overflow-x-hidden relative flex items-start sm:items-center justify-center px-6 py-12 sm:py-16">
            {/* Soft ambient washes */}
            <div className="absolute -top-32 -right-20 w-[480px] h-[480px] bg-emerald-50 rounded-full filter blur-[120px] opacity-80 pointer-events-none" />
            <div className="absolute -bottom-40 -left-32 w-[520px] h-[520px] bg-emerald-100/60 rounded-full filter blur-[140px] opacity-70 pointer-events-none" />

            {/* BACK TO HOME */}
            <Link
                href="/"
                className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-2.5 text-neutral-600 hover:text-emerald-700 transition-colors group"
            >
                <span className="w-9 h-9 rounded-full border border-neutral-200 bg-white flex items-center justify-center shadow-sm group-hover:border-emerald-300 transition-colors">
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
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-emerald-100 bg-emerald-50 p-1 flex items-center justify-center mb-5 shadow-md shadow-emerald-500/10">
                        <Image src={Logo} alt="" width={56} height={56} className="rounded-xl" />
                    </div>
                    <h1
                        style={{ fontFamily: "var(--font-fraunces)" }}
                        className="text-3xl md:text-4xl font-semibold tracking-tight text-center text-neutral-900 mb-2 leading-tight"
                    >
                        Join as a <span className="italic text-emerald-700">creator.</span>
                    </h1>
                    <p className="text-neutral-600 text-center text-[15px] max-w-xs leading-relaxed">
                        Earn ₱300–₱500 per submission. Direct payouts via Wise.
                    </p>
                </div>

                <div className="bg-white border border-neutral-200 p-6 sm:p-7 rounded-3xl shadow-xl shadow-emerald-900/5">
                    <div className="w-full flex justify-center custom-clerk-wrapper">
                        <SignUp
                            appearance={{
                                elements: {
                                    rootBox: "w-full",
                                    card: "bg-transparent shadow-none p-0",
                                    headerTitle: "hidden",
                                    headerSubtitle: "hidden",
                                    socialButtonsBlockButton:
                                        "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 hover:border-emerald-300 transition-colors rounded-xl",
                                    socialButtonsBlockButtonText: "font-semibold text-sm text-neutral-900",
                                    formButtonPrimary:
                                        "bg-neutral-900 hover:bg-black text-white shadow-md shadow-neutral-900/15 transition-colors font-semibold text-sm rounded-xl h-12 normal-case",
                                    formFieldInput:
                                        "bg-white border border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl h-12 text-[15px]",
                                    formFieldLabel: "text-xs font-semibold text-neutral-700",
                                    dividerLine: "bg-neutral-200",
                                    dividerText: "text-neutral-500 font-medium",
                                    footerActionText: "text-neutral-600",
                                    footerActionLink: "text-emerald-700 hover:text-emerald-900 font-semibold underline decoration-emerald-200 underline-offset-4",
                                    identityPreviewText: "text-neutral-900",
                                    identityPreviewEditButtonIcon: "text-emerald-700",
                                    formFieldInputShowPasswordButton: "text-neutral-500 hover:text-neutral-900",
                                    formResendCodeLink: "text-emerald-700 hover:text-emerald-900",
                                },
                                variables: {
                                    colorBackground: "#ffffff",
                                    colorText: "#0a0a0a",
                                    colorPrimary: "#0a0a0a",
                                    colorInputText: "#0a0a0a",
                                    colorInputBackground: "#ffffff",
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

                <p className="text-center mt-7 text-sm text-neutral-600">
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className="font-semibold text-emerald-700 hover:text-emerald-900 transition-colors underline decoration-emerald-200 underline-offset-4"
                    >
                        Log in
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
