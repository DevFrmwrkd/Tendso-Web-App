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
 * THE MECHANICS, and why each one: raw Leaflet behind a dynamic import, so it
 * stays out of the SSR bundle (Leaflet touches `window` the moment it loads);
 * its stylesheet imported as a side effect of that same import; tiles through
 * withCartoKey, because CARTO watermarks every tile requested without the key
 * (lib/carto.ts); and a divIcon rather than Leaflet's default marker, whose icon
 * URLs break under bundlers. The tiles are CARTO's quiet light style
 * (`light_all`): the Round 1 board draws this map as an almost colourless
 * sketch, and the pin is the only thing on it that should catch the eye.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, LeafletMouseEvent } from "leaflet";
import { MapPin } from "lucide-react";

import { Button, Icon, Status } from "@/components/r1";
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

/** The map's height, as drawn on the board. */
const MAP_HEIGHT = "h-[264px]";

/**
 * The brand pin: gold with a white centre and a soft ground shadow, and the
 * "Drag to adjust" tip beside it (board Start). A teardrop anchored at its
 * point, not a dot anchored at its centre: this one has to say precisely
 * WHERE, not just roughly what.
 *
 * Leaflet renders this as raw HTML outside React, so the colours are the
 * Round 1 tokens as CSS variables in style attributes (never hex), and the tip
 * names its font because .leaflet-container sets its own. The tip ignores the
 * pointer, so a drag that starts on it still grabs the pin.
 */
function makePinIcon(L: typeof import("leaflet")) {
    const html = `
    <span style="position:relative;display:block;width:32px;height:52px">
      <svg width="32" height="52" viewBox="0 0 32 52" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block">
        <ellipse cx="16" cy="47" rx="7" ry="2.5" style="fill:var(--r1-ink);opacity:.18"/>
        <path d="M16 45C16 45 30 28.5 30 19A14 14 0 1 0 2 19c0 9.5 14 26 14 26z"
              style="fill:var(--r1-gold);stroke:var(--r1-gold-ink);stroke-width:2;stroke-linejoin:round"/>
        <circle cx="16" cy="19" r="5" style="fill:var(--r1-paper)"/>
      </svg>
      <span style="position:absolute;left:42px;top:6px;display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:6px;background:var(--r1-ink);color:var(--r1-paper);font:500 12px/1 var(--r1-sans);white-space:nowrap;pointer-events:none">Drag to adjust</span>
    </span>`;
    return L.divIcon({
        html,
        className: "start-pin",
        iconSize: [32, 52],
        iconAnchor: [16, 45],
    });
}

type AddressStatus = "idle" | "looking" | "found" | "missed";

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
    const [addressStatus, setAddressStatus] = useState<AddressStatus>("idle");

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
            L.tileLayer(withCartoKey("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"), {
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
                    setAddressStatus("found");
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
        <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-r1 border border-r1-line-2 bg-r1-fill">
                <div
                    ref={elRef}
                    className={`${MAP_HEIGHT} w-full bg-r1-fill`}
                    // Leaflet's own panes sit at z-index 400+; without a stacking
                    // context here they would climb over the sticky action bar.
                    style={{ isolation: "isolate" }}
                />
                {!ready ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-r1-fill">
                        <span className="t-meta">Loading map…</span>
                    </div>
                ) : null}
                {/* The board's hint, held at the top rather than the middle: the
                    middle is where the geocoded address lands, the one spot the
                    owner is trying to see. It ignores the pointer, so a click
                    through it still drops the pin. */}
                {ready && !value && !disabled ? (
                    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
                        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-r1-line bg-r1-paper px-3.5 text-[13px] font-medium text-r1-ink shadow-r1-menu">
                            <Icon icon={MapPin} />
                            Click the map where your shop is
                        </span>
                    </div>
                ) : null}
                {disabled ? <div className="absolute inset-0 z-10 cursor-not-allowed bg-r1-paper/40" /> : null}
            </div>

            <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                {value ? (
                    <>
                        <Status tone="done" className="whitespace-normal">
                            Pin placed. Drag it if it&apos;s not quite right.
                        </Status>
                        <Button variant="ghost" size="sm" onClick={clearPin} disabled={disabled}>
                            Remove pin
                        </Button>
                    </>
                ) : (
                    <p className="t-meta" aria-live="polite">
                        {addressStatus === "looking"
                            ? "Finding your address on the map…"
                            : addressStatus === "missed"
                              ? "We couldn't find that address — pan to your area and click to drop the pin."
                              : addressStatus === "found"
                                ? "The map opened near the address you typed. It never places the pin for you."
                                : "The map moves to the address you type above. It never places the pin for you."}
                    </p>
                )}
            </div>

            {/* CARTO and OSM both require credit. Leaflet's own attribution
                control is off (attributionControl: false) so the corners of a
                small map stay clear for the zoom buttons and the pin; the
                credit is given here as plain text instead. */}
            <p className="t-help">Map data © OpenStreetMap contributors, tiles © CARTO</p>
        </div>
    );
}
