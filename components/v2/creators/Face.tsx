import type { CSSProperties } from "react";

import { initials } from "@/lib/v2/creatorProgram";

/**
 * A round face: the photo when there is one, the person's initials when not. Real recruits have
 * no photo yet, so initials are the normal case; the sample portal uses the face crops in
 * public/v2/creators/faces.
 */
export function Face({ src, name, size = 44, className }: { src?: string | null; name: string; size?: number; className?: string }) {
    const style = { "--sz": `${size}px`, ...(src ? { backgroundImage: `url(${src})` } : {}) } as CSSProperties;
    if (src) return <span className={`cp-g-face ${className ?? ""}`.trim()} style={style} role="img" aria-label={name} />;
    return (
        <span className={`cp-g-face cp-initials ${className ?? ""}`.trim()} style={style} aria-hidden="true">
            {initials(name)}
        </span>
    );
}

/** A square-ish shop photo, or the shop's initials when the API sent no photo. */
export function ShopThumb({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
    const style = { width: size, height: size, borderRadius: size > 36 ? 12 : 10 } as CSSProperties;
    if (src) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img className="pt-shopimg" style={style} src={src} alt="" width={size} height={size} />;
    }
    return (
        <span className="pt-shopimg cp-initials" style={{ ...style, display: "grid", placeItems: "center", fontSize: size * 0.34 }} aria-hidden="true">
            {initials(name)}
        </span>
    );
}
