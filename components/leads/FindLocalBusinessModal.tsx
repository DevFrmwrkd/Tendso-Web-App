"use client";

/**
 * Find Local Business modal — opened from the /leads action door.
 *
 * Two-state UI per WEB-BUILD-CRM.md (Find Local Business modal section):
 *   Resting:  category input + radius pills + "Find Businesses" Door
 *   Active:   3-stage progress panel (locating → searching → saving)
 *             with a pulsing emerald halo + step list
 *
 * On submit:
 *   1. phase = 'locating' → navigator.geolocation.getCurrentPosition
 *   2. phase = 'searching' → api.outscraper.scrapeNearby(...)
 *   3. phase = 'saving' (hold ~350ms so the user sees the final tick flip)
 *   4. sonner toast with `{total / inserted / skipped}` summary
 *   5. auto-close + reset to 'idle'
 *
 * Error handling mirrors the spec's error-message matrix.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
    X, Search, Compass, Loader2, MapPin, Globe, Check, AlertCircle,
} from "lucide-react";

type Phase = "idle" | "locating" | "searching" | "saving";

const RADIUS_OPTIONS = [1, 3, 5, 10] as const;

const PHASE_META: Record<Exclude<Phase, "idle">, { caption: string; doorLabel: string; hint: string }> = {
    locating: {
        caption: "Step 1 of 3",
        doorLabel: "Finding where you are…",
        hint: "Reading GPS so we search the right neighborhood.",
    },
    searching: {
        caption: "Step 2 of 3",
        doorLabel: "Looking for nearby businesses…",
        hint: "Checking Google Maps for businesses around you.",
    },
    saving: {
        caption: "Step 3 of 3",
        doorLabel: "Almost ready — saving results…",
        hint: "Saving the ones nobody on the team has met yet.",
    },
};

const STEP_ORDER: Array<Exclude<Phase, "idle">> = ["locating", "searching", "saving"];

const STEP_LABELS: Record<Exclude<Phase, "idle">, { title: string; sub: string }> = {
    locating: { title: "Pinning your spot", sub: "Reading GPS so we search the right neighborhood." },
    searching: { title: "Scanning the map", sub: "Checking Google Maps for businesses around you." },
    saving: { title: "Adding to your list", sub: "Saving the ones nobody on the team has met yet." },
};

function classifyError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("not authenticated")) {
        return "Please sign in again — your session has expired. Please log out and back in to use this feature.";
    }
    if (lower.includes("forbidden") || lower.includes("admin")) {
        return "Not available yet — this feature is being rolled out. Your account isn't enabled for it yet. Check back soon.";
    }
    if (lower.includes("outscraper_api_key")) {
        return "Temporarily unavailable — the business-search service is offline right now. Please try again later.";
    }
    return `Search failed — ${message}`;
}

export default function FindLocalBusinessModal({
    open, onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const router = useRouter();
    const scrapeNearby = useAction(api.outscraper.scrapeNearby);

    const [category, setCategory] = useState("");
    const [radius, setRadius] = useState<number>(5);
    const [phase, setPhase] = useState<Phase>("idle");
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const activeRef = useRef(false);

    // Reset state every time the modal opens.
    useEffect(() => {
        if (open) {
            setPhase("idle");
            setPermissionError(null);
            activeRef.current = false;
        }
    }, [open]);

    // ESC closes when idle.
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && phase === "idle") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, phase, onClose]);

    if (!open) return null;

    const handleSubmit = async () => {
        if (activeRef.current) return;
        activeRef.current = true;
        setPermissionError(null);

        // Phase 1 — locate
        setPhase("locating");
        const coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
            if (typeof window === "undefined" || !navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => resolve(null),
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
            );
        });
        if (!coords) {
            setPermissionError(
                "Please grant location permission so we can search businesses near your current position.",
            );
            setPhase("idle");
            activeRef.current = false;
            return;
        }

        // Phase 2 — search via Outscraper
        setPhase("searching");
        try {
            const queryStr = category.trim() || "businesses";
            const res = await scrapeNearby({
                query: queryStr,
                location: `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`,
                radiusKm: radius,
                limit: 20,
            });

            // Phase 3 — saving (hold so the user sees the final tick flip)
            setPhase("saving");
            await new Promise((r) => setTimeout(r, 350));

            // Per the 2026-05-29 evening spec update: pass the raw
            // `businesses` array via URL `data` param so the discover map
            // can render pins from in-memory state directly. This bypasses
            // the silently-failing DB write path — the map shows pins even
            // if `listScrapedLeads` returns empty. See WEB-BUILD-CRM.md
            // "Map B — Find Local Business" for the new data flow.
            setPhase("idle");
            activeRef.current = false;
            onClose();
            const businessesParam = (res as any).businesses
                ? `&data=${encodeURIComponent(JSON.stringify((res as any).businesses))}`
                : "";
            const discoverHref =
                `/leads/discover?category=${encodeURIComponent(queryStr)}&radiusKm=${radius}${businessesParam}`;
            router.push(discoverHref);
        } catch (err: any) {
            const message = err?.message ?? String(err);
            toast.error(classifyError(message));
            setPhase("idle");
            activeRef.current = false;
        }
    };

    const active = phase !== "idle";
    const queryPreview = category.trim() || "businesses";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(27,28,36,0.55)" }}
            onClick={() => {
                if (phase === "idle") onClose();
            }}
        >
            <div
                className="w-full max-w-md rounded-3xl overflow-hidden"
                style={{
                    background: "var(--ed-paper-3, #FCFAF5)",
                    border: "1px solid var(--ed-rule, #E0D8C9)",
                    boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
                }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-5 pb-3">
                    <div>
                        <div
                            className="text-[10px] mb-1"
                            style={{
                                fontFamily: "var(--ed-mono)",
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: "var(--ed-ink-3)",
                            }}
                        >
                            {active ? "Hang tight" : "Discover"}
                        </div>
                        <h2
                            style={{
                                fontFamily: "var(--ed-serif)",
                                fontSize: 26,
                                lineHeight: 1.15,
                                color: "var(--ed-ink)",
                                margin: 0,
                            }}
                        >
                            {active ? (
                                <>
                                    Looking for{" "}
                                    <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>
                                        {queryPreview}
                                    </em>{" "}
                                    near you.
                                </>
                            ) : (
                                <>
                                    Find your{" "}
                                    <em style={{ fontStyle: "italic", color: "var(--ed-accent)" }}>
                                        next interview.
                                    </em>
                                </>
                            )}
                        </h2>
                    </div>
                    {phase === "idle" && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="w-8 h-8 rounded-full inline-flex items-center justify-center"
                            style={{ background: "var(--ed-paper-2)", color: "var(--ed-ink-2)" }}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="px-5 pb-5">
                    {active ? (
                        <ActivePanel phase={phase} />
                    ) : (
                        <>
                            <p className="text-[13px] mb-4" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                                Pick the kind of business you want to talk to. We&apos;ll use your GPS and pull up to 20 nearby spots that nobody on the team has interviewed yet — go knock on a door.
                            </p>

                            {/* Category */}
                            <div className="mb-4">
                                <div className="relative">
                                    <Search
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                                        style={{ color: "var(--ed-ink-3)" }}
                                    />
                                    <input
                                        type="text"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        placeholder="restaurants, barbershops, sari-sari…"
                                        className="w-full pl-10 pr-4 py-3 text-[14px] focus:outline-none"
                                        style={{
                                            background: "var(--ed-paper)",
                                            border: "1px solid var(--ed-rule)",
                                            borderRadius: 12,
                                            color: "var(--ed-ink)",
                                            fontFamily: "var(--ed-sans)",
                                        }}
                                    />
                                </div>
                                <div
                                    className="text-[10px] mt-1.5 px-1"
                                    style={{
                                        fontFamily: "var(--ed-mono)",
                                        letterSpacing: "0.12em",
                                        textTransform: "uppercase",
                                        color: "var(--ed-ink-3)",
                                    }}
                                >
                                    What kind of business?
                                </div>
                            </div>

                            {/* Radius */}
                            <div className="mb-4">
                                <div className="grid grid-cols-4 gap-2">
                                    {RADIUS_OPTIONS.map((r) => {
                                        const isActive = radius === r;
                                        return (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => setRadius(r)}
                                                className="px-3 py-2.5 rounded-xl text-center transition-colors"
                                                style={{
                                                    background: isActive ? "var(--ed-ink)" : "var(--ed-paper-2)",
                                                    color: isActive ? "var(--ed-paper-3)" : "var(--ed-ink)",
                                                    border: `1px solid ${isActive ? "var(--ed-ink)" : "var(--ed-rule)"}`,
                                                }}
                                            >
                                                <div style={{ fontFamily: "var(--ed-serif)", fontSize: 22, lineHeight: 1.05 }}>
                                                    {r}
                                                </div>
                                                <div
                                                    className="text-[9px] mt-0.5"
                                                    style={{
                                                        fontFamily: "var(--ed-mono)",
                                                        letterSpacing: "0.12em",
                                                        textTransform: "uppercase",
                                                        opacity: 0.7,
                                                    }}
                                                >
                                                    km
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div
                                    className="text-[10px] mt-1.5 px-1"
                                    style={{
                                        fontFamily: "var(--ed-mono)",
                                        letterSpacing: "0.12em",
                                        textTransform: "uppercase",
                                        color: "var(--ed-ink-3)",
                                    }}
                                >
                                    Radius
                                </div>
                            </div>

                            {permissionError && (
                                <div
                                    className="rounded-xl px-3 py-2.5 mb-4 flex items-start gap-2 text-[12px]"
                                    style={{
                                        background: "var(--ed-status-lost-bg, #F3D7CF)",
                                        color: "var(--ed-danger)",
                                        border: "1px solid var(--ed-rule)",
                                    }}
                                >
                                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                    <span>{permissionError}</span>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleSubmit}
                                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-[14px] font-semibold mb-2"
                                style={{
                                    background: "var(--ed-accent-solid, #10B981)",
                                    color: "#fff",
                                }}
                            >
                                <Compass className="w-4 h-4" />
                                Find Businesses
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full text-center text-[12px] py-2"
                                style={{ color: "var(--ed-ink-3)" }}
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Active panel — 3-stage progress UI ────────────────────────────────────
function ActivePanel({ phase }: { phase: Exclude<Phase, "idle"> }) {
    const meta = PHASE_META[phase];
    return (
        <>
            <p className="text-[13px] mb-5" style={{ color: "var(--ed-ink-2)", lineHeight: 1.5 }}>
                Hold on — this usually takes 5–15 seconds depending on your area. Please don&apos;t close the page.
            </p>

            {/* Pulsing halo */}
            <div className="flex items-center justify-center mb-5">
                <div className="relative">
                    {/* Outer halo (pulsing) */}
                    <div
                        className="absolute inset-0 rounded-full leads-modal-halo"
                        style={{
                            background: "var(--ed-accent-solid, #10B981)",
                            opacity: 0.25,
                            transform: "scale(1)",
                            animation: "leadsModalHalo 1800ms ease-in-out infinite",
                            zIndex: 0,
                        }}
                    />
                    {/* Inner solid disc with icon */}
                    <div
                        className="relative w-16 h-16 rounded-full inline-flex items-center justify-center"
                        style={{
                            background: "var(--ed-accent-solid, #10B981)",
                            color: "#fff",
                            zIndex: 1,
                        }}
                    >
                        {phase === "locating" && <MapPin className="w-7 h-7" />}
                        {phase === "searching" && <Search className="w-7 h-7" />}
                        {phase === "saving" && <Globe className="w-7 h-7" />}
                    </div>
                </div>
            </div>

            {/* Step list */}
            <ol className="space-y-2 mb-4" aria-live="polite">
                {STEP_ORDER.map((step, idx) => {
                    const currentIdx = STEP_ORDER.indexOf(phase);
                    const isDone = idx < currentIdx;
                    const isActive = idx === currentIdx;
                    const labels = STEP_LABELS[step];
                    return (
                        <li
                            key={step}
                            aria-current={isActive ? "step" : undefined}
                            className="rounded-xl px-3 py-2.5 flex items-start gap-3 text-[12px]"
                            style={{
                                background: isActive
                                    ? "var(--ed-paper-3)"
                                    : isDone
                                        ? "var(--ed-accent-bg, #D1FAE5)"
                                        : "var(--ed-paper-2)",
                                border: isActive ? "1.5px solid var(--ed-accent-solid, #10B981)" : "1px solid var(--ed-rule)",
                                color: isActive ? "var(--ed-ink)" : isDone ? "var(--ed-ink-2)" : "var(--ed-ink-3)",
                            }}
                        >
                            <div
                                className="w-5 h-5 rounded-full inline-flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{
                                    background: isDone
                                        ? "var(--ed-accent-solid, #10B981)"
                                        : isActive
                                            ? "transparent"
                                            : "transparent",
                                    border: isActive
                                        ? "1.5px solid var(--ed-accent-solid, #10B981)"
                                        : isDone
                                            ? "none"
                                            : "1px solid var(--ed-rule-strong, #B7AC95)",
                                    color: isDone ? "#fff" : "var(--ed-ink-3)",
                                }}
                            >
                                {isDone && <Check className="w-3 h-3" />}
                                {isActive && (
                                    <Loader2
                                        className="w-3 h-3 animate-spin"
                                        style={{ color: "var(--ed-accent-solid, #10B981)" }}
                                    />
                                )}
                                {!isDone && !isActive && (
                                    <span style={{ fontSize: 10, fontWeight: 700 }}>{idx + 1}</span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div
                                    style={{
                                        fontWeight: isActive ? 600 : 500,
                                        fontSize: 13,
                                    }}
                                >
                                    {labels.title}
                                </div>
                                <div
                                    className="text-[11px] mt-0.5"
                                    style={{ color: "var(--ed-ink-3)", lineHeight: 1.4 }}
                                >
                                    {labels.sub}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>

            {/* Disabled Door — shows the active step caption */}
            <div
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-[14px] font-semibold mb-2"
                style={{
                    background: "var(--ed-ink)",
                    color: "var(--ed-paper-3)",
                    opacity: 0.7,
                }}
            >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                    <span
                        className="opacity-70 mr-1"
                        style={{
                            fontFamily: "var(--ed-mono)",
                            fontSize: 10,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                        }}
                    >
                        {meta.caption}
                    </span>
                    {meta.doorLabel}
                </span>
            </div>
            <p
                className="text-center text-[11px]"
                style={{ color: "var(--ed-ink-3)" }}
            >
                Please don&apos;t close the page — this takes a few seconds.
            </p>

            {/* Halo keyframes — scoped to this modal */}
            <style jsx global>{`
                @keyframes leadsModalHalo {
                    0%, 100% { opacity: 0.20; transform: scale(0.95); }
                    50%      { opacity: 0.55; transform: scale(1.15); }
                }
            `}</style>
        </>
    );
}
