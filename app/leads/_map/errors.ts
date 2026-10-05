/**
 * The human part of a Convex error ("This prospect has already been
 * interviewed"), without the "[CONVEX M(...)] [Request ID: ...] Uncaught
 * Error:" wrapping and the stack. Undefined when nothing readable is left
 * (production hides the message of a plain thrown Error).
 */
export function readableError(e: unknown): string | undefined {
    const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
    const cleaned = raw
        .replace(/\[CONVEX [^\]]*\]\s*/g, "")
        .replace(/\[Request ID: [^\]]*\]\s*/g, "")
        .replace(/^Server Error\s*/i, "")
        .replace(/Uncaught Error:\s*/g, "")
        .replace(/\n\s+at [\s\S]*$/, "")
        .replace(/\s*Called by client\s*$/i, "")
        .trim();
    return cleaned || undefined;
}
