import type { Ref } from "react";

import { Highlight, Logo, cx } from "@/components/r1";
import { OPERATOR } from "@/lib/contact";

/**
 * The creator certificate, drawn ONCE (board Account, "Your certificate").
 *
 * It used to be three hand-copied cards (Profile, Notifications and the quiz's
 * pass screen) that had already started to drift apart. Now Account shows it
 * in <CertificateDialog>, the end of Certification (/pending, the moment the
 * approval lands) shows it in place, and both save the same node as a PNG.
 *
 * Plain markup and tokens only: html-to-image copies this node's computed
 * styles into the image, so what is on screen is exactly what gets saved.
 */
export function Certificate({
    name,
    issued,
    ref,
    className,
}: {
    /** The creator's full name, as it should read on the certificate. */
    name: string;
    /** "April 2026", from issuedOn(certifiedAt). */
    issued: string;
    /** The node that gets saved as the PNG (see useCertificateDownload). */
    ref?: Ref<HTMLDivElement>;
    className?: string;
}) {
    return (
        <Highlight
            ref={ref}
            role="img"
            aria-label={`Certificate of completion. Certified creator: ${name}. Issued ${issued} by Tendso.`}
            className={cx("flex flex-col items-center gap-3 px-5 pb-6 pt-7 text-center sm:px-7", className)}
        >
            <Logo height={20} />
            <span className="t-label t-hl-label">Certificate of completion</span>
            <span className="text-[20px] font-semibold leading-[26px] text-r1-ink">Certified creator</span>
            <span className="h-px w-8 bg-r1-ink" aria-hidden="true" />
            <span className="t-meta">This certifies that</span>
            <span className="text-2xl font-semibold leading-[30px] tracking-[-0.01em] text-r1-ink [overflow-wrap:anywhere]">{name}</span>
            <p className="t-body max-w-[320px]">
                has shown proficiency in Local Business Digitization and is authorized to provide verified digital services to MSMEs in the
                Philippines.
            </p>
            <span className="flex flex-col gap-0.5 pt-1">
                <span className="t-label">Date issued</span>
                <span className="text-sm font-semibold text-r1-ink">{issued}</span>
            </span>
            <span className="t-meta">Issued by Tendso · {OPERATOR}</span>
        </Highlight>
    );
}

/** The name on the certificate: first and last name, as every copy printed it before. */
export function certificateName(firstName?: string | null, lastName?: string | null): string {
    return `${firstName || ""} ${lastName || ""}`.trim() || "Creator";
}

/** "April 2026": the month the Tendso team approved the creator (certifiedAt). */
export function issuedOn(certifiedAt: number): string {
    return new Date(certifiedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
