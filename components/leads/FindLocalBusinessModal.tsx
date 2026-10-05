"use client";

/**
 * Find a local business (board: Leads, "Find a local business" dialog), opened
 * from the Leads header and its empty state, and by /leads?find=1 (the Leads
 * map's "Find more businesses"). The page keeps `open` in the URL; `onClose`
 * takes ?find= off it.
 *
 * Two states, per WEB-BUILD-CRM.md (Find Local Business modal section):
 *   Form:  what kind of business + how far around you + "Find businesses"
 *   Run:   the 3-step progress (locating → searching → saving) and the
 *          board's one way out, "Stop searching"
 *
 * On submit:
 *   1. phase = 'locating' → navigator.geolocation.getCurrentPosition
 *   2. phase = 'searching' → api.outscraper.scrapeNearby(...)
 *   3. phase = 'saving' (hold ~350ms so the user sees the final tick flip)
 *   4. close, say how many were found, and open the discover map with them
 *
 * The search is always around the creator's own position: the discover map it
 * lands on measures every pin from there too. (The board's "Where?" area chips
 * were sample data for one city, so they are not built.)
 *
 * Error handling mirrors the spec's error-message matrix.
 */
import { useAction } from "convex/react";
import { Check, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Dialog, Field, Icon, Input, Segmented } from "@/components/r1";
import { api } from "@/convex/_generated/api";

type Phase = "idle" | "locating" | "searching" | "saving";
type ActivePhase = Exclude<Phase, "idle">;

// Field-test fix #3 (2026-06-04): added 0.5km (rendered as "500 m") for
// hyper-local searches. Mobile defaults to 1km so that's the web default
// too — see useState below.
const RADIUS_OPTIONS = [0.5, 1, 3, 5, 10] as const;

const STEP_ORDER: ActivePhase[] = ["locating", "searching", "saving"];

const STEPS: Record<ActivePhase, { title: string; sub: string }> = {
    locating: { title: "Pinning your spot", sub: "Reading your location so we search the right neighborhood." },
    searching: { title: "Scanning the map", sub: "Checking Google Maps for shops around you." },
    saving: { title: "Adding to your list", sub: "Keeping only the ones nobody on the team has met yet." },
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

/** Sub-1km options read "500 m" rather than "0.5 km", like mobile. */
function radiusLabel(r: number): string {
    return r < 1 ? `${Math.round(r * 1000)} m` : `${r} km`;
}

export default function FindLocalBusinessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const router = useRouter();
    const scrapeNearby = useAction(api.outscraper.scrapeNearby);
    const formId = useId();

    // What to look for and how far stay as they were between openings; the
    // phase and any location error start over each time (see close()).
    const [category, setCategory] = useState("");
    const [radius, setRadius] = useState<number>(1);
    const [phase, setPhase] = useState<Phase>("idle");
    const [permissionError, setPermissionError] = useState<string | null>(null);
    // One number per search. Stopping, or leaving the page, moves it on, and an
    // answer for an older number is dropped: no late jump to the map.
    const runRef = useRef(0);
    const busyRef = useRef(false);

    useEffect(() => {
        const runs = runRef;
        return () => {
            runs.current += 1;
        };
    }, []);

    const close = () => {
        setPhase("idle");
        setPermissionError(null);
        onClose();
    };

    const handleSubmit = async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        const run = ++runRef.current;
        const stale = () => runRef.current !== run;
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
        if (stale()) return;
        if (!coords) {
            setPermissionError("Please grant location permission so we can search businesses near your current position.");
            setPhase("idle");
            busyRef.current = false;
            return;
        }

        // Phase 2 — search via Outscraper
        setPhase("searching");
        const queryStr = category.trim() || "businesses";
        try {
            const res = await scrapeNearby({
                query: queryStr,
                location: `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`,
                radiusKm: radius,
                limit: 20,
            });
            if (stale()) return;

            // Phase 3 — saving (hold so the user sees the final tick flip)
            setPhase("saving");
            await new Promise((r) => setTimeout(r, 350));
            if (stale()) return;

            // Per the 2026-05-29 evening spec update: pass the raw
            // `businesses` array via URL `data` param so the discover map
            // can render pins from in-memory state directly. This bypasses
            // the silently-failing DB write path — the map shows pins even
            // if `listScrapedLeads` returns empty. See WEB-BUILD-CRM.md
            // "Map B — Find Local Business" for the new data flow.
            busyRef.current = false;
            close();
            const found = res.businesses ? res.businesses.length : res.total;
            if (found > 0) toast.success(`Found ${found} ${found === 1 ? "business" : "businesses"} near you`);
            const businessesParam = res.businesses ? `&data=${encodeURIComponent(JSON.stringify(res.businesses))}` : "";
            router.push(`/leads/discover?category=${encodeURIComponent(queryStr)}&radiusKm=${radius}${businessesParam}`);
        } catch (err) {
            if (stale()) return;
            toast.error(classifyError(err instanceof Error ? err.message : String(err)));
            setPhase("idle");
            busyRef.current = false;
        }
    };

    // The search itself still finishes on the server; this only stops waiting
    // for its answer and goes back to the form.
    const stopSearching = () => {
        runRef.current += 1;
        busyRef.current = false;
        setPhase("idle");
    };

    const active = phase !== "idle";
    const stepIndex = active ? STEP_ORDER.indexOf(phase) : 0;

    return (
        <Dialog
            open={open}
            // Esc and a click outside close the form. A running search stays
            // open until it finishes or "Stop searching" is pressed.
            onClose={() => {
                if (!active) close();
            }}
            title={active ? `Looking for ${category.trim() || "businesses"} near you` : "Find a local business"}
            footer={
                active ? (
                    <Button variant="ghost" onClick={stopSearching}>
                        Stop searching
                    </Button>
                ) : (
                    <>
                        <Button onClick={close}>Cancel</Button>
                        <Button variant="primary" type="submit" form={formId}>
                            <Icon icon={Search} />
                            Find businesses
                        </Button>
                    </>
                )
            }
        >
            {active ? (
                <RunPanel index={stepIndex} />
            ) : (
                <form
                    id={formId}
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleSubmit();
                    }}
                >
                    <p>We search Google Maps around you and add up to 20 shops that nobody on the team has interviewed yet.</p>
                    <Field label="What kind of business?" help="Leave it empty to find any kind of shop.">
                        <Input
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="restaurants, barbershops, sari-sari…"
                            autoComplete="off"
                            enterKeyHint="search"
                        />
                    </Field>
                    <div className="t-field">
                        {/* The caption on screen; the button group carries the same name for screen readers. */}
                        <span className="t-field-label" aria-hidden="true">
                            How far around you?
                        </span>
                        <Segmented
                            label="How far around you?"
                            options={RADIUS_OPTIONS.map((r) => ({ value: String(r), label: radiusLabel(r) }))}
                            value={String(radius)}
                            onChange={(v) => setRadius(Number(v))}
                            className="w-full [&>button]:flex-1 [&>button]:px-2"
                        />
                        <p className="t-help">We use your phone&apos;s location, so search from where you are.</p>
                    </div>
                    {permissionError && (
                        <p role="alert" className="t-error">
                            {permissionError}
                        </p>
                    )}
                </form>
            )}
        </Dialog>
    );
}

// ── Run state — the 3-step progress ────────────────────────────────────────
function RunPanel({ index }: { index: number }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5" aria-live="polite">
                <span className="t-label">Step {index + 1} of 3</span>
                <p>This usually takes 5 to 15 seconds. Keep this open.</p>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-r1-fill" aria-hidden="true">
                <div
                    className="h-1 rounded-full bg-r1-ink transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${Math.round(((index + 1) / STEP_ORDER.length) * 100)}%` }}
                />
            </div>
            <ol className="m-0 flex list-none flex-col gap-1 p-0">
                {STEP_ORDER.map((step, i) => {
                    const state = i < index ? "done" : i === index ? "now" : "next";
                    return (
                        <li key={step} className="flex items-start gap-3 py-2.5" aria-current={state === "now" ? "step" : undefined}>
                            <StepIcon state={state} />
                            <span className="flex flex-col gap-0.5">
                                <span
                                    className={
                                        state === "now"
                                            ? "text-[14px] font-medium text-r1-ink"
                                            : state === "done"
                                              ? "text-[14px] text-r1-ink-2"
                                              : "text-[14px] text-r1-ink-3"
                                    }
                                >
                                    {STEPS[step].title}
                                    <span className="sr-only">{state === "done" ? " (done)" : state === "now" ? " (in progress)" : " (to do)"}</span>
                                </span>
                                <span className="t-meta">{STEPS[step].sub}</span>
                            </span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

function StepIcon({ state }: { state: "done" | "now" | "next" }) {
    if (state === "done") {
        return (
            <span className="flex size-[22px] flex-none items-center justify-center rounded-full bg-r1-ink text-r1-paper" aria-hidden="true">
                <Icon icon={Check} size={12} />
            </span>
        );
    }
    if (state === "now") {
        return (
            <span
                className="flex size-[22px] flex-none items-center justify-center rounded-full shadow-[inset_0_0_0_1.5px_var(--r1-progress)]"
                aria-hidden="true"
            >
                <span className="size-2 rounded-full bg-r1-gold motion-safe:animate-pulse" />
            </span>
        );
    }
    return <span className="size-[22px] flex-none rounded-full shadow-[inset_0_0_0_1.5px_var(--r1-line-2)]" aria-hidden="true" />;
}
