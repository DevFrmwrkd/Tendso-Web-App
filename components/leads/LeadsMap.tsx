"use client";

/**
 * Multi-marker map for the creator-side /leads/near page.
 *
 * Uses Leaflet (already in the project deps) + OpenStreetMap tiles so no
 * Google Maps API key is required. Each lead renders as a status-colored
 * pin centered on its lat/lng; clicking a pin opens a popup with the
 * business name + a "View detail" link to /leads/[leadId].
 *
 * Client-only — Leaflet relies on `window`. The page that uses this
 * component imports it lazily via next/dynamic with ssr:false.
 */
import { useEffect, useRef } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LeadPin = {
    _id: any;
    lat: number;
    lng: number;
    businessName: string;
    businessAddress: string | null;
    businessCity: string | null;
    status: string;
    source: string;
    hasLiveWebsite: boolean;
    distanceKm?: number;
};

// Tiny status → marker color map (matches the Editorial Paper status palette).
const STATUS_COLOR: Record<string, string> = {
    new: "#1F3654",
    contacted: "#C68A12",
    qualified: "#6D28D9",
    converted: "#064E3B",
    lost: "#B43A1F",
};

/**
 * Build a Leaflet `divIcon` so we don't depend on the bundled marker PNG
 * assets (which break under turbopack without manual path config). Each
 * marker is a colored SVG droplet with a white border so it pops on the
 * OSM tile layer.
 */
function leadIcon(color: string, hasLiveWebsite: boolean): L.DivIcon {
    const ring = hasLiveWebsite ? "var(--ed-accent-solid, #10B981)" : "rgba(255,255,255,0.9)";
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
            <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.27 21.73 0 14 0z"
                  fill="${color}" stroke="${ring}" stroke-width="2"/>
            <circle cx="14" cy="14" r="5" fill="white"/>
        </svg>
    `;
    return L.divIcon({
        html: svg,
        className: "leads-map-pin",
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        popupAnchor: [0, -32],
    });
}

// When the center prop changes, recenter the map. Without this the map stays
// pinned to its initial center even after geolocation resolves.
function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    const lastRef = useRef<string>("");
    useEffect(() => {
        const key = `${center[0]},${center[1]},${zoom}`;
        if (lastRef.current === key) return;
        lastRef.current = key;
        map.setView(center, zoom, { animate: true });
    }, [center, zoom, map]);
    return null;
}

export default function LeadsMap({
    leads,
    userLocation,
    fallbackCenter,
    height = 360,
}: {
    leads: LeadPin[];
    userLocation: { lat: number; lng: number } | null;
    fallbackCenter: { lat: number; lng: number };
    height?: number;
}) {
    const center: [number, number] = userLocation
        ? [userLocation.lat, userLocation.lng]
        : [fallbackCenter.lat, fallbackCenter.lng];
    const zoom = userLocation ? 13 : 6;

    return (
        <div
            style={{
                height,
                width: "100%",
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid var(--ed-rule)",
                position: "relative",
            }}
        >
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Recenter center={center} zoom={zoom} />

                {/* User location — solid blue circle so it reads as "you", not a business */}
                {userLocation && (
                    <CircleMarker
                        center={[userLocation.lat, userLocation.lng]}
                        radius={8}
                        pathOptions={{
                            color: "#fff",
                            weight: 2,
                            fillColor: "#3478F6",
                            fillOpacity: 1,
                        }}
                    >
                        <Popup>
                            <strong>You are here</strong>
                        </Popup>
                    </CircleMarker>
                )}

                {/* Business pins */}
                {leads.map((lead) => {
                    const color = STATUS_COLOR[lead.status] ?? "#1B1C24";
                    return (
                        <Marker
                            key={String(lead._id)}
                            position={[lead.lat, lead.lng]}
                            icon={leadIcon(color, lead.hasLiveWebsite)}
                        >
                            <Popup>
                                <div style={{ fontFamily: "var(--ed-sans, system-ui)", minWidth: 180 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                                        {lead.businessName}
                                    </div>
                                    {(lead.businessAddress || lead.businessCity) && (
                                        <div style={{ fontSize: 12, color: "#3C3F4A", marginBottom: 6 }}>
                                            {lead.businessAddress ?? lead.businessCity}
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            display: "inline-block",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.06em",
                                            padding: "2px 8px",
                                            borderRadius: 999,
                                            background: color,
                                            color: "#fff",
                                            marginBottom: 8,
                                        }}
                                    >
                                        {lead.status}
                                    </div>
                                    {lead.hasLiveWebsite && (
                                        <div
                                            style={{
                                                display: "inline-block",
                                                fontSize: 10,
                                                fontWeight: 700,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                                padding: "2px 8px",
                                                borderRadius: 999,
                                                background: "#10B981",
                                                color: "#fff",
                                                marginBottom: 8,
                                                marginLeft: 4,
                                            }}
                                        >
                                            Live
                                        </div>
                                    )}
                                    {typeof lead.distanceKm === "number" && (
                                        <div style={{ fontSize: 11, color: "#7A7E8A", marginBottom: 8 }}>
                                            {lead.distanceKm < 1
                                                ? `${Math.round(lead.distanceKm * 1000)} m away`
                                                : lead.distanceKm < 10
                                                    ? `${lead.distanceKm.toFixed(1)} km away`
                                                    : `${Math.round(lead.distanceKm)} km away`}
                                        </div>
                                    )}
                                    <Link
                                        href={`/leads/${lead._id}`}
                                        style={{
                                            display: "inline-block",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: "#047857",
                                            textDecoration: "none",
                                        }}
                                    >
                                        View detail →
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
