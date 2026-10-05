"use client";

import {
    AdvancedMarker,
    APIProvider,
    APILoadingStatus,
    ControlPosition,
    Map as GoogleMap,
    MapControl,
    Polyline,
    useAdvancedMarkerRef,
    useApiLoadingStatus,
    useMap,
    useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { Globe, LocateFixed } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { Button, cx, Dot, ErrorState, Icon, type StatusWord } from "@/components/r1";

import { circlePath, PH_CENTER, type Bounds, type LatLng } from "./geo";
import type { MapPin } from "./types";

/*
 * The Google map behind both layers. Same stack as before the redesign:
 * Google Maps through @vis.gl/react-google-maps (not Leaflet; per spec the
 * old Leaflet view at /leads/near was wrong), AdvancedMarker pins (which need
 * a mapId), greedy gestures so one finger pans on a phone.
 *
 * What changed is the look: pins are the kit's map pin (`t-pin`: a ring on a
 * stem, the dot inside is the status) and the popup is the kit's popover
 * (`t-pop`) anchored above the pin, instead of Google's InfoWindow chrome.
 */

const MAPS_API_KEY =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    // Spec: reuse the mobile-side key (in ndm/app.json) — do not provision new
    "AIzaSyAt-knwNJgQ-Nx5ZY5aZUC-T8sj8D3QZ7U";

/** A selection made on the map ("pin") moves focus into the popover; one made in the list ("list") leaves it there. */
export type Selection = { key: string; from: "pin" | "list"; n: number };

/** What the camera frames: a key that changes when it should move again, and the box. */
export type CameraFit = { key: string; bounds: Bounds };

export type MapCanvasProps = {
    mapId: string;
    /** The zoom before the camera first frames anything, once the creator's position is known. */
    nearZoom: number;
    pins: MapPin[];
    selection: Selection | null;
    onSelect: (key: string) => void;
    onClose: () => void;
    userLoc: LatLng | null;
    /** Draw the radius ring (km) around the creator. */
    ringKm: number | null;
    fit: CameraFit | null;
    legend: ReactNode;
    renderPopover: (pin: MapPin, titleId: string, close: () => void) => ReactNode;
    pendingGeocodes: Array<{ id: string; address: string }>;
    onGeocoded: (id: string, lat: number, lng: number) => void;
    onLocate: () => void;
};

export function MapCanvas(props: MapCanvasProps) {
    return (
        <APIProvider apiKey={MAPS_API_KEY}>
            <AddressGeocoder pending={props.pendingGeocodes} onResolved={props.onGeocoded} />
            <MapBody {...props} />
        </APIProvider>
    );
}

function MapBody({ mapId, nearZoom, pins, selection, onSelect, onClose, userLoc, ringKm, fit, legend, renderPopover, onLocate }: MapCanvasProps) {
    const status = useApiLoadingStatus();
    const wrapRef = useRef<HTMLDivElement>(null);
    // The pins' marker elements, so focus can go back to a pin when its popover closes.
    const markerEls = useRef(new Map<string, HTMLElement>());

    const selectedKey = selection?.key ?? null;
    const selected = selectedKey ? (pins.find((p) => p.key === selectedKey) ?? null) : null;

    const closeAndRefocus = useCallback(() => {
        if (selectedKey) markerEls.current.get(selectedKey)?.focus();
        onClose();
    }, [selectedKey, onClose]);

    // Esc closes the popover. Focus returns to the pin only when it was on the map.
    useEffect(() => {
        if (!selectedKey) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            const onMap = !!wrapRef.current?.contains(document.activeElement);
            if (onMap) markerEls.current.get(selectedKey)?.focus();
            onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [selectedKey, onClose]);

    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
        return (
            <div className="flex h-full items-center justify-center bg-r1-paper">
                <ErrorState what="The map" />
            </div>
        );
    }

    return (
        <div ref={wrapRef} className="h-full w-full">
            <GoogleMap
                mapId={mapId}
                defaultCenter={userLoc ?? PH_CENTER}
                defaultZoom={userLoc ? nearZoom : 6}
                gestureHandling="greedy"
                // A quiet map like the board's: zoom, full screen and a real
                // scale (the board's "1 km" bar); no map types or Street View.
                // Google's own place icons stay off so a tap on the map never
                // opens Google's popup over ours.
                disableDefaultUI
                zoomControl
                fullscreenControl
                scaleControl
                clickableIcons={false}
                onClick={onClose}
                style={{ width: "100%", height: "100%" }}
            >
                <FitCamera fit={fit} />
                {userLoc && ringKm != null && <RadiusRing center={userLoc} km={ringKm} />}
                {userLoc && <YouMarker loc={userLoc} />}
                {pins.map((pin) => (
                    <AdvancedMarker
                        key={pin.key}
                        position={{ lat: pin.lat, lng: pin.lng }}
                        title={pinLabel(pin)}
                        zIndex={pin.key === selectedKey ? 2 : 1}
                        onClick={() => onSelect(pin.key)}
                        ref={(m) => {
                            if (m) markerEls.current.set(pin.key, m);
                            else markerEls.current.delete(pin.key);
                        }}
                    >
                        <PinGlyph status={pin.status} team={isTeamSite(pin)} selected={pin.key === selectedKey} />
                    </AdvancedMarker>
                ))}
                {selected && selection && (
                    <PopoverMarker key={selected.key} pin={selected} focusOnOpen={selection.from === "pin"}>
                        {(titleId) => renderPopover(selected, titleId, closeAndRefocus)}
                    </PopoverMarker>
                )}
                {selected && selection && <KeepPopoverInView lat={selected.lat} lng={selected.lng} n={selection.n} />}
                {legend && (
                    <MapControl position={ControlPosition.TOP_LEFT}>
                        {/* Decorative, as on the board: every pin's label and every list row already say their status. */}
                        <div
                            aria-hidden="true"
                            className="t-legend m-3 max-w-[calc(100vw-96px)] flex-wrap gap-x-4 gap-y-1 font-r1-sans text-xs leading-4 text-r1-ink-2 sm:max-w-[420px]"
                        >
                            {legend}
                        </div>
                    </MapControl>
                )}
                <MapControl position={ControlPosition.RIGHT_BOTTOM}>
                    <div className="mb-2.5 mr-2.5">
                        <Button icon aria-label="Show where I am" title="Show where I am" onClick={onLocate} className="shadow-r1-menu">
                            <Icon icon={LocateFixed} size={18} />
                        </Button>
                    </div>
                </MapControl>
            </GoogleMap>
        </div>
    );
}

/** Another creator's live site: the layer shows it, but this view has no status for it. */
export function isTeamSite(pin: MapPin): boolean {
    return pin.layer === "live" && !pin.mine && !pin.status;
}

function pinLabel(pin: MapPin): string {
    if (pin.status) return `${pin.name}, ${pin.status.word}`;
    if (isTeamSite(pin)) return `${pin.name}, another creator's site`;
    return pin.name;
}

/**
 * The kit's map pin (ComponentKit "Map pin + popover"): a white ring on an ink
 * stem, the status dot inside. Selected, the ring grows and thickens (the
 * kit's `t-pin[aria-pressed]` look; the marker element itself is the button,
 * so this glyph carries the look as utilities). Another creator's site is a
 * quieter grey pin with a globe, since this view has no status for it.
 */
export function PinGlyph({ status, team = false, selected = false, className }: { status: StatusWord | null; team?: boolean; selected?: boolean; className?: string }) {
    return (
        <span className={cx("t-pin", className)} aria-hidden="true">
            <span className={cx("t-pin-head", selected && "size-8 border-[3px]", team && "border-r1-ink-3 text-r1-ink-3")}>
                {status ? <Dot tone={status.tone} /> : team ? <Icon icon={Globe} size={14} /> : null}
            </span>
            <span className={cx("t-pin-stem", team && "bg-r1-ink-3")} />
        </span>
    );
}

/**
 * The popover, drawn as a second marker anchored 48px above the selected pin
 * so it pans and zooms with the map (and stays in full screen). Taps, drags
 * and scrolls inside it do not reach the map: preventMapHitsAndGesturesFrom
 * goes on the marker's content node, which is also where React listens for
 * this portal's events, so React still sees every click first.
 */
function PopoverMarker({ pin, focusOnOpen, children }: { pin: MapPin; focusOnOpen: boolean; children: (titleId: string) => ReactNode }) {
    const [markerRef, marker] = useAdvancedMarkerRef();
    const titleId = useId();

    useEffect(() => {
        const content = marker?.content;
        if (content instanceof HTMLElement) google.maps.OverlayView.preventMapHitsAndGesturesFrom(content);
    }, [marker]);

    // Opened from the map: move focus into the popover so it is read out and
    // its buttons are next. Opened from the list: leave focus in the list.
    // A callback ref, because the marker mounts its content a render after
    // this component, so an effect here would find nothing to focus.
    const focusBox = useCallback(
        (el: HTMLDivElement | null) => {
            if (el && focusOnOpen) el.focus({ preventScroll: true });
        },
        [focusOnOpen],
    );

    return (
        <AdvancedMarker ref={markerRef} position={{ lat: pin.lat, lng: pin.lng }} zIndex={1000} anchorLeft="-50%" anchorTop="calc(-100% - 48px)">
            <div
                ref={focusBox}
                role="dialog"
                aria-labelledby={titleId}
                tabIndex={-1}
                className="t-pop w-72 max-w-[calc(100vw-48px)] font-r1-sans outline-none"
                // The marker's own element ignores the pointer; its content opts back in.
                style={{ pointerEvents: "auto" }}
            >
                {children(titleId)}
            </div>
        </AdvancedMarker>
    );
}

// How much room the popover needs around its pin, in pixels: above (popover
// plus the 48px gap), either side (half its 288px width), and below.
const POPOVER_ROOM = { above: 300, side: 152, below: 24 };

/**
 * When a pin is selected, pan only if its popover would not fit: then the pin
 * goes a little below the middle, so the popover above it is whole. This is
 * Google's InfoWindow auto-pan, for a popover that is not an InfoWindow.
 */
function KeepPopoverInView({ lat, lng, n }: { lat: number; lng: number; n: number }) {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        const pos = { lat, lng };
        const proj = map.getProjection();
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        if (!proj || !bounds || zoom == null) {
            map.panTo(pos);
            return;
        }
        const scale = 2 ** zoom;
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const nw = proj.fromLatLngToPoint({ lat: ne.lat(), lng: sw.lng() });
        const pt = proj.fromLatLngToPoint(pos);
        if (!nw || !pt) {
            map.panTo(pos);
            return;
        }
        const div = map.getDiv();
        const w = div.clientWidth;
        const h = div.clientHeight;
        const x = (pt.x - nw.x) * scale;
        const y = (pt.y - nw.y) * scale;
        const fits = y >= POPOVER_ROOM.above && y <= h - POPOVER_ROOM.below && x >= POPOVER_ROOM.side && x <= w - POPOVER_ROOM.side;
        if (fits) return;
        const below = Math.max(0, Math.min(POPOVER_ROOM.above - h / 2 + 16, h / 2 - POPOVER_ROOM.below - 24));
        const target = proj.fromPointToLatLng(new google.maps.Point(pt.x, pt.y - below / scale));
        map.panTo(target ?? pos);
        // `n` re-runs this when the same pin is chosen again.
    }, [map, lat, lng, n]);
    return null;
}

/**
 * Frame the camera when `fit.key` changes (radius, position, the pin count
 * when there is no radius), and not on every data update: the old map
 * re-fitted on each new pin and the camera jumped while geocoding finished.
 */
function FitCamera({ fit }: { fit: CameraFit | null }) {
    const map = useMap();
    const lastKey = useRef<string | null>(null);
    useEffect(() => {
        if (!map || !fit || lastKey.current === fit.key) return;
        lastKey.current = fit.key;
        map.fitBounds(fit.bounds, 24);
    }, [map, fit]);
    return null;
}

/** The board's dashed radius ring, in the meta-text grey. Google's Circle cannot dash, so it is a dashed polyline. */
function RadiusRing({ center, km }: { center: LatLng; km: number }) {
    const path = useMemo(() => circlePath(center, km), [center, km]);
    // Google draws on a canvas and needs a real colour, so read the token's value.
    const [color] = useState(() => getComputedStyle(document.documentElement).getPropertyValue("--r1-ink-3").trim() || undefined);
    return (
        <Polyline
            path={path}
            clickable={false}
            strokeOpacity={0}
            zIndex={0}
            icons={[{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: color, strokeWeight: 1.5, scale: 3 }, offset: "0", repeat: "10px" }]}
        />
    );
}

/** The creator: a ring with "You" beside it (board LeadsMap). */
function YouMarker({ loc }: { loc: LatLng }) {
    return (
        <AdvancedMarker position={loc} zIndex={0} anchorLeft="-50%" anchorTop="-50%">
            <span role="img" aria-label="You are here" className="relative block size-4 rounded-full border-2 border-r1-ink bg-r1-paper">
                <span
                    aria-hidden="true"
                    className="absolute left-[22px] top-1/2 -translate-y-1/2 whitespace-nowrap font-r1-sans text-xs font-medium leading-4 text-r1-ink-2 [text-shadow:0_0_3px_var(--r1-paper),0_0_3px_var(--r1-paper)]"
                >
                    You
                </span>
            </span>
        </AdvancedMarker>
    );
}

/**
 * Resolves address strings to lat/lng with the Google Maps Geocoder, once per
 * address (the parent caches results keyed by row). Lives inside
 * <APIProvider> so useMapsLibrary can hand back the loaded geocoding library.
 *
 * Geocoding API quota: 50 QPS / 100k req/day on the free tier, plenty for a
 * typical creator's lead set.
 */
function AddressGeocoder({ pending, onResolved }: { pending: Array<{ id: string; address: string }>; onResolved: (id: string, lat: number, lng: number) => void }) {
    const geocodingLib = useMapsLibrary("geocoding");
    const inFlightRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!geocodingLib || pending.length === 0) return;
        const geocoder = new geocodingLib.Geocoder();
        for (const item of pending) {
            if (inFlightRef.current.has(item.id)) continue;
            inFlightRef.current.add(item.id);
            geocoder
                .geocode({ address: item.address })
                .then((res) => {
                    const loc = res.results[0]?.geometry.location;
                    if (loc) onResolved(item.id, loc.lat(), loc.lng());
                })
                .catch((err: unknown) => {
                    // Silent: most failures are address-format issues we cannot
                    // recover from. Logged so devs can diagnose.
                    console.warn(`[geocoder] failed for "${item.address}":`, err instanceof Error ? err.message : err);
                });
        }
    }, [geocodingLib, pending, onResolved]);

    return null;
}
