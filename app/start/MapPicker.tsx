"use client";

import {
    APIProvider,
    APILoadingStatus,
    Map as GoogleMap,
    useApiLoadingStatus,
    type MapCameraChangedEvent,
} from "@vis.gl/react-google-maps";
import {
    ExternalLink,
    LocateFixed,
    MapPin,
    Maximize2,
    Minimize2,
    Minus,
    Plus,
    Search,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button, ButtonLink } from "@/components/r1/Button";
import { Field, Input } from "@/components/r1/Field";
import { Icon } from "@/components/r1/Icon";
import { Status } from "@/components/r1/Status";
import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMaps";

export interface Coordinates {
    lat: number;
    lng: number;
}

type Props = {
    value: Coordinates | null;
    onChange: (next: Coordinates | null) => void;
    address: string;
    disabled?: boolean;
};
const PH_CENTER: Coordinates = { lat: 12.8797, lng: 121.774 };
const STREET_ZOOM = 17;
const MIN_CONFIRM_ZOOM = 15;

/** Google can reject a key after its script loads, outside the SDK loading status. */
export function listenForMapAuthFailure(
    target: { gm_authFailure?: () => void },
    onFailure: () => void,
) {
    const previous = target.gm_authFailure;
    const hadOwnHandler = Object.prototype.hasOwnProperty.call(target, "gm_authFailure");
    let active = true;
    const handler = () => {
        if (active) onFailure();
        if (typeof previous === "function") previous.call(target);
    };
    target.gm_authFailure = handler;
    return () => {
        active = false;
        if (target.gm_authFailure !== handler) return;
        if (hadOwnHandler) target.gm_authFailure = previous;
        else delete target.gm_authFailure;
    };
}

function validCoordinates(value: Coordinates): boolean {
    return (
        Number.isFinite(value.lat) &&
        Math.abs(value.lat) <= 90 &&
        Number.isFinite(value.lng) &&
        Math.abs(value.lng) <= 180
    );
}

/** Google’s standard basemap keeps nearby businesses and landmarks visible. */
export default function MapPicker(props: Props) {
    if (!GOOGLE_MAPS_API_KEY) return <MapUnavailable {...props} />;
    return (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <LocationPicker {...props} />
        </APIProvider>
    );
}

function MapUnavailable({ value, onChange, disabled }: Props) {
    return (
        <div
            className="rounded-r1 border border-r1-line bg-r1-fill-2 p-4"
            role="status"
        >
            <p className="text-sm font-semibold">
                The map is unavailable right now.
            </p>
            <p className="t-meta mt-2">
                Your written address is saved. You can continue without a pin,
                or reload this page to try the map again.
            </p>
            {value ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    <ButtonLink
                        className="min-h-11"
                        variant="ghost"
                        href={`https://www.google.com/maps/search/?api=1&query=${value.lat},${value.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View saved pin
                        <Icon icon={ExternalLink} />
                    </ButtonLink>
                    <Button
                        variant="ghost"
                        className="min-h-11"
                        disabled={disabled}
                        onClick={() => onChange(null)}
                    >
                        Remove pin
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

function LocationPicker({ value, onChange, address, disabled = false }: Props) {
    const status = useApiLoadingStatus();
    const instructionId = useId();
    const [camera, setCamera] = useState(() => ({
        center: value ?? PH_CENTER,
        zoom: value ? STREET_ZOOM : 6,
    }));
    const [editing, setEditing] = useState(() => !value);
    const [candidate, setCandidate] = useState(false);
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState<"search" | "location" | null>(null);
    const [message, setMessage] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [satellite, setSatellite] = useState(false);
    const [loadTimedOut, setLoadTimedOut] = useState(false);
    const [authFailed, setAuthFailed] = useState(false);
    const requestRef = useRef(0);
    const abortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);
    const disabledRef = useRef(disabled);
    const valueRef = useRef(value);
    const cameraRef = useRef(camera);

    const cancelRequests = useCallback(() => {
        requestRef.current += 1;
        abortRef.current?.abort();
        setBusy(null);
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            requestRef.current += 1;
            abortRef.current?.abort();
        };
    }, []);

    // Register before APIProvider's script-loading effect, preserving other maps.
    useEffect(() => listenForMapAuthFailure(
        window as Window & { gm_authFailure?: () => void },
        () => { if (mountedRef.current) setAuthFailed(true); },
    ), []);

    useEffect(() => {
        disabledRef.current = disabled;
        valueRef.current = value;
        cameraRef.current = camera;
    }, [disabled, value, camera]);

    useEffect(() => {
        if (!disabled) return;
        cancelRequests();
    }, [disabled, cancelRequests]);

    useEffect(() => {
        if (status === APILoadingStatus.LOADED) return;
        const timeout = setTimeout(() => setLoadTimedOut(true), 20_000);
        return () => clearTimeout(timeout);
    }, [status]);

    // A restored/externally changed draft takes precedence over pending suggestions.
    const savedLat = value?.lat;
    const savedLng = value?.lng;
    useEffect(() => {
        requestRef.current += 1;
        abortRef.current?.abort();
        // Synchronize the external confirmed value, never a lookup result.
        setBusy(null);
        setEditing(savedLat === undefined || savedLng === undefined);
        setCandidate(false);
        setMessage("");
        if (savedLat !== undefined && savedLng !== undefined) {
            setCamera({
                center: { lat: savedLat, lng: savedLng },
                zoom: STREET_ZOOM,
            });
        }
    }, [savedLat, savedLng]);

    const failed =
        authFailed ||
        status === APILoadingStatus.FAILED ||
        status === APILoadingStatus.AUTH_FAILURE ||
        (loadTimedOut && status !== APILoadingStatus.LOADED);
    const ready = status === APILoadingStatus.LOADED;
    const saved = !!value && !editing;
    const active = ready && editing && !disabled;

    const suggestion = (coordinates: Coordinates, label: string) => {
        setCamera({ center: coordinates, zoom: STREET_ZOOM });
        setCandidate(true);
        setMessage(label);
    };

    const findAddress = async (text: string) => {
        if (!active || !text.trim()) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const request = ++requestRef.current;
        const startingValue = valueRef.current;
        setBusy("search");
        setMessage("");
        try {
            // Reuse the public server lookup: no extra Google service or autocomplete dependency.
            const trimmed = text.trim().slice(0, 300);
            const searchAddress = /\bphilippines\b/i.test(trimmed)
                ? trimmed
                : `${trimmed.slice(0, 287)}, Philippines`;
            const response = await fetch(
                `/api/geocode?q=${encodeURIComponent(searchAddress)}`,
                { signal: controller.signal },
            );
            if (!response.ok) throw new Error("Address search unavailable");
            const body = (await response.json()) as {
                result?: Coordinates | null;
            };
            if (
                !mountedRef.current ||
                disabledRef.current ||
                request !== requestRef.current ||
                startingValue !== valueRef.current
            )
                return;
            if (body.result && validCoordinates(body.result))
                suggestion(
                    body.result,
                    "The map opened near that address. Check nearby businesses and move the pin to your shop’s entrance.",
                );
            else
                setMessage(
                    "No matching address found. Try your street and city, or a nearby landmark. You can also move the map yourself.",
                );
        } catch {
            if (
                mountedRef.current &&
                !disabledRef.current &&
                request === requestRef.current
            ) {
                setMessage(
                    "Address search is unavailable right now. You can still move the map or use your current location.",
                );
            }
        } finally {
            if (mountedRef.current && request === requestRef.current)
                setBusy(null);
        }
    };

    const locate = () => {
        if (!active) return;
        abortRef.current?.abort();
        const request = ++requestRef.current;
        const startingValue = valueRef.current;
        if (!navigator.geolocation) {
            setBusy(null);
            setMessage(
                "This browser cannot share your location. Search your address or move the map instead.",
            );
            return;
        }
        setBusy("location");
        setMessage(
            "Waiting for location permission. Only use this if you’re at the shop.",
        );
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (
                    !mountedRef.current ||
                    disabledRef.current ||
                    request !== requestRef.current ||
                    startingValue !== valueRef.current
                )
                    return;
                setBusy(null);
                const coordinates = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                if (!validCoordinates(coordinates)) {
                    setMessage(
                        "Your location could not be found. Search your address or move the map instead.",
                    );
                    return;
                }
                const accuracy = position.coords.accuracy;
                const accuracyHint = Number.isFinite(accuracy)
                    ? ` Your device estimates accuracy within ${Math.max(1, Math.round(accuracy))} metres.`
                    : "";
                suggestion(
                    coordinates,
                    `This is your device’s location.${accuracyHint} Check the pin is at your shop before saving.`,
                );
            },
            (error) => {
                if (
                    !mountedRef.current ||
                    disabledRef.current ||
                    request !== requestRef.current
                )
                    return;
                setBusy(null);
                setMessage(
                    error.code === 1
                        ? "Location permission was denied. Search your address or move the map instead."
                        : "Your location could not be found. Search your address or move the map instead.",
                );
            },
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
        );
    };

    const editMap = () => {
        if (!active) return;
        cancelRequests();
        setCandidate(true);
        setMessage(
            "Move your shop’s entrance under the pin, then choose Use this spot.",
        );
    };

    const cameraChanged = (event: MapCameraChangedEvent) => {
        if (!editing || disabled) return;
        const next = { center: event.detail.center, zoom: event.detail.zoom };
        cameraRef.current = next;
        setCamera(next);
    };

    const confirm = () => {
        const next = cameraRef.current;
        if (
            !active ||
            !candidate ||
            next.zoom < MIN_CONFIRM_ZOOM ||
            !validCoordinates(next.center)
        )
            return;
        cancelRequests();
        setEditing(false);
        setMessage("");
        onChange({ ...next.center });
    };

    if (failed)
        return (
            <MapUnavailable
                value={value}
                onChange={onChange}
                address={address}
                disabled={disabled}
            />
        );

    return (
        <div className="flex min-w-0 flex-col gap-3">
            {!saved ? (
                <>
                    <Field
                        label="Search an address or nearby landmark"
                        help="Include the city so you can find the right area."
                    >
                        <div className="flex min-w-0 gap-2">
                            <Input
                                value={query}
                                maxLength={300}
                                placeholder="Street, landmark, city"
                                disabled={!active}
                                onChange={(event) => {
                                    cancelRequests();
                                    setQuery(event.target.value);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void findAddress(query);
                                    }
                                }}
                                className="min-w-0 flex-1"
                            />
                            <Button
                                className="min-h-11 min-w-11 shrink-0"
                                aria-label="Search the map"
                                disabled={!active || !query.trim()}
                                onClick={() => void findAddress(query)}
                            >
                                <Icon icon={Search} />
                            </Button>
                        </div>
                    </Field>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            className="min-h-11"
                            disabled={!active || !address.trim()}
                            onClick={() => {
                                setQuery(address);
                                void findAddress(address);
                            }}
                        >
                            Find entered address
                        </Button>
                        <Button
                            className="min-h-11"
                            disabled={!active || busy === "location"}
                            onClick={locate}
                        >
                            <Icon icon={LocateFixed} />
                            Use my location
                        </Button>
                    </div>
                </>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2" role="group" aria-label="Map view">
                    <Button
                        size="sm"
                        className="min-h-11"
                        aria-pressed={!satellite}
                        disabled={!ready || disabled}
                        onClick={() => setSatellite(false)}
                    >
                        Map
                    </Button>
                    <Button
                        size="sm"
                        className="min-h-11"
                        aria-pressed={satellite}
                        disabled={!ready || disabled}
                        onClick={() => setSatellite(true)}
                    >
                        Satellite
                    </Button>
                </div>
                <Button
                    size="sm"
                    className="min-h-11"
                    aria-expanded={expanded}
                    disabled={!ready || disabled}
                    onClick={() => setExpanded(!expanded)}
                >
                    <Icon icon={expanded ? Minimize2 : Maximize2} />
                    {expanded ? "Smaller map" : "Larger map"}
                </Button>
            </div>

            <div
                className={`relative isolate overflow-hidden rounded-r1 border border-r1-line-2 bg-r1-fill ${expanded ? "h-[min(70dvh,620px)] min-h-[360px]" : "h-[340px] sm:h-[380px]"}`}
                role="region"
                aria-label="Shop location on Google Maps"
                aria-describedby={instructionId}
                onPointerDownCapture={editMap}
                onWheelCapture={editMap}
                onKeyDownCapture={(event) => {
                    if (
                        [
                            "ArrowUp",
                            "ArrowDown",
                            "ArrowLeft",
                            "ArrowRight",
                            "+",
                            "-",
                            "=",
                        ].includes(event.key)
                    )
                        editMap();
                }}
            >
                <GoogleMap
                    center={camera.center}
                    zoom={camera.zoom}
                    onCameraChanged={cameraChanged}
                    mapTypeId={satellite ? "hybrid" : "roadmap"}
                    controlled={disabled || saved}
                    gestureHandling={
                        expanded && !saved ? "greedy" : "cooperative"
                    }
                    keyboardShortcuts={!disabled && !saved}
                    disableDefaultUI
                    clickableIcons
                    streetViewControl={false}
                    fullscreenControl={false}
                    minZoom={5}
                    maxZoom={21}
                    tilt={0}
                    onDragstart={editMap}
                    onClick={(event) => {
                        const center = event.detail.latLng;
                        if (!active || !center) return;
                        // Google’s place popup can pan the camera away from our fixed pin.
                        if (event.detail.placeId) event.stop();
                        editMap();
                        setCamera((previous) => ({
                            center,
                            zoom: Math.max(previous.zoom, MIN_CONFIRM_ZOOM),
                        }));
                    }}
                />
                {ready ? (
                    <>
                        <div
                            className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full text-r1-gold-ink"
                            aria-hidden="true"
                        >
                            <MapPin
                                size={44}
                                strokeWidth={2.2}
                                fill="var(--r1-gold)"
                            />
                        </div>
                        {!saved ? (
                            <div className="absolute bottom-12 right-3 z-10 flex flex-col gap-2">
                                <Button
                                    icon
                                    className="min-h-11 min-w-11 bg-r1-paper shadow-r1-menu"
                                    aria-label="Zoom in"
                                    disabled={!active || camera.zoom >= 21}
                                    onClick={() => {
                                        editMap();
                                        setCamera((previous) => ({
                                            ...previous,
                                            zoom: Math.min(
                                                21,
                                                previous.zoom + 1,
                                            ),
                                        }));
                                    }}
                                >
                                    <Icon icon={Plus} />
                                </Button>
                                <Button
                                    icon
                                    className="min-h-11 min-w-11 bg-r1-paper shadow-r1-menu"
                                    aria-label="Zoom out"
                                    disabled={!active || camera.zoom <= 5}
                                    onClick={() => {
                                        editMap();
                                        setCamera((previous) => ({
                                            ...previous,
                                            zoom: Math.max(
                                                5,
                                                previous.zoom - 1,
                                            ),
                                        }));
                                    }}
                                >
                                    <Icon icon={Minus} />
                                </Button>
                            </div>
                        ) : null}
                    </>
                ) : (
                    <div
                        className="absolute inset-0 flex items-center justify-center bg-r1-fill"
                        role="status"
                    >
                        <p className="t-meta">Loading Google Maps…</p>
                    </div>
                )}
            </div>

            <p id={instructionId} className="t-meta">
                {saved
                    ? "This pin is saved. Choose Change location to move it."
                    : "Move the map until your shop’s entrance is under the pin. You can also tap the map, or focus it and use the arrow keys. On a phone, use two fingers to move the small map."}
            </p>
            {busy || message ? (
                <p className="t-meta" role="status" aria-live="polite">
                    {busy === "search" ? "Searching the map…" : message}
                </p>
            ) : null}
            {saved ? (
                <div className="flex flex-wrap items-center gap-2">
                    <Status tone="done" className="mr-auto">
                        Shop pin saved
                    </Status>
                    <Button
                        className="min-h-11"
                        disabled={disabled}
                        onClick={() => {
                            cancelRequests();
                            setEditing(true);
                            setCandidate(true);
                        }}
                    >
                        Change location
                    </Button>
                    <Button
                        variant="ghost"
                        className="min-h-11"
                        disabled={disabled}
                        onClick={() => {
                            cancelRequests();
                            setEditing(true);
                            setCandidate(false);
                            onChange(null);
                        }}
                    >
                        Remove pin
                    </Button>
                    <ButtonLink
                        className="min-h-11"
                        variant="ghost"
                        href={`https://www.google.com/maps/search/?api=1&query=${value.lat},${value.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View pin
                        <Icon icon={ExternalLink} />
                    </ButtonLink>
                </div>
            ) : (
                <div className="flex flex-col items-start gap-2">
                    <Button
                        variant="primary"
                        size="lg"
                        disabled={
                            !active ||
                            !candidate ||
                            camera.zoom < MIN_CONFIRM_ZOOM
                        }
                        onClick={confirm}
                    >
                        Use this spot
                    </Button>
                    {candidate && camera.zoom < MIN_CONFIRM_ZOOM ? (
                        <p className="t-meta">
                            Zoom in until you can see your street before saving
                            the pin.
                        </p>
                    ) : null}
                    <p className="t-help">
                        The pin is optional. You can continue using your written
                        address.
                    </p>
                </div>
            )}
        </div>
    );
}
