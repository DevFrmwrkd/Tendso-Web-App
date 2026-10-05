import type { LucideIcon } from "lucide-react";

/**
 * A lucide icon drawn the Round 1 way: 1.75 stroke, 16px in buttons and rows,
 * 18px in the sidebar. Always decorative; the control around it carries the
 * label (icon-only buttons take an aria-label).
 */
export function Icon({ icon: Glyph, size = 16, className }: { icon: LucideIcon; size?: number; className?: string }) {
    return <Glyph size={size} strokeWidth={1.75} aria-hidden="true" className={className} />;
}
