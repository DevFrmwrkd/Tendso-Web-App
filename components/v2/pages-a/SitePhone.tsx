import Image from "next/image";
import { Lock } from "lucide-react";

import { PhoneFrame, PhoneStatusBar } from "@/components/v2";

/**
 * A phone showing a long capture of a finished site, scrolling by itself, with the
 * address pill at the bottom (mock: Sub.sitePhone). The capture is 390 wide in the
 * phone; `--travel` is how far it has to go to show the whole page.
 */
export function SitePhone({
    src,
    width,
    height,
    url,
    alt,
    size = "md",
    pw,
    priority,
}: {
    src: string;
    /** Natural size of the capture. */
    width: number;
    height: number;
    url?: string;
    alt: string;
    size?: "sm" | "md" | "lg";
    pw?: number;
    priority?: boolean;
}) {
    const imgH = (390 * height) / width;
    const travel = -Math.max(0, imgH - 790 + 60);
    return (
        <PhoneFrame size={size} width={pw} className="site-phone">
            <PhoneStatusBar />
            <div className="site-scroll">
                <Image src={src} alt={alt} width={width} height={height} sizes="390px" priority={priority} draggable={false} style={{ ["--travel" as string]: `${travel}px` }} />
            </div>
            {url && (
                <div className="url-pill">
                    <Lock size={11} aria-hidden="true" />
                    {url}
                </div>
            )}
        </PhoneFrame>
    );
}
