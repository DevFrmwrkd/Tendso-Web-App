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
    icon: Database,
    title: "1. Information We Collect",
    content: (
      <>
        <p className="mb-4">
          We collect information that you provide directly to us when using the Negosyo Digital app.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-neutral-900">Account Information:</strong> Name, email address, phone number,
            password, profile photo, and referral codes provided during registration.
          </li>
          <li>
            <strong className="text-neutral-900">Submission Content:</strong> Business photos, video/audio
            recordings, interview transcriptions, business owner details (name, phone, email), and business
            information (name, type, address, city).
          </li>
          <li>
            <strong className="text-neutral-900">Device &amp; Usage Data:</strong> Device type, operating system,
            push notification tokens, network connectivity status, and app usage patterns.
          </li>
        </ul>
      </>
    ),
  },
  {
    icon: Fingerprint,
    title: "2. How We Use Your Data",
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
    icon: Lock,
    title: "3. Data Storage & Security",
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
    icon: FileText,
    title: "4. Business Owner Data",
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
    icon: Bell,
    title: "5. Push Notifications",
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
    icon: Clock,
    title: "6. Data Retention",
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
    icon: Scale,
    title: "7. Your Rights",
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
    icon: BookOpen,
    title: "8. Philippine DPA Compliance",
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
    icon: AlertTriangle,
    title: "9. Open Platform for All Ages",
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
    icon: MessageSquare,
    title: "10. Policy Updates",
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
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-emerald-500 selection:text-white overflow-x-hidden">
      <Navbar />

      {/* Soft ambient wash */}
      <div className="fixed top-0 right-[10%] w-[40%] h-[40%] bg-emerald-50 rounded-full filter blur-[180px] opacity-70 pointer-events-none" />

      <main className="relative z-10 w-full pt-36 sm:pt-44 pb-24 sm:pb-32 px-6 max-w-5xl mx-auto flex flex-col items-center">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center w-full mb-14 sm:mb-20"
        >
          <div className="mb-7 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-md shadow-emerald-500/10">
            <ShieldAlert className="w-8 h-8 text-emerald-700" />
          </div>

          <p className="text-xs uppercase tracking-widest font-bold text-emerald-700 mb-3">
            Last updated · February 2026
          </p>
          <h1
            style={{ fontFamily: "var(--font-fraunces)" }}
            className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-neutral-900 leading-[1.05] mb-5"
          >
            Privacy <span className="italic text-emerald-700">policy.</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-neutral-700 max-w-2xl mx-auto leading-relaxed">
            Your privacy matters to us. This policy explains how Negosyo Digital collects, uses, and protects your
            personal information.
          </p>

          <div className="w-px h-16 bg-gradient-to-b from-emerald-400 to-transparent mx-auto mt-10" aria-hidden />
        </motion.div>

        {/* CONTENT SECTIONS */}
        <div className="w-full grid gap-6 sm:gap-8">
          {policySections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <motion.section
                key={idx}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: idx * 0.05, duration: 0.5 }}
                className="group p-7 sm:p-9 rounded-3xl bg-white border border-neutral-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-900/5 transition-all"
              >
                <div className="flex flex-col sm:flex-row gap-5 sm:gap-7 items-start">
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl shrink-0">
                    <Icon className="w-6 h-6 text-emerald-700" />
                  </div>
                  <div className="w-full min-w-0">
                    <h3
                      style={{ fontFamily: "var(--font-fraunces)" }}
                      className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 text-neutral-900 group-hover:text-emerald-800 transition-colors leading-tight"
                    >
                      {section.title}
                    </h3>
                    <div className="text-neutral-700 text-[15px] sm:text-base leading-relaxed">
                      {section.content}
                    </div>
                  </div>
                </div>
              </motion.section>
            );
          })}
        </div>

        {/* 11. CONTACT US BANNER */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="w-full mt-16 sm:mt-20 p-8 sm:p-12 rounded-[2rem] bg-neutral-900 text-white text-center relative overflow-hidden flex flex-col items-center"
        >
          <div
            className="absolute inset-0 opacity-[0.15] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at center, #d1fae5 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
            aria-hidden
          />
          <div className="absolute -top-20 -right-20 w-[320px] h-[320px] bg-emerald-500/20 rounded-full filter blur-[120px] pointer-events-none" aria-hidden />

          <h3
            style={{ fontFamily: "var(--font-fraunces)" }}
            className="relative z-10 text-3xl sm:text-4xl font-semibold mb-3"
          >
            11. Contact us
          </h3>
          <p className="relative z-10 text-white/75 text-base sm:text-lg mb-7 max-w-xl mx-auto leading-relaxed">
            If you have any questions about this Privacy Policy or our data practices, please reach out directly.
          </p>
          <a
            href="mailto:frmwrkd.media@gmail.com"
            className="relative z-10 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 px-7 py-4 rounded-full font-semibold text-base sm:text-lg transition-transform hover:scale-[1.02] shadow-xl shadow-emerald-500/30 min-h-[52px]"
          >
            frmwrkd.media@gmail.com
          </a>
        </motion.div>
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  );
}
