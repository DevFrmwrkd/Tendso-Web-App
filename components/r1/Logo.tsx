import Image from "next/image";

import { cx } from "./cx";

/**
 * The Tendso wordmark. The file is white lettering on transparency (drawn for
 * dark grounds); `.t-logo` inverts it to ink for the white Round 1 ground.
 */
export function Logo({ height = 18, className, priority = false }: { height?: number; className?: string; priority?: boolean }) {
    return (
        <Image
            src="/tendso-logo.png"
            alt="Tendso"
            width={Math.round(height * 5.6)}
            height={height}
            className={cx("t-logo", className)}
            style={{ height }}
            priority={priority}
        />
    );
}
