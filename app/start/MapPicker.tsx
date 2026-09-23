"use client";

/**
 * The desktop map picker for /start step 1.
 *
 * WHY THIS EXISTS. The phone card says "Tap this while you're standing at the
 * shop" and asks the browser for a GPS fix. That is a true sentence on a phone
 * and a false one on a desk: a laptop has no GPS, so `getCurrentPosition` there
 * resolves from wifi and IP and lands somewhere between the right barangay and
 * the wrong city — and it does it with the same confident "Location saved" tick.
 * A wrong pin is worse than no pin, because it ships to the finished site and
 * nobody checks it again. So on a desk the owner places the pin themselves, on
 * a map they can see, and the geolocation button is not offered at all.
 *
 * WHAT THE GEOCODE IS AND IS NOT. The address typed above decides where the map
 * OPENS. It never places the pin. A geocoded address is a guess about a string;
 * the pin is the owner pointing at their own shop, and those are different
 * claims. Centring on a guess is a convenience — asserting it as the answer
 * would be the same class of mistake as writing copy nobody said.
 *
 * Follows components/landing/LiveMap.tsx exactly on the mechanics: raw Leaflet
 * behind a dynamic import so it stays out of the SSR bundle, the stylesheet
 * imported as a side effect, tiles through withCartoKey, and a divIcon rather
 * than Leaflet's default marker — whose icon URLs break under bundlers.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, LeafletMouseEvent } from "leaflet";

import { withCartoKey } from "@/lib/carto";

export interface Coordinates {
    lat: number;
    lng: number;
}

/** Roughly the centre of the Philippines, wide enough to show the whole
 *  archipelago. Only used when there is no pin and the address could not be
 *  placed — a starting view, and an honest one: we do not know yet. */
const PH_CENTER: [number, number] = [12.8797, 121.774];
const PH_ZOOM = 5;
/** Close enough to pick out a street corner, which is the unit a sari-sari
 *  store is actually found in. */
const PIN_ZOOM = 17;
/** A geocoded address is only ever street-accurate at best, so the map opens a
 *  little wider than it does over a real pin. */
const ADDRESS_ZOOM = 16;

/** Long enough that typing an address is one request, not one per keystroke.
 *  /api/geocode allows ten a minute per IP and Nominatim allows one a second
 *  across all of us, so the debounce is doing real work, not smoothing. */
const GEOCODE_DEBOUNCE_MS = 1200;

/** The brand pin: --rust, with a white centre so it reads against the warm
 *  Voyager tiles. A teardrop anchored at its point, unlike LiveMap's circular
 *  markers which are anchored at their centre — this one has to say precisely
 *  WHERE, not just roughly what. */
function makePinIcon(L: typeof import("leaflet")) {
    const html = `
    <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 41C16 41 30 24.5 30 15A14 14 0 1 0 2 15c0 9.5 14 26 14 26z"
            fill="#C89548" stroke="#6B4F1F" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="16" cy="15" r="5" fill="white"/>
    </svg>`;
    return L.divIcon({
        html,
        className: "start-pin",
        iconSize: [32, 42],
        iconAnchor: [16, 41],
    });
}

export default function MapPicker({
    value,
    onChange,
    address,
    disabled,
}: {
    value: Coordinates | null;
    onChange: (next: Coordinates | null) => void;
    /** The assembled address from step 1, used only to centre the map. */
    address: string;
    disabled?: boolean;
}) {
    const elRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const markerRef = useRef<Marker | null>(null);
    const [ready, setReady] = useState(false);
    const [addressStatus, setAddressStatus] = useState<"idle" | "looking" | "missed">("idle");

    /** The last query actually sent, so an unrelated re-render does not re-ask
     *  Nominatim the same question. */
    const lastQueryRef = useRef<string | null>(null);
    /** Read inside Leaflet handlers, which close over their first render. A ref
     *  keeps them looking at the current callback instead of a stale one. */
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);
    /** Whether a pin exists, for the geocode effect — which must not yank the
     *  map away from a pin the owner has already placed. Same staleness problem,
     *  same fix. */
    const hasPinRef = useRef(!!value);
    useEffect(() => {
        hasPinRef.current = !!value;
    }, [value]);

    // ── Mount the map once ────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!elRef.current || mapRef.current) return;
            const L = await import("leaflet");
            // @ts-expect-error — CSS side-effect import; no .d.ts for stylesheet
            await import("leaflet/dist/leaflet.css");
            if (cancelled || !elRef.current) return;

            const map = L.map(elRef.current, {
                center: value ? [value.lat, value.lng] : PH_CENTER,
                zoom: value ? PIN_ZOOM : PH_ZOOM,
                minZoom: 4,
                maxZoom: 19,
                zoomControl: true,
                // A picker must not eat the page scroll — the owner is halfway
                // down a form and still has fields below this card.
                scrollWheelZoom: false,
                // Off on purpose: Leaflet fires `click` twice for a double-click,
                // so zooming by double-tap would also drop a pin. The zoom
                // buttons and drag cover everything this needs.
                doubleClickZoom: false,
                attributionControl: false,
            });
            L.tileLayer(withCartoKey("https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"), {
                attribution: "",
                maxZoom: 19,
            }).addTo(map);

            map.on("click", (event: LeafletMouseEvent) => {
                const { lat, lng } = event.latlng;
                onChangeRef.current({ lat, lng });
            });

            mapRef.current = map;
            setReady(true);
        })();

        return () => {
            cancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
        // Mount-only: `value` is read for the opening view and then owned by the
        // marker effect below. Re-running this would tear down a live map.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Keep the marker in step with `value` ──────────────────────────────────
    useEffect(() => {
        if (!ready || !mapRef.current) return;
        let cancelled = false;
        (async () => {
            const L = await import("leaflet");
            if (cancelled || !mapRef.current) return;

            if (!value) {
                if (markerRef.current) {
                    markerRef.current.remove();
                    markerRef.current = null;
                }
                return;
            }

            if (markerRef.current) {
                markerRef.current.setLatLng([value.lat, value.lng]);
                return;
            }

            const marker = L.marker([value.lat, value.lng], {
                icon: makePinIcon(L),
                draggable: true,
                keyboard: true,
                title: "Your shop — drag to adjust",
            }).addTo(mapRef.current);
            marker.on("dragend", () => {
                const { lat, lng } = marker.getLatLng();
                onChangeRef.current({ lat, lng });
            });
            markerRef.current = marker;
            // The first pin is the one worth flying to. Later ones come from the
            // owner clicking or dragging somewhere they can already see, and
            // moving the map under them then would be motion sickness.
            mapRef.current.flyTo([value.lat, value.lng], Math.max(mapRef.current.getZoom(), PIN_ZOOM), {
                duration: 0.6,
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [ready, value]);

    // ── Open the map near the address they typed ──────────────────────────────
    useEffect(() => {
        if (!ready) return;
        const query = address.trim();
        // Under ~8 characters there is no address yet, only the beginning of
        // one, and asking about it wastes one of ten requests a minute.
        if (query.length < 8 || query === lastQueryRef.current) return;
        if (hasPinRef.current) return;

        const timer = setTimeout(async () => {
            if (hasPinRef.current) return;
            lastQueryRef.current = query;
            setAddressStatus("looking");
            try {
                const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
                const body = (await response.json()) as { result?: Coordinates | null };
                // Re-checked after the await: the owner may have placed a pin
                // while the request was in flight, and theirs wins.
                if (!mapRef.current || hasPinRef.current) return;
                if (body.result) {
                    mapRef.current.flyTo([body.result.lat, body.result.lng], ADDRESS_ZOOM, { duration: 0.8 });
                    setAddressStatus("idle");
                } else {
                    setAddressStatus("missed");
                }
            } catch {
                // A geocode is a convenience. Failing it silently leaves a
                // usable map; saying "something went wrong" over a thing the
                // owner never asked for would just be noise.
                setAddressStatus("missed");
            }
        }, GEOCODE_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [ready, address]);

    const clearPin = useCallback(() => onChange(null), [onChange]);

    return (
        <div>
            <div className="relative overflow-hidden rounded-xl border border-ink/15">
                <div
                    ref={elRef}
                    className="h-[19rem] w-full bg-khaki-deep"
                    // Leaflet's own panes sit at z-index 400+; without a stacking
                    // context here they would climb over the sticky phone header
                    // at narrower desktop widths.
                    style={{ isolation: "isolate" }}
                />
                {!ready ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-khaki-deep">
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                            Loading map…
                        </span>
                    </div>
                ) : null}
                {disabled ? <div className="absolute inset-0 cursor-not-allowed bg-khaki/40" /> : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="text-[13px] leading-snug text-ink-soft">
                    {value ? (
                        <>
                            <span aria-hidden style={{ color: "var(--rust)" }}>
                                ✓
                            </span>{" "}
                            Pin placed. Drag it if it&apos;s not quite right.
                        </>
                    ) : addressStatus === "looking" ? (
                        "Finding your address on the map…"
                    ) : addressStatus === "missed" ? (
                        "We couldn't find that address — pan to your area and click to drop the pin."
                    ) : (
                        "Click the map where your shop is."
                    )}
                </p>
                {value ? (
                    <button
                        type="button"
                        onClick={clearPin}
                        disabled={disabled}
                        className="text-[13px] font-semibold text-ink-soft underline underline-offset-2 transition-colors hover:text-ink disabled:opacity-40"
                    >
                        Remove pin
                    </button>
                ) : null}
            </div>

            {/* CARTO and OSM both require credit. LiveMap turns Leaflet's own
                control off because it collides with that page's chrome; the
                credit is given here as plain text instead. */}
            <p className="mt-2 text-[11px] leading-snug text-ink-soft/70">
                Map data © OpenStreetMap contributors, tiles © CARTO
            </p>
        </div>
    );
}
