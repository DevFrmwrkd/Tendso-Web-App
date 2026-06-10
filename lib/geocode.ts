/**
 * Build-time geocoder for the website generator.
 *
 * Resolves an address string to { lat, lng } via OpenStreetMap Nominatim.
 * Used by lib/astro-builder.ts:transformToAstroData() when neither the
 * admin nor the submission supplied coordinates, so the Leaflet map on
 * the generated site points at the actual business location instead of
 * a per-template fallback (Mission St / Linden Ave / Granite Rd / etc).
 *
 * Same provider that convex/leads.ts uses for the discover-map view —
 * keeps everything on the free tier and consistent with how leads are
 * pinned in admin.
 *
 * Rate limit: Nominatim's public endpoint allows 1 req/s and requires a
 * User-Agent that identifies the app. We pass NEGOSYO_DIGITAL_UA + the
 * existing email contact so we stay within the AUP.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'Tendso/1.0 (frmwrkd.media@gmail.com)';

export interface GeocodeResult {
    lat: number;
    lng: number;
}

/**
 * Geocode a free-form address string to coordinates. Returns null on
 * timeout, network error, or zero results. Caller should fall back
 * gracefully (e.g. hide the map or use a default region centroid).
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
    if (!address || typeof address !== 'string') return null;
    const trimmed = address.trim();
    if (trimmed.length < 4) return null;

    const url = new URL(NOMINATIM);
    url.searchParams.set('q', trimmed);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '0');

    try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 6000);
        const res = await fetch(url.toString(), {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            signal: ac.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const top = arr[0];
        const lat = Number(top.lat);
        const lng = Number(top.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    } catch {
        return null;
    }
}
