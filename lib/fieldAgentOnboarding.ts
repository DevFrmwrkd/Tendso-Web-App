/** Approximate city centres for the field-agent work-area chips and map. */
export const FIELD_AGENT_CITIES = [
    { name: 'Marikina', latitude: 14.6507, longitude: 121.1029 },
    { name: 'Quezon City', latitude: 14.6760, longitude: 121.0437 },
    { name: 'Pasig', latitude: 14.5764, longitude: 121.0851 },
    { name: 'Manila', latitude: 14.5995, longitude: 120.9842 },
    { name: 'Antipolo', latitude: 14.6255, longitude: 121.1245 },
    { name: 'Makati', latitude: 14.5547, longitude: 121.0244 },
    { name: 'Taguig', latitude: 14.5176, longitude: 121.0509 },
    { name: 'Cebu City', latitude: 10.3157, longitude: 123.8854 },
    { name: 'Davao', latitude: 7.0731, longitude: 125.6128 },
    { name: 'Iloilo', latitude: 10.7202, longitude: 122.5621 },
    { name: 'Baguio', latitude: 16.4023, longitude: 120.5960 },
] as const;

export const FIELD_AGENT_WORK_CITIES = FIELD_AGENT_CITIES;

export const FIELD_AGENT_DISCOVERY_SOURCES = ['friend', 'facebook', 'tiktok', 'shop_website', 'job_post'] as const;
export type FieldAgentDiscoverySource = typeof FIELD_AGENT_DISCOVERY_SOURCES[number];
export type DiscoverySource = FieldAgentDiscoverySource;
export type WorkLocationSource = 'city' | 'device';

export const DISCOVERY_SOURCES = [
    { value: 'friend', label: 'A friend or another agent' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'shop_website', label: 'A shop’s Tendso site' },
    { value: 'job_post', label: 'A job post' },
] as const satisfies readonly { value: DiscoverySource; label: string }[];

export function normalizeWorkCity(value: string): string {
    const city = value.trim().replace(/\s+/g, ' ');
    if (!city || city.length > 100 || /[\u0000-\u001f\u007f]/.test(city)) {
        throw new Error('Enter a city between 1 and 100 characters');
    }
    return FIELD_AGENT_CITIES.find((item) => item.name.toLowerCase() === city.toLowerCase())?.name ?? city;
}

export function isValidWorkCoordinates(latitude: unknown, longitude: unknown): latitude is number {
    return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
        && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

/** Keep chip centres authoritative on the server; permission is optional for manual cities. */
export function normalizeWorkArea(input: {
    city: string;
    latitude?: number;
    longitude?: number;
    source: WorkLocationSource;
}): { city: string; latitude?: number; longitude?: number; source: WorkLocationSource } {
    const city = normalizeWorkCity(input.city);
    if (input.source !== 'city' && input.source !== 'device') throw new Error('Invalid work location source');
    const hasCoordinates = input.latitude !== undefined || input.longitude !== undefined;
    if ((hasCoordinates || input.source === 'device') && !isValidWorkCoordinates(input.latitude, input.longitude)) {
        throw new Error('Provide a valid latitude and longitude together');
    }
    const knownCity = FIELD_AGENT_CITIES.find((item) => item.name === city);
    const point = input.source === 'city' && knownCity ? knownCity : input;
    return { city, latitude: point.latitude, longitude: point.longitude, source: input.source };
}

/** A saved work area centres the map without requesting the phone's location. */
export function workAreaForMap(account: {
    workCity?: string;
    workLatitude?: number;
    workLongitude?: number;
} | null | undefined): { latitude: number; longitude: number } | null {
    if (!account) return null;
    if (isValidWorkCoordinates(account.workLatitude, account.workLongitude)) {
        return { latitude: account.workLatitude, longitude: account.workLongitude! };
    }
    const city = account.workCity?.trim().replace(/\s+/g, ' ').toLowerCase();
    const knownCity = FIELD_AGENT_CITIES.find((item) => item.name.toLowerCase() === city);
    return knownCity ? { latitude: knownCity.latitude, longitude: knownCity.longitude } : null;
}
