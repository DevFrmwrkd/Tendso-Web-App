import type { Metadata } from "next";

import { LegalDoc, type LegalSection } from "@/app/privacy-policy/_components/LegalDoc";
import { SUPPORT_EMAIL } from "@/lib/contact";

const TITLE = "Terms of service — Tendso";
const INTRO = "The operational guidelines governing your use of the Tendso Creator Network.";

/**
 * Its own title, description and canonical. The card a shared link shows is
 * built from openGraph, so that is set too: inherited from the root it would
 * describe the homepage and give the homepage as og:url.
 */
export const metadata: Metadata = {
    title: TITLE,
    description: INTRO,
    alternates: { canonical: "/terms-of-service" },
    openGraph: {
        type: "website",
        siteName: "Tendso",
        locale: "en_PH",
        url: "/terms-of-service",
        title: TITLE,
        description: INTRO,
    },
};

/*
 * THE TEXT BELOW IS LEGAL COPY. Round 1 (board Legal) changed how it is laid
 * out: numbered sections, "On this page", the inquiries banner folded in as
 * the last section. Not one word of it.
 *
 * NO "LAST UPDATED" DATE. The board has a slot for one, but these terms have
 * never carried a date and nobody has said what it is, so the line stays off
 * the page rather than shipping a guess. Pass `updated` to LegalDoc once there
 * is one.
 */
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

const sections: LegalSection[] = [
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
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="t-link font-medium">
                        Contact Legal HQ
                    </a>
                </p>
            </>
        ),
    },
];

export default function TermsOfServicePage() {
    return (
        <LegalDoc
            doc="terms"
            title="Terms of service"
            intro={INTRO}
            sections={sections}
            ask="Questions about these terms?"
        />
    );
}
