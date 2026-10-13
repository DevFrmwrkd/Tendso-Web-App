import Link from "next/link";

import { cx } from "@/components/r1";
import { CoBrandLockup } from "./Stage";

/**
 * The giveaway application's header: the OTR × Tendso band from the poster,
 * over the ordinary /start form. OTR gives the website and Tendso provides it,
 * so both names stay in view through intake.
 */
export function CampaignHeader({ exit, className }: {
    exit?: { href: string; label: string };
    className?: string;
}) {
    return (
        <header className={cx("gw-appbar", className)}>
            <CoBrandLockup />
            <div className="gw-appbar-end">
                <span className="gw-pill">Giveaway application</span>
                {exit ? <Link href={exit.href} className="gw-exit">{exit.label}</Link> : null}
            </div>
        </header>
    );
}
