import Image from "next/image";
import Link from "next/link";

import { ButtonLink, cx } from "@/components/r1";

/** OTR gives the website; Tendso provides it. Keep that identity through intake. */
export function CampaignHeader({ exit, className }: {
    exit?: { href: string; label: string };
    className?: string;
}) {
    return (
        <header className={cx("t-pub-head", className)}>
            <Link href="/100-pages-giveaway" className="flex min-w-0 items-center gap-2.5" aria-label="Off the Record website giveaway">
                <Image src="/otr-mark.png" alt="" width={459} height={504} priority className="h-8 w-auto flex-none" />
                <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-semibold leading-4 text-r1-ink sm:text-base">Off the Record</span>
                    <span className="font-r1-mono text-[9px] uppercase leading-3 tracking-[0.08em] text-r1-ink-2 sm:text-[10px]">Website giveaway</span>
                </span>
            </Link>
            {exit ? (
                <ButtonLink variant="ghost" href={exit.href} className="shrink-0 max-sm:px-2 max-sm:text-xs">{exit.label}</ButtonLink>
            ) : (
                <span className="text-right text-[10px] leading-4 text-r1-ink-2 sm:text-xs">Websites by<br /><Link href="/" className="font-semibold text-r1-ink">Tendso</Link></span>
            )}
        </header>
    );
}
