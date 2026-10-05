"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Globe, List, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
    Button,
    ButtonLink,
    cx,
    Dot,
    Icon,
    LinkSegmented,
    Loading,
    PageHeader,
    RowButton,
    RowMain,
    Segmented,
    Skeleton,
    Status,
    type StatusWord,
    type Tone,
} from "@/components/r1";
import { CreatorShell } from "@/components/shells/CreatorShell";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { creatorRedirect } from "@/lib/creatorGate";

import {
    boundsOf,
    circleBounds,
    DEFAULT_RADIUS,
    formatDistance,
    formatRadius,
    nextRadius,
    parseRadius,
    radiusOptions,
} from "./geo";
import { isTeamSite, MapCanvas, type CameraFit, type Selection } from "./MapCanvas";
import { PinPopover } from "./PinPopover";
import { useDiscoverPins } from "./useDiscoverPins";
import { useGeolocation, type Geo } from "./useGeolocation";
import { useLivePins, type LiveData } from "./useLivePins";
import type { MapLayer, MapPin, Radius } from "./types";

/*
 * The Leads map (board LeadsMap): "What is near me?". One screen, two
 * layers, each its own route so every old link keeps landing where it did:
 *
 *   /leads/discover  Businesses to visit   (the Find Local Business search lands here,
 *                                           with ?category=&radiusKm=&data=)
 *   /leads/live      Live Tendso sites
 *
 * The layer switch swaps the path and keeps the query string, so a search's
 * `data` payload and the radius survive a trip to the other layer and back.
 */

const LAYER_PATH: Record<MapLayer, string> = { discover: "/leads/discover", live: "/leads/live" };
const MAP_ID: Record<MapLayer, string> = { discover: "leads-discover-map", live: "leads-live-map" };
/** Each old page's starting zoom near the creator. */
const NEAR_ZOOM: Record<MapLayer, number> = { discover: 13, live: 12 };
/** Lists in a card cap at five rows, then "Show all" (kit). */
const LIST_CAP = 5;
/** Segmented buttons get a 40px thumb target on a phone; the kit's 30px from `sm` up. */
const THUMB_SEG = "[&>button]:h-10 sm:[&>button]:h-[30px]";
const TONE_ORDER: Tone[] = ["attn", "progress", "done", "bad", "off"];

export function LeadsMap({ layer }: { layer: MapLayer }) {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();
    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");

    // The pages' own guards, unchanged: signed out → /login, no creator row →
    // /onboarding, staff / rejected / uncertified → wherever creatorRedirect
    // sends them. Admins may use the map.
    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/login");
    }, [isLoaded, isSignedIn, router]);
    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null) router.push("/onboarding");
    }, [isLoaded, isSignedIn, creator, router]);
    useEffect(() => {
        if (isLoaded && isSignedIn && creator) {
            const dest = creatorRedirect(creator);
            if (dest) router.replace(dest);
        }
    }, [isLoaded, isSignedIn, creator, router]);

    const ready = isLoaded && isSignedIn && creator !== undefined && !!creator && (creator.role === "admin" || !!creator.certifiedAt);

    return (
        <CreatorShell>
            {ready && creator ? layer === "discover" ? <DiscoverLayer /> : <LiveLayer creatorId={creator._id} /> : <MapPageSkeleton />}
        </CreatorShell>
    );
}

/** The Suspense fallback while the search params resolve. */
export function LeadsMapFallback() {
    return (
        <CreatorShell>
            <MapPageSkeleton />
        </CreatorShell>
    );
}

// ── Layers ──────────────────────────────────────────────────────────────

function DiscoverLayer() {
    const searchParams = useSearchParams();
    const geo = useGeolocation();
    const parsed = parseRadius(searchParams.get("radiusKm"), "discover");
    const radiusKm = parsed === "all" ? DEFAULT_RADIUS : parsed;
    const { pins, beyond, pendingGeocodes, onGeocoded } = useDiscoverPins({
        dataParam: searchParams.get("data"),
        userLoc: geo.loc,
        radiusKm,
    });

    const located = geo.status === "ok";
    const n = pins?.length ?? 0;
    const r = formatRadius(radiusKm);
    const noun = n === 1 ? "business" : "businesses";
    const next = nextRadius(radiusKm);

    return (
        <MapScreen
            layer="discover"
            geo={geo}
            radius={radiusKm}
            pins={pins}
            hint={searchHint(searchParams.get("category"))}
            listTitle={!located ? `${n} ${noun} to visit` : n > 0 ? `${n} ${noun} within ${r}` : `No businesses within ${r}`}
            listSub={
                !located
                    ? "Turn on location to see how far each one is."
                    : n > 0
                      ? "Nearest first · not interviewed yet"
                      : beyond > 0
                        ? "Widen the radius to see the ones further out."
                        : "Nobody has found any here yet. Search for businesses near you."
            }
            beyondText={located && beyond > 0 ? `${beyond} more beyond ${r}` : null}
            // Widening helps even with nothing counted beyond: past 5 km the
            // pool search reaches a wider ring of cells.
            beyondAction={
                !located
                    ? null
                    : next != null
                      ? { kind: "radius", to: next, label: `Widen to ${formatRadius(next)}` }
                      : { kind: "link", href: "/leads?find=1", label: "Find more businesses" }
            }
            pendingGeocodes={pendingGeocodes}
            onGeocoded={onGeocoded}
        />
    );
}

/** The bar's line under the layer switch. The search the creator ran, when there was one. */
function searchHint(category: string | null): string {
    const c = category?.trim();
    return c && c.toLowerCase() !== "businesses"
        ? `Your search for “${c}”, plus other businesses nobody has interviewed yet.`
        : "Businesses near you that nobody has interviewed yet.";
}

function LiveLayer({ creatorId }: { creatorId: Id<"creators"> }) {
    const searchParams = useSearchParams();
    const geo = useGeolocation();
    const radius = parseRadius(searchParams.get("radiusKm"), "live");
    const { pins, beyond, usingFallback, geocode, pendingGeocodes, onGeocoded } = useLivePins({ creatorId, userLoc: geo.loc, radius });

    const located = geo.status === "ok";
    const ranged = located && radius !== "all";
    const n = pins?.length ?? 0;
    // While nothing is live the layer shows every interviewed business instead, and says so.
    const [one, many] = usingFallback ? ["interviewed business", "interviewed businesses"] : ["live site", "live sites"];
    const noun = n === 1 ? one : many;
    const r = formatRadius(radius);
    const next = nextRadius(radius);

    let beyondAction: BeyondAction | null = null;
    if (ranged && beyond > 0) {
        // At the widest step, "Show all" brings back every live site, which
        // is what this map showed before it had a radius.
        beyondAction = next != null ? { kind: "radius", to: next, label: `Widen to ${formatRadius(next)}` } : { kind: "radius", to: "all", label: `Show all ${n + beyond}` };
    }

    return (
        <MapScreen
            layer="live"
            geo={geo}
            radius={radius}
            pins={pins}
            hint="Sites that are online now. Yours show how they are doing."
            notice={geocodeNotice(geocode)}
            listTitle={ranged ? (n > 0 ? `${n} ${noun} within ${r}` : `No ${many} within ${r}`) : n > 0 ? `${n} ${noun}` : `No ${many} yet`}
            listSub={
                usingFallback
                    ? "No site is live yet, so these are the businesses the team has interviewed."
                    : !located
                      ? "Turn on location to see how far each one is."
                      : n > 0
                        ? "Nearest first · online now"
                        : beyond > 0
                          ? "Widen the radius to see the ones further out."
                          : "A business shows up here once its site goes live."
            }
            beyondText={ranged && beyond > 0 ? `${beyond} more beyond ${r}` : ranged && n > 0 ? "Show these to the next owner you visit." : null}
            beyondAction={beyondAction}
            pendingGeocodes={pendingGeocodes}
            onGeocoded={onGeocoded}
        />
    );
}

/** Server geocoding of submission addresses, in one quiet line (it used to be three banners). */
function geocodeNotice(g: LiveData["geocode"]): string | null {
    if (!g) return null;
    if ("running" in g) return `Placing ${g.running} more ${g.running === 1 ? "site" : "sites"} on the map…`;
    if (g.phase === "error") return `Some sites could not be placed on the map. ${g.message}`;
    if (g.failed > 0) return `${g.failed} ${g.failed === 1 ? "address" : "addresses"} could not be placed on the map. Check them for typos.`;
    if (g.geocoded > 0) return `Placed ${g.geocoded} more ${g.geocoded === 1 ? "site" : "sites"} on the map.`;
    return null;
}

// ── The screen ──────────────────────────────────────────────────────────

type BeyondAction = { kind: "radius"; to: Radius; label: string } | { kind: "link"; href: string; label: string };

type MapScreenProps = {
    layer: MapLayer;
    geo: Geo;
    radius: Radius;
    /** Within the radius, nearest first. Undefined while loading. */
    pins: MapPin[] | undefined;
    hint: string;
    notice?: string | null;
    listTitle: string;
    listSub: string;
    /** Under the list: what is outside the radius. */
    beyondText: string | null;
    beyondAction: BeyondAction | null;
    pendingGeocodes: Array<{ id: string; address: string }>;
    onGeocoded: (id: string, lat: number, lng: number) => void;
};

function MapScreen({ layer, geo, radius, pins, hint, notice, listTitle, listSub, beyondText, beyondAction, pendingGeocodes, onGeocoded }: MapScreenProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [selection, setSelection] = useState<Selection | null>(null);
    const [showAll, setShowAll] = useState(false);
    // Bumped by the locate button: re-frames the camera on the creator.
    const [recenter, setRecenter] = useState(0);
    const panelRef = useRef<HTMLDivElement>(null);
    const listTitleId = useId();

    const located = geo.status === "ok";
    // Until the browser says where the creator is, nothing is drawn or
    // listed: without a position every pin would show, then most would
    // vanish a second later when the radius applies.
    const shown = geo.status === "pending" ? undefined : pins;

    // Each layer is its own route. Its link keeps the query string, so a
    // search's `data` payload and the radius survive a trip to the other
    // layer and back.
    const query = searchParams.toString();
    const layerHref = (l: MapLayer) => (query ? `${LAYER_PATH[l]}?${query}` : LAYER_PATH[l]);

    // The radius is a setting of this view, not a step: replace, so Back still leaves the map.
    const replaceQuery = (path: string, edit: (p: URLSearchParams) => void) => {
        const p = new URLSearchParams(query);
        edit(p);
        const qs = p.toString();
        router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
    };

    const setRadius = (r: Radius) => {
        setShowAll(false);
        // Keep the open pin only if it stays inside the new radius (board).
        const open = selection ? shown?.find((p) => p.key === selection.key) : undefined;
        if (open && r !== "all" && open.distanceKm != null && open.distanceKm > r) setSelection(null);
        replaceQuery(pathname, (p) => p.set("radiusKm", String(r)));
    };

    // Choosing the open pin again closes it (board).
    const select = (key: string, from: Selection["from"]) => {
        const opening = selection?.key !== key;
        setSelection((s) => (s?.key === key ? null : { key, from, n: (s?.n ?? 0) + 1 }));
        if (opening && from === "list") {
            // On a phone the map is above the list: bring it into view.
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            panelRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
        }
    };
    const close = useCallback(() => setSelection(null), []);

    const locate = () => {
        setRecenter((v) => v + 1);
        geo.locate((why) =>
            why === "denied"
                ? toast("Location is off for this site", { description: "Allow location in your browser's settings to see what is near you." })
                : toast("Could not find where you are", { description: "Check that location is on, then try again." }),
        );
    };

    // What the camera frames. With a position: the radius circle (the
    // board's view). Without one, or with "all": every pin (the old view).
    const fit = useMemo<CameraFit | null>(() => {
        if (geo.status === "pending") return null;
        if (geo.loc && radius !== "all") {
            return { key: `ring:${geo.loc.lat},${geo.loc.lng}:${radius}:${recenter}`, bounds: circleBounds(geo.loc, radius) };
        }
        const pts = (shown ?? []).map((p) => ({ lat: p.lat, lng: p.lng }));
        if (geo.loc) pts.push(geo.loc);
        const bounds = boundsOf(pts);
        return bounds ? { key: `pins:${pts.length}:${recenter}`, bounds } : null;
    }, [geo.status, geo.loc, radius, shown, recenter]);

    const legendStatuses = useMemo(() => uniqueStatuses(shown ?? []), [shown]);
    const hasTeamSites = useMemo(() => (shown ?? []).some(isTeamSite), [shown]);
    const legend =
        located || legendStatuses.length > 0 || hasTeamSites ? (
            <>
                {located && (
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-3 rounded-full border-2 border-r1-ink bg-r1-paper" />
                        You
                    </span>
                )}
                {legendStatuses.map((s) => (
                    <Status key={s.word} {...s} className="text-xs leading-4" />
                ))}
                {hasTeamSites && (
                    <span className="inline-flex items-center gap-1.5">
                        <Icon icon={Globe} size={12} className="text-r1-ink-3" />
                        Another creator’s site
                    </span>
                )}
            </>
        ) : null;

    const n = shown?.length ?? 0;
    const rows = shown ? (showAll ? shown : shown.slice(0, LIST_CAP)) : [];

    return (
        <>
            <PageHeader
                title="Map"
                sub="What is near me?"
                actions={
                    <>
                        {/* No position, no radius: the control comes back when location does. */}
                        {geo.status !== "off" && (
                            <div className="flex items-center gap-3">
                                {/* The group is labelled for screen readers; on a phone the word gives way so the control and List view share a row. */}
                                <span className="t-label hidden sm:inline" aria-hidden="true">
                                    Radius
                                </span>
                                <Segmented
                                    label="Radius"
                                    options={radiusOptions(radius).map((r) => ({ value: String(r), label: formatRadius(r) }))}
                                    value={String(radius)}
                                    onChange={(v) => setRadius(v === "all" ? "all" : Number(v))}
                                    className={THUMB_SEG}
                                />
                            </div>
                        )}
                        <ButtonLink href={layer === "discover" ? "/leads?tab=prospects" : "/leads"}>
                            <Icon icon={List} />
                            List view
                        </ButtonLink>
                    </>
                }
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <LinkSegmented
                    label="Show on the map"
                    options={[
                        { href: layerHref("discover"), label: "Businesses to visit" },
                        { href: layerHref("live"), label: "Live Tendso sites" },
                    ]}
                    current={layerHref(layer)}
                    className="w-full sm:w-auto [&>a]:h-10 [&>a]:flex-1 [&>a]:justify-center sm:[&>a]:h-[30px] sm:[&>a]:flex-none"
                />
                <div className="flex flex-col gap-0.5 sm:text-right">
                    <p className="t-meta">{hint}</p>
                    {notice && (
                        <p className="t-meta" role="status">
                            {notice}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:items-start">
                {/* Phone: the map runs edge to edge. */}
                <div
                    ref={panelRef}
                    role="region"
                    aria-label="Map"
                    className="relative -mx-4 h-[60dvh] max-h-[560px] min-h-[360px] overflow-hidden border-y border-r1-line bg-r1-fill sm:mx-0 sm:h-[520px] sm:max-h-none sm:rounded-r1-card sm:border xl:h-[600px]"
                >
                    <MapCanvas
                        mapId={MAP_ID[layer]}
                        nearZoom={NEAR_ZOOM[layer]}
                        pins={shown ?? []}
                        selection={selection}
                        onSelect={(key) => select(key, "pin")}
                        onClose={close}
                        userLoc={geo.loc}
                        ringKm={located && radius !== "all" ? radius : null}
                        fit={fit}
                        legend={legend}
                        renderPopover={(pin, titleId, closePopover) => <PinPopover pin={pin} titleId={titleId} onClose={closePopover} />}
                        pendingGeocodes={pendingGeocodes}
                        onGeocoded={onGeocoded}
                        onLocate={locate}
                    />
                </div>

                <div className="flex flex-col gap-4">
                    {shown === undefined ? (
                        <Loading label={geo.status === "pending" ? "Finding where you are" : "Loading what is near you"}>
                            <ListSkeleton />
                        </Loading>
                    ) : (
                        <>
                            <section className="t-card overflow-hidden" aria-labelledby={listTitleId}>
                                <div className={cx("flex flex-col gap-0.5 p-4", n > 0 && "border-b border-r1-line")}>
                                    <h2 id={listTitleId} className="t-h2">
                                        {listTitle}
                                    </h2>
                                    <p className="t-meta">{listSub}</p>
                                </div>
                                {n > 0 && (
                                    <div className="t-list">
                                        {rows.map((pin) => (
                                            <PinRow key={pin.key} pin={pin} selected={selection?.key === pin.key} onSelect={() => select(pin.key, "list")} />
                                        ))}
                                    </div>
                                )}
                                {n > LIST_CAP && (
                                    <button type="button" className="t-showall" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
                                        {showAll ? "Show fewer" : `Show all ${n}`}
                                    </button>
                                )}
                            </section>

                            {(beyondText || beyondAction) && (
                                <div className="flex flex-col items-start gap-2 px-1">
                                    {beyondText && <p className="t-meta t-num">{beyondText}</p>}
                                    {beyondAction?.kind === "radius" && <Button onClick={() => setRadius(beyondAction.to)}>{beyondAction.label}</Button>}
                                    {beyondAction?.kind === "link" && (
                                        <ButtonLink href={beyondAction.href}>
                                            <Icon icon={Search} />
                                            {beyondAction.label}
                                        </ButtonLink>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

/** One row of the side list: the pin's head, the name and where, the distance and status. The whole row is the button. */
function PinRow({ pin, selected, onSelect }: { pin: MapPin; selected: boolean; onSelect: () => void }) {
    const team = isTeamSite(pin);
    const meta = [pin.meta, pin.layer === "live" && !pin.mine && pin.submittedBy ? `by ${pin.submittedBy}` : null].filter(Boolean).join(" · ");
    return (
        <RowButton selected={selected} aria-pressed={selected} onClick={onSelect} className="gap-3 py-2.5">
            <span
                aria-hidden="true"
                className={cx(
                    "flex size-5 flex-none items-center justify-center rounded-full border-[1.5px] bg-r1-paper",
                    team ? "border-r1-ink-3 text-r1-ink-3" : "border-r1-ink",
                )}
            >
                {pin.status ? <Dot tone={pin.status.tone} /> : team ? <Icon icon={Globe} size={12} /> : null}
            </span>
            <RowMain title={pin.name} meta={meta ? <span className="block truncate">{meta}</span> : undefined} />
            {(pin.distanceKm != null || pin.status) && (
                <span className="flex flex-none flex-col items-end gap-0.5">
                    {pin.distanceKm != null && <span className="t-meta t-num text-r1-ink-2">{formatDistance(pin.distanceKm)}</span>}
                    {pin.status && <Status {...pin.status} />}
                </span>
            )}
        </RowButton>
    );
}

/** The statuses on the map, one each, for the legend. */
function uniqueStatuses(pins: MapPin[]): StatusWord[] {
    const seen = new Map<string, StatusWord>();
    for (const p of pins) if (p.status && !seen.has(p.status.word)) seen.set(p.status.word, p.status);
    return [...seen.values()].sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone) || a.word.localeCompare(b.word));
}

// ── Loading ─────────────────────────────────────────────────────────────

/** The list card's shape: a heading and five rows. */
function ListSkeleton() {
    return (
        <div className="t-card overflow-hidden" aria-hidden="true">
            <div className="flex flex-col gap-2 border-b border-r1-line p-4">
                <Skeleton width="55%" height={16} />
                <Skeleton width="40%" height={12} />
            </div>
            {Array.from({ length: LIST_CAP }, (_, i) => (
                <div key={i} className="t-row gap-3 py-2.5">
                    <Skeleton width={20} height={20} round />
                    <span className="flex flex-1 flex-col gap-1.5">
                        <Skeleton width="60%" height={12} />
                        <Skeleton width="40%" height={10} />
                    </span>
                    <Skeleton width={48} height={12} />
                </div>
            ))}
        </div>
    );
}

/** The whole page's shape, while the account checks run. */
function MapPageSkeleton(): ReactNode {
    return (
        <Loading label="Loading the map">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <Skeleton width={96} height={36} />
                    <Skeleton width={150} height={14} />
                </div>
                <Skeleton height={40} className="w-full max-w-[340px]" />
                <Skeleton height={360} className="-mx-4 rounded-none sm:mx-0 sm:rounded-r1-card" />
                <ListSkeleton />
            </div>
        </Loading>
    );
}
