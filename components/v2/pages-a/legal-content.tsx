import type { ReactNode } from "react";

import { SUPPORT_EMAIL } from "@/lib/contact";

/*
 * THE TEXT IN THIS FILE IS LEGAL COPY, copied verbatim from app/privacy-policy/page.tsx
 * and app/terms-of-service/page.tsx (the live pages). Only the layout and the class
 * names of the markup differ. Change the words only on purpose, in those pages first;
 * __tests__/v2/legal-text.test.ts compares the two.
 */
export type LegalSection = { id: string; title: string; body: ReactNode };

export const PRIVACY = {
    title: "Privacy policy",
    intro: "Your privacy matters to us. How Tendso collects, uses, and protects your personal information.",
    updated: "February 2026",
    ask: "Questions about your data?",
} as const;

export const TERMS = {
    title: "Terms of service",
    intro: "The operational guidelines governing your use of the Tendso Creator Network.",
    updated: undefined as string | undefined,
    ask: "Questions about these terms?",
} as const;

export const policySections: LegalSection[] = [
    {
        id: "information-we-collect",
        title: "Information We Collect",
        body: (
            <>
                <p>
                    We collect information that you provide directly to us when using the Tendso app.
                </p>
                <ul>
                    <li>
                        <strong>Account Information:</strong> Name, email address, phone number,
                        password, profile photo, and referral codes provided during registration.
                    </li>
                    <li>
                        <strong>Submission Content:</strong> Business photos, video/audio
                        recordings, interview transcriptions, business owner details (name, phone, email), and business
                        information (name, type, address, city).
                    </li>
                    <li>
                        <strong>Device &amp; Usage Data:</strong> Device type, operating system,
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
                <ul>
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
                <ul>
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
                <ul>
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
                <ul>
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
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="lg-mail">
                        {SUPPORT_EMAIL}
                    </a>
                </p>
            </>
        ),
    },
];

const termsSections = [
    {
        id: "acceptance-of-terms",
        title: "Acceptance of Terms",
        content:
            "By accessing or using the Tendso platform (including our mobile app and web portal), you agree to be strictly bound by these Terms of Service. Users of all ages are welcome, including students and young entrepreneurs.",
    },
    {
        id: "creator-certification",
        title: "Creator Certification",
        content:
            "To maintain quality across the platform, Creators must complete the in-app training program and pass the certification quiz with a minimum score of 80% (4 out of 5 correct) before submitting live MSME data to the network.",
    },
    {
        id: "submissions-and-media",
        title: "Submissions & Media",
        content:
            "All data submitted must be authentic and collected with the explicit consent of the business owner. Submissions require a minimum of 3 photos (portrait, location, product) and a valid audio/video interview. Fraudulent data will result in immediate termination.",
    },
    {
        id: "payouts-and-economics",
        title: "Payouts & Economics",
        content:
            "Creators earn 50% of the website sale price (₱500 at the ₱999 minimum price, up to ₱2,500 at the ₱4,999 maximum). Referral bonuses of PHP 1,000 are credited when a referred Creator completes their first paid submission. The minimum withdrawal threshold is PHP 100, processed securely via Wise API direct to local Philippine bank accounts.",
    },
    // The edits promise is advertised on the landing, pricing, About, /my-business,
    // the transactional emails and the knowledge base. It had no home in the Terms,
    // so a business owner reading the legal page found nothing about the service
    // they actually bought. Wording deliberately mirrors the live copy (see
    // components/landing/landingData.ts BUSINESS_TIERS + FAQ_BUSINESS) and promises
    // nothing beyond it — no turnaround time, no revision cap, no post-year-one fee.
    // The domain sentence is here because the ₱1,499 tier DOES leave the owner with
    // a yearly cost: our own renewal reminder (lib/email/templates.ts,
    // getDomainRenewalReminderEmailHtml) tells them Tendso paid year 1 and "Year 2
    // onwards is your responsibility". A blanket "no recurring fee" would contradict
    // the email we send them, so the no-recurring-fee promise is scoped to the site.
    // No renewal figure is quoted — lib/pricing.ts defines none, and the only number
    // that exists anywhere ("around 500 to 1200 PHP", templates.ts:1024) is a soft,
    // registrar-dependent range that has no business on a legal page.
    //
    // Every clause of the domain sentence is sourced:
    //   • one year, included in the price — convex/lib/hostinger.ts registerDomain
    //     ("Register a domain for 1 year", expiresAt = +365d) bought on Tendso's
    //     saved card by domains.setupForSubmission at mark-paid (convex/domains.ts:509).
    //   • held on TENDSO's registrar account, not the owner's — registerDomain sends
    //     one Hostinger WHOIS profile id as owner_id/admin_id/billing_id/tech_id
    //     (convex/lib/hostinger.ts:409-419). The owner's name is on no contact role.
    //     This was previously MISSING from the page and its absence made the old
    //     "the domain is yours to renew, paid to the registrar" sentence false: the
    //     owner has no registrar account and no standing to renew it directly.
    //   • auto-renew off by design — convex/domains.ts:531-541 disables it on the
    //     subscription right after purchase. Deliberately not phrased as "it will
    //     never renew": that call is best-effort and its failure is caught and
    //     audit-logged (:543-557), so the promise made is the one that holds either
    //     way — nothing is billed to the OWNER, who has no card on file with us.
    //   • ~30-day reminder, then lapse — convex/domains.ts:518-528 schedules
    //     sendDomainRenewalReminderEmailAction at expiresAt − 30d; the email says the
    //     domain is lost and the site unreachable if it is not renewed (templates.ts:1021).
    //   • renew-for-you and help-transferring-out — both are offers that email
    //     already makes verbatim (templates.ts:1028 "reply to this email and our team
    //     will renew … on your behalf"; :1030 "need help transferring the domain to
    //     your own account, just reply"). No code implements a transfer, so the page
    //     says they are handled by hand over email and promises no mechanism.
    {
        id: "your-website-edits-and-hosting",
        title: "Your Website, Edits & Hosting",
        content:
            "Your one-time payment covers building your website and putting it live. For one year from the day your site goes live, edits are free — you contact Tendso through the Contact page, tell us what you want changed, and we make the change for you. There is no editor for you to learn and nothing to install. After that first year, edits are no longer included; nothing is charged automatically for the website, as we keep no card on file and the website carries no recurring fee. If you bought a custom domain, its first year of registration is included in what you paid and Tendso buys it for you; that registration is held on Tendso's own registrar account, under Tendso's registrant, administrative, billing and technical contact details, not in your name. Auto-renew is switched off deliberately, so the domain is not extended automatically and no renewal is ever charged to you. Around 30 days before it expires we email you a reminder, and if it is not renewed the registration lapses and your site stops being reachable at that address. You can reply to that reminder and ask us to renew it for you, or ask us to help move the domain into a registrar account of your own — both are handled by our team over email; there is no automated transfer. Hosting with SSL is included at no monthly cost, though we cannot guarantee uninterrupted availability.",
    },
    {
        id: "intellectual-property",
        title: "Intellectual Property",
        content:
            "By uploading media to Tendso, you grant us a worldwide, non-exclusive license to use, display, transcribe (via AI), and deploy the content to generate websites for the respective businesses.",
    },
    {
        id: "prohibited-conduct-and-law",
        title: "Prohibited Conduct & Law",
        content:
            "Manipulating the referral system, uploading AI-generated fake stores, or harassing business owners is strictly prohibited. These Terms are governed by the laws of the Republic of the Philippines. Any disputes will be resolved in Philippine jurisdictions.",
    },
];

export const termsDocSections: LegalSection[] = [
    ...termsSections.map((s) => ({ id: s.id, title: s.title, body: <p>{s.content}</p> })),
    // Was the dark banner under the sections ("INQUIRY — LEGAL HQ", "Legal
    // inquiries?"). Its sentence and its button are this section; the address
    // is in the rail.
    {
        id: "legal-inquiries",
        title: "Legal Inquiries",
        body: (
            <>
                <p>Reach out for clarifications on payout structures, intellectual property, or terms.</p>
                <p>
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="lg-mail">
                        Contact Legal HQ
                    </a>
                </p>
            </>
        ),
    },
];
