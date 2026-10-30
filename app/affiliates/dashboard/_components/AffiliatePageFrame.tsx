import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { CreatorsRoot } from "@/components/v2/creators/CreatorsRoot";
import { SoloBar } from "@/components/v2/creators/Chrome";
import { Face } from "@/components/v2/creators/Face";
import type { Doc } from "@/convex/_generated/dataModel";
import { affiliatePhotoError } from "@/lib/affiliates";

import { affiliateHref } from "../_lib/navigation";
import styles from "./AffiliatePageFrame.module.css";

const PORTAL = "/v2/creators/portal";
const PORTAL_LINKS = [
    { label: "Home", anchor: "top", previewSection: "home" },
    { label: "Links", anchor: "pt-links", previewSection: "home" },
    { label: "Agents", anchor: "pt-agents", previewSection: "referrals" },
    { label: "Shops", anchor: "pt-shops", previewSection: "sales" },
    { label: "Payouts", anchor: "pt-pay", previewSection: "wallet" },
] as const;

/** Presentation only. The existing dashboard boundary supplies the verified creator account. */
export function AffiliatePageFrame({ account, preview = false, children }: { account: Doc<"creators">; preview?: boolean; children?: ReactNode }) {
    const name = account.affiliateDisplayName?.trim() || [account.firstName, account.lastName].filter(Boolean).join(" ") || "Tendso creator";
    const photo = account.affiliatePhoto && !affiliatePhotoError(account.affiliatePhoto) ? account.affiliatePhoto : null;
    const portalHref = preview ? affiliateHref("home", true) : PORTAL;
    return <div className={styles.frame}>
        <CreatorsRoot solo portal>
            <SoloBar brandHref={portalHref} right={<span className={styles.identity}><Face src={photo} name={name} size={40} /><span className={styles.name}>{name}</span></span>}>
                <nav className={styles.nav} aria-label="Creator portal">
                    <Link href={affiliateHref("my-page", preview)} aria-current="page" className={styles.current}>My page</Link>
                    {PORTAL_LINKS.map(item => <Link key={item.label} href={preview ? affiliateHref(item.previewSection, true) : `${PORTAL}#${item.anchor}`}>{item.label}</Link>)}
                </nav>
            </SoloBar>
            <main className={`wrap ${styles.main}`}>
                <Link className={styles.back} href={portalHref}><ArrowLeft size={18} aria-hidden="true" />Back to portal</Link>
                {children}
            </main>
        </CreatorsRoot>
    </div>;
}
