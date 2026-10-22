import Image from "next/image";
import type { CSSProperties } from "react";

/**
 * A photo that fills its parent (the parent has the size, the rounding and `position: relative`
 * or absolute). Files live in public/v2/creators/photos. `position` is CSS object-position, the
 * crop the mock chose for that photo.
 */
export function Photo({
    name,
    src,
    alt,
    sizes,
    position,
    priority,
}: {
    /** File name in public/v2/creators/photos, e.g. "mika.jpg". Or pass `src` for any other file. */
    name?: string;
    src?: string;
    alt: string;
    sizes: string;
    position?: string;
    priority?: boolean;
}) {
    const style: CSSProperties | undefined = position ? { objectPosition: position } : undefined;
    return <Image src={src ?? `/v2/creators/photos/${name}`} alt={alt} fill sizes={sizes} priority={priority} style={style} />;
}
