import type { Metadata } from "next";

import { SUPPORT_EMAIL } from "@/lib/contact";

import { LegalDoc, type LegalSection } from "./_components/LegalDoc";

const TITLE = "Privacy policy — Tendso";
const INTRO = "Your privacy matters to us. How Tendso collects, uses, and protects your personal information.";

/**
 * Its own title, description and canonical. The card a shared link shows is
 * built from openGraph, so that is set too: inherited from the root it would
 * describe the homepage and give the homepage as og:url.
 */
export const metadata: Metadata = {
    title: TITLE,
    description: INTRO,
    alternates: { canonical: "/privacy-policy" },
    openGraph: {
        type: "website",
        siteName: "Tendso",
        locale: "en_PH",
        url: "/privacy-policy",
        title: TITLE,
        description: INTRO,
    },
};

/*
 * THE TEXT BELOW IS LEGAL COPY. Round 1 (board Legal) changed how it is laid
 * out: numbered sections, "On this page", the contact banner folded in as the
 * last section. Not one word of it. Change the words only on purpose, and then
 * change the "Last updated" date with them (section 10 promises that date).
 */
const policySections: LegalSection[] = [
    {
        id: "information-we-collect",
        title: "Information We Collect",
        body: (
            <>
                <p>
                    We collect information that you provide directly to us when using the Tendso app.
                </p>
                <ul className="list-disc space-y-2 pl-5">
                    <li>
                        <strong className="font-semibold text-r1-ink">Account Information:</strong> Name, email address, phone number,
                        password, profile photo, and referral codes provided during registration.
                    </li>
                    <li>
                        <strong className="font-semibold text-r1-ink">Submission Content:</strong> Business photos, video/audio
                        recordings, interview transcriptions, business owner details (name, phone, email), and business
                        information (name, type, address, city).
                    </li>
                    <li>
                        <strong className="font-semibold text-r1-ink">Device &amp; Usage Data:</strong> Device type, operating system,
                        push notification tokens, network connectivity status, and app usage patterns.
                    </li>
                </ul>
            </>
        ),
    },
    {
        id: "how-we-use-your-data",
        title: "How We Use Your Data",
        body: (
            <>
                <p>
                    We use the information we collect to provide, maintain, and improve our services. Specifically, we use
                    your data to:
                </p>
                <ul className="list-disc space-y-2 pl-5">
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
        id: "data-storage-and-security",
        title: "Data Storage & Security",
        body: (
            <>
                <p>
                    We implement industry-standard security measures to protect your personal information:
                </p>
                <ul className="list-disc space-y-2 pl-5">
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
        id: "business-owner-data",
        title: "Business Owner Data",
        body: (
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
        id: "push-notifications",
        title: "Push Notifications",
        body: (
            <>
                <p>
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
        id: "data-retention",
        title: "Data Retention",
        body: (
            <>
                <p>We retain your data according to the following policies:</p>
                <ul className="list-disc space-y-2 pl-5">
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
        id: "your-rights",
        title: "Your Rights",
        body: (
            <>
                <p>
                    Under the Philippine Data Privacy Act of 2012 (RA 10173), you have the following rights:
                </p>
                <ul className="list-disc space-y-2 pl-5">
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
        id: "philippine-dpa-compliance",
        title: "Philippine DPA Compliance",
        body: (
            <p>
                Tendso is committed to complying with Republic Act No. 10173 (Data Privacy Act of 2012) and its
                Implementing Rules and Regulations. We process personal data based on legitimate interest and consent,
                maintain appropriate organizational and technical security measures, and have designated a Data Protection
                Officer to oversee compliance. We ensure all data processing activities are conducted in accordance with
                the principles of transparency, legitimate purpose, and proportionality as mandated by the National
                Privacy Commission.
            </p>
        ),
    },
    {
        id: "open-platform-for-all-ages",
        title: "Open Platform for All Ages",
        body: (
            <p>
                Tendso is open to users of all ages — including students, young entrepreneurs, and anyone who
                wants to help digitize local businesses and earn from it. There are no age restrictions to use the
                platform or register as a Creator. We believe in empowering the next generation of Filipino digital
                entrepreneurs.
            </p>
        ),
    },
    {
        id: "policy-updates",
        title: "Policy Updates",
        body: (
            <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or
                legal requirements. When we make significant changes, we will notify you through the app via push
                notification and update the &quot;Last updated&quot; date at the top of this page. We encourage you to
                review this policy periodically. Continued use of the app after changes constitutes acceptance of the
                updated policy.
            </p>
        ),
    },
    // Was the dark contact banner under the sections ("§ 11 — CONTACT US",
    // "Questions about your data?"). Its question now heads the address in
    // the rail; its sentence and its link are this section.
    {
        id: "contact-us",
        title: "Contact Us",
        body: (
            <>
                <p>
                    If you have any questions about this Privacy Policy or our data practices, reach out directly.
                </p>
                <p>
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="t-link font-medium">
                        {SUPPORT_EMAIL}
                    </a>
                </p>
            </>
        ),
    },
];

export default function PrivacyPolicyPage() {
    return (
        <LegalDoc
            doc="privacy"
            title="Privacy policy"
            intro={INTRO}
            // The page has said "UPDATED FEB 2026" since this text was written.
            updated="February 2026"
            sections={policySections}
            ask="Questions about your data?"
        />
    );
}
