import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { CreatorsRoot } from "@/components/v2/creators/CreatorsRoot";
import { SoloBar } from "@/components/v2/creators/Chrome";
import { Face } from "@/components/v2/creators/Face";
import { PortalFrame } from "@/components/v2/creators/PortalFrame";
import type { Doc } from "@/convex/_generated/dataModel";
import { affiliatePhotoError } from "@/lib/affiliates";

import { affiliateHref } from "../_lib/navigation";
import styles from "./AffiliatePageFrame.module.css";

const PREVIEW_LINKS = [
    { label: "Home", section: "home" },
    { label: "Links", section: "home" },
    { label: "Agents", section: "referrals" },
    { label: "Shops", section: "sales" },
    { label: "Payouts", section: "wallet" },
] as const;

/** Presentation only. The existing dashboard boundary supplies the verified creator account. */
export function AffiliatePageFrame({ account, preview = false, children }: { account: Doc<"creators">; preview?: boolean; children?: ReactNode }) {
    const name = account.affiliateDisplayName?.trim() || [account.firstName, account.lastName].filter(Boolean).join(" ").trim()
        || (account.affiliateHandle ? `@${account.affiliateHandle}` : "Tendso creator");
    const photo = account.affiliatePhoto && !affiliatePhotoError(account.affiliatePhoto) ? account.affiliatePhoto : null;
    if (!preview) return <CreatorsRoot solo portal>
        <PortalFrame identity={{ name, photo }} currentPage="my-page">{children}</PortalFrame>
    </CreatorsRoot>;

    // The admin sample keeps its protected preview destinations and never opens the real account editor.
    const portalHref = affiliateHref("home", true);
    return <div className={styles.frame}>
        <CreatorsRoot solo portal>
            <SoloBar brandHref={portalHref} right={<span className={styles.identity}><Face src={photo} name={name} size={40} /><span className={styles.name}>{name}</span></span>}>
                <nav className={styles.nav} aria-label="Creator portal">
                    <Link href={affiliateHref("my-page", true)} aria-current="page" className={styles.current}>My page</Link>
                    {PREVIEW_LINKS.map(item => <Link key={item.label} href={affiliateHref(item.section, true)}>{item.label}</Link>)}
                </nav>
            </SoloBar>
            <main className={`wrap ${styles.main}`}>
                <Link className={styles.back} href={portalHref}><ArrowLeft size={18} aria-hidden="true" />Back to portal</Link>
                {children}
            </main>
        </CreatorsRoot>
    </div>;
}
