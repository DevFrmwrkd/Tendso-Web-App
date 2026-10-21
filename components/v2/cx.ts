/** Join class names, skipping falsy values. Tiny on purpose: v2 classes are plain strings. */
export function cx(...parts: Array<string | false | null | undefined>): string {
    return parts.filter(Boolean).join(" ");
}
