import { cx } from "@/components/r1";

import { hostOf } from "./featuredSites";
import LiveSitePreview from "./LiveSitePreview";

/**
 * A real site in a browser window (board: Landing, `.la-frame`): three quiet
 * dots and the site's address over a live preview of its page. The address
 * bar is decoration, so it is hidden from screen readers; the caption under the
 * frame names the business.
 */
export default function SiteFrame({ url, name, className }: { url: string; name: string; className?: string }) {
    return (
        <div className={cx("flex flex-col overflow-hidden rounded-r1-card border border-r1-line bg-r1-paper", className)}>
            <div className="flex h-8 flex-none items-center gap-1.5 border-b border-r1-line bg-r1-fill-2 px-3" aria-hidden="true">
                <span className="h-2 w-2 flex-none rounded-full bg-r1-line-2" />
                <span className="h-2 w-2 flex-none rounded-full bg-r1-line-2" />
                <span className="h-2 w-2 flex-none rounded-full bg-r1-line-2" />
                <span className="ml-2 min-w-0 truncate text-xs leading-4 text-r1-ink-3">{hostOf(url)}</span>
            </div>
            <LiveSitePreview url={url} name={name} />
        </div>
    );
}
