import { cx } from "./cx";

/**
 * Two letters, first and last name. "Angel S." gives "AS": the initials follow
 * what is shown.
 */
export function initialsOf(name: string | null | undefined): string {
    const words = (name ?? "")
        .replace(/[^\p{L}\p{N}\s.'-]/gu, " ")
        .split(/\s+/)
        .filter(Boolean);
    if (words.length === 0) return "?";
    const first = words[0].charAt(0);
    const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
}

/** Initials only this round. */
export function Avatar({ name, size = "sm", className }: { name: string | null | undefined; size?: "sm" | "lg"; className?: string }) {
    return (
        <span className={cx("t-avatar", size === "lg" && "t-avatar-lg", className)} aria-hidden="true">
            {initialsOf(name)}
        </span>
    );
}
