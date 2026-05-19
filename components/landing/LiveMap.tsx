"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, DivIcon, Marker } from "leaflet";
import type { Creator, LiveBusiness, Region } from "./landingData";

type Props = {
    region: Region;
    filter: "all" | "creators" | "businesses";
    creators: Creator[];
    businesses: LiveBusiness[];
    onSelectCreator?: (c: Creator) => void;
    onSelectBusiness?: (b: LiveBusiness) => void;
};

// Custom SVG pin builders — shape carries meaning (a11y over color alone).
function makeCreatorIcon(L: typeof import("leaflet")): DivIcon {
    const size = 30;
    const fill = "oklch(45% 0.12 150)";
    const stroke = "oklch(28% 0.08 150)";
    const html = `
    <div class="pin-wrap" style="width:${size}px;height:${size}px;">
      <svg class="pin-svg" width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="11" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <circle cx="16" cy="16" r="4" fill="white" opacity=".95"/>
      </svg>
    </div>`;
    return L.divIcon({ html, className: "pin-creator", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function makeBusinessIcon(L: typeof import("leaflet")): DivIcon {
    const size = 26;
    const fill = "oklch(34% 0.10 245)";
    const stroke = "oklch(22% 0.10 250)";
    const html = `
    <div class="pin-wrap" style="width:${size}px;height:${size}px;">
      <svg class="pin-svg" width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="20" height="20" fill="${fill}" stroke="${stroke}" stroke-width="2" transform="rotate(45 16 16)"/>
        <rect x="13" y="13" width="6" height="6" fill="white" opacity=".95" transform="rotate(45 16 16)"/>
      </svg>
    </div>`;
    return L.divIcon({ html, className: "pin-business", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

export default function LiveMap({
    region,
    filter,
    creators,
    businesses,
    onSelectCreator,
    onSelectBusiness,
}: Props) {
    const elRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const creatorLayerRef = useRef<LayerGroup | null>(null);
    const businessLayerRef = useRef<LayerGroup | null>(null);
    const [ready, setReady] = useState(false);

    // Mount Leaflet client-side once. Dynamic import keeps it out of the SSR bundle.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!elRef.current || mapRef.current) return;
            const L = await import("leaflet");
            // @ts-expect-error — CSS side-effect import; no .d.ts for stylesheet
            await import("leaflet/dist/leaflet.css");
            if (cancelled || !elRef.current) return;

            const m = L.map(elRef.current, {
                center: region.center,
                zoom: region.zoom,
                minZoom: 3,
                maxZoom: 16,
                zoomControl: true,
                scrollWheelZoom: false,
                attributionControl: false,
            });
            L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
                attribution: "",
                subdomains: "abcd",
                maxZoom: 19,
            }).addTo(m);

            creatorLayerRef.current = L.layerGroup().addTo(m);
            businessLayerRef.current = L.layerGroup().addTo(m);
            mapRef.current = m;
            setReady(true);
        })();
        return () => {
            cancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [region.center, region.zoom]);

    // Re-fly when region changes
    useEffect(() => {
        if (mapRef.current && ready) {
            mapRef.current.flyTo(region.center, region.zoom, { duration: 0.8 });
        }
    }, [region.id, region.center, region.zoom, ready]);

    // Redraw markers when data or filter changes
    useEffect(() => {
        if (!ready || !mapRef.current || !creatorLayerRef.current || !businessLayerRef.current) return;
        let cancelled = false;
        (async () => {
            const L = await import("leaflet");
            if (cancelled) return;
            creatorLayerRef.current!.clearLayers();
            businessLayerRef.current!.clearLayers();

            if (filter !== "businesses") {
                const icon = makeCreatorIcon(L);
                creators.forEach((c) => {
                    const marker = L.marker([c.lat, c.lng], { icon, title: c.name }) as Marker;
                    marker.on("click", () => onSelectCreator?.(c));
                    marker.addTo(creatorLayerRef.current!);
                });
            }
            if (filter !== "creators") {
                const icon = makeBusinessIcon(L);
                businesses.forEach((b) => {
                    const marker = L.marker([b.lat, b.lng], { icon, title: b.name }) as Marker;
                    marker.on("click", () => onSelectBusiness?.(b));
                    marker.addTo(businessLayerRef.current!);
                });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [ready, filter, creators, businesses, onSelectCreator, onSelectBusiness]);

    return (
        <div className="map-frame" style={{ position: "relative", width: "100%", height: "100%" }}>
            <div ref={elRef} className="leafmap" style={{ width: "100%", height: "100%" }} />
            {!ready && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--neo-ink-3)",
                        background: "var(--neo-paper-2)",
                        borderRadius: "inherit",
                    }}
                    className="label"
                >
                    Loading map…
                </div>
            )}
        </div>
    );
}
