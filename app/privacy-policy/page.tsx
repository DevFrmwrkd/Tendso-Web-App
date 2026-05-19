"use client";

import { motion } from "framer-motion";
import {
    ShieldAlert,
    Fingerprint,
    Lock,
    Database,
    FileText,
    Bell,
    Clock,
    Scale,
    BookOpen,
    AlertTriangle,
    MessageSquare,
} from "lucide-react";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollToTop from "@/components/landing/ScrollToTop";

const policySections = [
    {
        marker: "§ 01",
        icon: Database,
        title: "Information We Collect",
        content: (
            <>
                <p className="mb-4">
                    We collect information that you provide directly to us when using the Negosyo Digital app.
                </p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>
                        <strong className="text-[var(--ink)]">Account Information:</strong> Name, email address, phone number,
                        password, profile photo, and referral codes provided during registration.
                    </li>
                    <li>
                        <strong className="text-[var(--ink)]">Submission Content:</strong> Business photos, video/audio
                        recordings, interview transcriptions, business owner details (name, phone, email), and business
                        information (name, type, address, city).
                    </li>
                    <li>
                        <strong className="text-[var(--ink)]">Device &amp; Usage Data:</strong> Device type, operating system,
                        push notification tokens, network connectivity status, and app usage patterns.
                    </li>
                </ul>
            </>
        ),
    },
    {
        marker: "§ 02",
        icon: Fingerprint,
        title: "How We Use Your Data",
        content: (
            <>
                <p className="mb-4">
                    We use the information we collect to provide, maintain, and improve our services. Specifically, we use
                    your data to:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>Process and manage business submissions</li>
                    <li>Generate AI-enhanced websites for digitized businesses</li>
                    <li>Process creator payouts via Wise bank transfers</li>
                    <li>Send push notifications about submission status updates</li>
                    <li>Transcribe video and audio interviews using AI</li>
                    <li>Track referrals and calculate referral bonuses</li>
                    <li>Provide customer support and respond to inquiries</li>
                    <li>Monitor app performance and usage analytics</li>
                </ul>
            </>
        ),
    },
    {
        marker: "§ 03",
        icon: Lock,
        title: "Data Storage & Security",
        content: (
            <>
                <p className="mb-4">
                    We implement industry-standard security measures to protect your personal information:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>Authentication tokens stored securely via Expo SecureStore</li>
                    <li>Encrypted data transmission for all API communications</li>
                    <li>Secure file uploads via presigned URLs</li>
                    <li>Server-side data validation and sanitization</li>
                    <li>Role-based access controls for administrative functions</li>
                    <li>Regular security audits and vulnerability assessments</li>
                </ul>
            </>
        ),
    },
    {
        marker: "§ 04",
        icon: FileText,
        title: "Business Owner Data",
        content: (
            <p>
                When creators submit business information, they collect data about business owners including name, phone
                number, optional email, business name, type, address, and city. This data is used to generate a
                professional website for the business and create lead records. Business owners are contacted via the
                information provided to verify and manage their generated websites. Photos, videos, and audio recordings
                of the business are stored securely and processed through our AI content pipeline.
            </p>
        ),
    },
    {
        marker: "§ 05",
        icon: Bell,
        title: "Push Notifications",
        content: (
            <>
                <p className="mb-4">
                    We use Expo Push Notifications to keep you informed about important updates. You may receive
                    notifications for: submission status changes (approved, rejected, deployed), payout confirmations and
                    withdrawal updates, new lead alerts from generated websites, and system announcements.
                </p>
                <p>
                    You can manage notification preferences through your device settings. Push notification tokens are
                    stored securely and deactivated when invalid.
                </p>
            </>
        ),
    },
    {
        marker: "§ 06",
        icon: Clock,
        title: "Data Retention",
        content: (
            <>
                <p className="mb-4">We retain your data according to the following policies:</p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>Active account data is retained for the lifetime of your account</li>
                    <li>Submission content is retained indefinitely to maintain generated websites</li>
                    <li>Local form draft caches expire after 7 days automatically</li>
                    <li>Financial records (earnings, withdrawals) are retained as required by Philippine tax law</li>
                    <li>Deleted accounts: personal data removed within 30 days; anonymized analytics retained</li>
                </ul>
            </>
        ),
    },
    {
        marker: "§ 07",
        icon: Scale,
        title: "Your Rights",
        content: (
            <>
                <p className="mb-4">
                    Under the Philippine Data Privacy Act of 2012 (RA 10173), you have the following rights:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>Right to be informed about how your data is collected and processed</li>
                    <li>Right to access your personal data held by us</li>
                    <li>Right to object to data processing activities</li>
                    <li>Right to erasure or blocking of personal data</li>
                    <li>Right to rectify inaccurate or incomplete data</li>
                    <li>Right to data portability in a structured, machine-readable format</li>
                </ul>
            </>
        ),
    },
    {
        marker: "§ 08",
        icon: BookOpen,
        title: "Philippine DPA Compliance",
        content: (
            <p>
                Negosyo Digital is committed to complying with Republic Act No. 10173 (Data Privacy Act of 2012) and its
                Implementing Rules and Regulations. We process personal data based on legitimate interest and consent,
                maintain appropriate organizational and technical security measures, and have designated a Data Protection
                Officer to oversee compliance. We ensure all data processing activities are conducted in accordance with
                the principles of transparency, legitimate purpose, and proportionality as mandated by the National
                Privacy Commission.
            </p>
        ),
    },
    {
        marker: "§ 09",
        icon: AlertTriangle,
        title: "Open Platform for All Ages",
        content: (
            <p>
                Negosyo Digital is open to users of all ages — including students, young entrepreneurs, and anyone who
                wants to help digitize local businesses and earn from it. There are no age restrictions to use the
                platform or register as a Creator. We believe in empowering the next generation of Filipino digital
                entrepreneurs.
            </p>
        ),
    },
    {
        marker: "§ 10",
        icon: MessageSquare,
        title: "Policy Updates",
        content: (
            <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or
                legal requirements. When we make significant changes, we will notify you through the app via push
                notification and update the &quot;Last updated&quot; date at the top of this page. We encourage you to
                review this policy periodically. Continued use of the app after changes constitutes acceptance of the
                updated policy.
            </p>
        ),
    },
];

export default function PrivacyPolicy() {
    return (
        <div
            className="min-h-screen overflow-x-hidden"
            style={{ background: "var(--khaki)", color: "var(--ink)" }}
        >
            <Navbar />

            {/* Paper grain texture */}
            <div
                className="fixed inset-0 z-0 pointer-events-none opacity-[0.04] mix-blend-multiply"
                style={{
                    backgroundImage:
                        "radial-gradient(circle at 25% 25%, var(--ink) 0.5px, transparent 1px), radial-gradient(circle at 75% 75%, var(--ink) 0.5px, transparent 1px)",
                    backgroundSize: "4px 4px, 6px 6px",
                }}
            />
            <div className="fixed top-0 right-[10%] w-[40%] h-[40%] bg-[var(--rust)]/8 rounded-full filter blur-[180px] pointer-events-none" />

            <main className="relative z-10 w-full pt-40 sm:pt-48 pb-24 sm:pb-32 px-6 max-w-5xl mx-auto flex flex-col items-center">
                {/* HEADER */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center w-full mb-14 sm:mb-20"
                >
                    {/* Section marker */}
                    <div className="flex items-center gap-3 justify-center mb-8">
                        <span className="h-px w-12 bg-[var(--rust)]/40" />
                        <p
                            className="text-[10px] sm:text-[11px] uppercase tracking-[0.45em] font-medium text-[var(--rust)]"
                            style={{ fontFamily: "var(--font-mono)" }}
                        >
                            § DOC — PRIVACY · UPDATED FEB 2026
                        </p>
                        <span className="h-px w-12 bg-[var(--rust)]/40" />
                    </div>

                    <div className="mb-7 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--khaki-deep)] border border-[var(--ink)]/15 shadow-md shadow-[var(--rust)]/10">
                        <ShieldAlert className="w-8 h-8 text-[var(--rust)]" />
                    </div>

                    <h1
                        className="font-bold leading-[0.92] tracking-[-0.02em] text-[var(--ink)] mb-6"
                        style={{
                            fontFamily: "var(--font-playfair)",
                            fontSize: "clamp(3rem, 9vw, 7rem)",
                        }}
                    >
                        Privacy <br />
                        <span className="italic" style={{ color: "var(--rust)" }}>policy.</span>
                    </h1>
                    <p
                        className="italic text-[var(--ink)]/65 max-w-2xl mx-auto leading-relaxed"
                        style={{
                            fontFamily: "var(--font-playfair)",
                            fontSize: "clamp(1.1rem, 1.6vw, 1.4rem)",
                        }}
                    >
                        Your privacy matters to us. How Negosyo Digital collects, uses, and protects your personal information.
                    </p>

                    <div className="w-px h-16 bg-gradient-to-b from-[var(--rust)] to-transparent mx-auto mt-12" aria-hidden />
                </motion.div>

                {/* CONTENT SECTIONS */}
                <div className="w-full space-y-5">
                    {policySections.map((section, idx) => {
                        const Icon = section.icon;
                        return (
                            <motion.section
                                key={idx}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ delay: idx * 0.04, duration: 0.5 }}
                                className="group p-7 sm:p-10 rounded-[1.75rem] bg-[var(--khaki-deep)] border border-[var(--ink)]/15 hover:border-[var(--rust)]/50 transition-all hover:shadow-xl hover:shadow-[var(--ink)]/10"
                            >
                                <div className="flex flex-col sm:flex-row gap-5 sm:gap-7 items-start">
                                    <div className="p-3.5 bg-[var(--khaki)] border border-[var(--ink)]/15 rounded-2xl shrink-0">
                                        <Icon className="w-6 h-6 text-[var(--rust)]" />
                                    </div>
                                    <div className="w-full min-w-0">
                                        <p
                                            className="text-[10px] uppercase tracking-[0.4em] font-medium text-[var(--rust)] mb-2"
                                            style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                            {section.marker}
                                        </p>
                                        <h3
                                            className="text-2xl sm:text-3xl font-bold text-[var(--ink)] tracking-[-0.01em] mb-4 leading-tight"
                                            style={{ fontFamily: "var(--font-playfair)" }}
                                        >
                                            {section.title}
                                        </h3>
                                        <div className="text-[var(--ink)]/75 text-[15px] sm:text-base leading-relaxed">
                                            {section.content}
                                        </div>
                                    </div>
                                </div>
                            </motion.section>
                        );
                    })}
                </div>

                {/* CONTACT BANNER */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="w-full mt-20 p-10 sm:p-14 rounded-[2rem] bg-[var(--ink)] text-[var(--khaki)] text-center relative overflow-hidden"
                >
                    <div className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-[var(--rust)]/20 rounded-full blur-[140px] pointer-events-none" aria-hidden />
                    <div className="absolute -bottom-32 -left-20 w-[400px] h-[400px] bg-[var(--rust-soft)]/15 rounded-full blur-[140px] pointer-events-none" aria-hidden />

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="flex items-center gap-3 justify-center mb-6">
                            <span className="h-px w-10 bg-[var(--rust-soft)]/50" />
                            <p
                                className="text-[10px] uppercase tracking-[0.45em] font-medium text-[var(--rust-soft)]"
                                style={{ fontFamily: "var(--font-mono)" }}
                            >
                                § 11 — CONTACT US
                            </p>
                            <span className="h-px w-10 bg-[var(--rust-soft)]/50" />
                        </div>

                        <h3
                            className="font-bold tracking-[-0.01em] mb-5"
                            style={{
                                fontFamily: "var(--font-playfair)",
                                fontSize: "clamp(2rem, 4vw, 3rem)",
                            }}
                        >
                            Questions about <span className="italic" style={{ color: "var(--rust-soft)" }}>your data?</span>
                        </h3>
                        <p
                            className="italic text-[var(--khaki)]/70 mb-8 max-w-xl mx-auto leading-relaxed"
                            style={{
                                fontFamily: "var(--font-playfair)",
                                fontSize: "clamp(1.05rem, 1.5vw, 1.25rem)",
                            }}
                        >
                            If you have any questions about this Privacy Policy or our data practices, reach out directly.
                        </p>
                        <a
                            href="mailto:frmwrkd.media@gmail.com"
                            className="inline-flex items-center gap-2 bg-[var(--rust)] hover:bg-[var(--rust-soft)] text-[var(--khaki)] px-8 py-4 rounded-full font-semibold text-base transition-colors"
                        >
                            frmwrkd.media@gmail.com
                        </a>
                    </div>
                </motion.div>
            </main>

            <Footer />
            <ScrollToTop />
        </div>
    );
}
