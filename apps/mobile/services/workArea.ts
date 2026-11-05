import { workAreaForMap } from '../../../lib/fieldAgentOnboarding';

export type MapCoordinate = { latitude: number; longitude: number };
export type WorkAreaAccount = {
  workCity?: string;
  workLatitude?: number;
  workLongitude?: number;
  workLocationSource?: 'city' | 'device';
};
export type MapSearchArea = MapCoordinate & {
  /** A saved work area is never a claim about the phone's current position. */
  source: 'work' | 'device';
  label: string;
};

export function validMapCoordinate(value: MapCoordinate | null | undefined): value is MapCoordinate {
  return !!value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;
}

/** Explicitly requesting GPS takes priority; otherwise use the saved work area. */
export function mapSearchArea(
  account: WorkAreaAccount | null | undefined,
  currentLocation?: MapCoordinate | null,
): MapSearchArea | null {
  if (validMapCoordinate(currentLocation)) return { ...currentLocation, source: 'device', label: 'you' };
  const workArea = workAreaForMap(account);
  if (!workArea) return null;
  return { ...workArea, source: 'work', label: account?.workCity?.trim() || 'your work area' };
}

/** Add an origin to saved-area distances so city-center distances are not shown as "away". */
export function mapDistanceLabel(km: number | null, area: MapSearchArea | null): string {
  if (km == null || !Number.isFinite(km)) return 'Distance unavailable';
  const distance = km < 1 ? `${Math.round(km * 1000)} m`
    : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  return area?.source === 'work' ? `${distance} from ${area.label}` : `${distance} away`;
}

/** Bound GPS/permission work so an unavailable fix never leaves the map loading forever. */
export async function withLocationTimeout<T>(operation: Promise<T>, timeoutMs = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Location timed out')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
