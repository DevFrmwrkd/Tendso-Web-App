import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import { cx } from "./cx";
import { PhoneScreen } from "./PhoneScreen";

export type PhoneSize = "sm" | "md" | "lg";

/** iOS-style status bar, authored at 390 wide. `dark` = light glyphs for dark screens. */
export function PhoneStatusBar({ dark = false }: { dark?: boolean }) {
    return (
        <div className={cx("v2-sb", dark && "v2-sb--dark")} aria-hidden="true">
            <span>9:41</span>
            <span className="v2-sb-icons">
                <svg width="18" height="12" viewBox="0 0 18 12">
                    <rect x="0" y="8" width="3" height="4" rx="1" />
                    <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
                    <rect x="10" y="3" width="3" height="9" rx="1" />
                    <rect x="15" y="0" width="3" height="12" rx="1" />
                </svg>
                <svg width="16" height="12" viewBox="0 0 16 12">
                    <path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8 1 10.2 10.2 0 0 0 .9 3.8L2 5a8.6 8.6 0 0 1 6-2.4Zm0 3.3c1.4 0 2.7.5 3.7 1.4l1.1-1.2A7 7 0 0 0 8 4.3 7 7 0 0 0 3.2 6.1l1.1 1.2c1-.9 2.3-1.4 3.7-1.4Zm0 3.3c-.6 0-1.1.2-1.5.6L8 11.3l1.5-1.5c-.4-.4-.9-.6-1.5-.6Z" />
                </svg>
                <svg width="27" height="13" viewBox="0 0 27 13">
                    <rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4" />
                    <rect x="2" y="2" width="20" height="9" rx="2" />
                    <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" opacity=".45" />
                </svg>
            </span>
        </div>
    );
}

/**
 * Web phone mock for the landing hero and steps. Proportions are the mock's: body
 * padding 3.1%, outer radius 15.5%, screen radius 12.6%, island 31% x 3.55%, three
 * side buttons, 390:844 screen. All of it scales with the phone's own width.
 *
 * Give it either `image` (a captured mobile site, shown under a status bar and
 * cropped from the top; `bg` is the site's top colour, `dark` flips the status
 * glyphs to white) or `children` authored at 390 x 844.
 */
export function PhoneFrame({
    size = "md",
    width,
    theme = "light",
    image,
    priority,
    className,
    children,
}: {
    size?: PhoneSize;
    /** Pixel width, overrides `size`. */
    width?: number;
    theme?: "light" | "dark";
    image?: { src: string; alt: string; bg?: string; dark?: boolean };
    priority?: boolean;
    className?: string;
    children?: ReactNode;
}) {
    const style = width ? ({ "--pw": `${width}px`, "--s": ((width * 0.938) / 390).toFixed(5) } as CSSProperties) : undefined;
    const sizes = `${width ?? { sm: 220, md: 300, lg: 360 }[size]}px`;
    return (
        <div className={cx("v2-phone", !width && `v2-phone--${size}`, className)} data-theme={theme} style={style}>
            <div className="v2-phone-body">
                <div className="v2-phone-btn v2-phone-btn--a" />
                <div className="v2-phone-btn v2-phone-btn--b" />
                <div className="v2-phone-btn v2-phone-btn--c" />
                <PhoneScreen>
                    {image ? (
                        <div className="v2-screen-root" style={{ background: image.bg }}>
                            <PhoneStatusBar dark={image.dark} />
                            <div className="v2-phone-page">
                                <Image src={image.src} alt={image.alt} fill sizes={sizes} priority={priority} />
                            </div>
                        </div>
                    ) : (
                        <div className="v2-screen-root">{children}</div>
                    )}
                    <div className="v2-phone-island" />
                </PhoneScreen>
            </div>
        </div>
    );
}
