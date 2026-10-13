import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The giveaway's poster ground (app/giveaway.css): OTR black across the top,
 * Tendso gold across the bottom, one screen tall. The header names both
 * brands, since OTR gives the website and Tendso builds it.
 */
export function GiveawayStage({ live = false, closed = false, children }: { live?: boolean; closed?: boolean; children: ReactNode }) {
    return (
        <div className={closed ? "gw is-closed" : "gw"}>
            <div className="gw-layer gw-rays" aria-hidden="true" />
            <div className="gw-dots is-left" aria-hidden="true" />
            <div className="gw-dots is-right" aria-hidden="true" />
            <div className="gw-layer gw-band-otr" aria-hidden="true" />
            <div className="gw-layer gw-band-stripe" aria-hidden="true" />
            <div className="gw-layer gw-band-gold" aria-hidden="true" />
            <div className="gw-inner">
                <header className="gw-head">
                    <Link href="/100-pages-giveaway" className="gw-lockup" aria-label="Off the Record × Tendso website giveaway">
                        <Image src="/otr-mark.png" alt="" width={459} height={504} priority className="h-[26px] w-auto invert md:h-[34px]" />
                        <span className="gw-lockup-name md:hidden">OTR</span>
                        <span className="gw-lockup-name max-md:hidden">Off the Record</span>
                        <span className="gw-x" aria-hidden="true">×</span>
                        <Image src="/tendso-logo.png" alt="" width={298} height={70} priority className="h-[17px] w-auto md:h-6" />
                    </Link>
                    {live && <span className="gw-pill"><span className="max-md:hidden">Official giveaway ·</span> Live</span>}
                </header>
                <main id="main" className="gw-main">
                    {children}
                </main>
            </div>
        </div>
    );
}

/** "Presented by Off the Record × Tendso", under the banner. */
export function PresentedBy() {
    return (
        <p className="gw-chip">
            <span className="gw-chip-label">Presented by</span>
            <Image src="/otr-mark.png" alt="" width={459} height={504} className="h-4 w-auto md:h-5" />
            Off the Record
            <span className="gw-x" aria-hidden="true">×</span>
            <Image src="/tendso-logo.png" alt="Tendso" width={298} height={70} className="h-[13px] w-auto invert md:h-[17px]" />
        </p>
    );
}
