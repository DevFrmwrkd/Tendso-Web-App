import { SAMPLE_PICTURES, SAMPLE_PORTAL } from "@/lib/v2/creatorSample";

import { Face } from "./Face";
import { PortalView } from "./PortalView";

const NAV = ["Home", "Links", "Agents", "Shops", "Payouts"];

/**
 * "What your portal looks like": the real portal layout (PortalView) drawn with sample data inside
 * a frame, badged Sample, so a creator sees exactly what they would get. Mika Santos is made up.
 */
export function SamplePortal() {
    return (
        <div className="cp-sample" role="group" aria-label="Sample portal. Sample data, not a real account.">
            <div className="cp-sample-bar">
                <span className="brand">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/v2/brand/mark-ink-256.png" alt="" width={26} height={26} />
                    tendso
                </span>
                <nav className="pt-nav" aria-hidden="true">
                    {NAV.map((n, i) => (
                        // No href on purpose: this is a picture of the portal's menu, not a menu.
                        <a key={n} className={i === 0 ? "is-on" : undefined}>
                            {n}
                        </a>
                    ))}
                </nav>
                <div className="cp-bar-r">
                    <span className="cp-sample-badge">Sample</span>
                    <span className="pt-me">
                        <Face src={SAMPLE_PICTURES.creator} name="Mika Santos" size={40} />
                        <span>Mika Santos</span>
                    </span>
                </div>
            </div>
            <div className="cp-sample-body">
                <div className="pt-main">
                    <div className="pt-hi">
                        <div>
                            <h1>Hi, Mika.</h1>
                            <p>Here is October so far. Sample data.</p>
                        </div>
                        <span className="pt-month">October 2026</span>
                    </div>
                    <PortalView data={SAMPLE_PORTAL} pictures={SAMPLE_PICTURES} sample idPrefix="sample" payoutTo="mika.santos@gmail.com" />
                </div>
            </div>
        </div>
    );
}
