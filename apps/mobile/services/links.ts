/**
 * Outbound-link helpers.
 *
 * Three kinds of external link, three correct behaviours:
 *
 *  - DIRECTIONS  -> the NATIVE maps app (Apple Maps / Google Maps).
 *      An `https://google.com/maps/...` URL just dumps the user in Safari on
 *      iOS, and an in-app browser is worse still (a cramped web map with no
 *      turn-by-turn). Use `openDirections`.
 *
 *  - WEB PAGES   -> an IN-APP browser (SFSafariViewController / Custom Tabs)
 *      so the user keeps their place in the app. Use `openExternalUrl`.
 *
 *  - tel: / mailto: -> plain `Linking.openURL` (system handlers). Not wrapped
 *      here; those should keep using Linking directly.
 */
import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '../theme/tokens';

/**
 * Canonical public site. `negosyo-digital.com` is a legacy alias that still
 * serves the byte-identical deployment, but showing the pre-rename brand in
 * the URL bar of a "Tendso" app is confusing, and the alias is one lapsed
 * renewal away from breaking silently. Always link the canonical host.
 *
 * `www.` is deliberate: tendso.com 301s to www.tendso.com, and skipping that
 * hop avoids a visible redirect flash in the in-app browser.
 */
export const SITE_URL = 'https://www.tendso.com';

/** Legal pages. Centralised because App Review clicks these, and because
 *  having them in one place stops the two auth screens drifting apart. */
export const TERMS_URL = `${SITE_URL}/terms-of-service`;
export const PRIVACY_URL = `${SITE_URL}/privacy-policy`;

export type MapsTarget = {
  latitude?: number | null;
  longitude?: number | null;
  /** Business name — used when there are no coordinates. */
  label?: string | null;
  /** Street address — preferred over `label` when there are no coordinates. */
  address?: string | null;
  /** Google Place ID — most precise, used in the web fallback. */
  placeId?: string | null;
};

/** Coordinates when we have them, else the best available text query. */
function destination(t: MapsTarget): { dest: string; isCoords: boolean } {
  const hasCoords =
    typeof t.latitude === 'number' &&
    Number.isFinite(t.latitude) &&
    typeof t.longitude === 'number' &&
    Number.isFinite(t.longitude);
  if (hasCoords) return { dest: `${t.latitude},${t.longitude}`, isCoords: true };
  return { dest: (t.address || t.label || '').trim(), isCoords: false };
}

/**
 * A "lat,lng" pair must NOT be percent-encoded: a comma is a legal query
 * sub-delimiter, and several map handlers fail to decode `%2C` before parsing
 * coordinates. Free-text addresses do need encoding.
 */
function encodeDestination(dest: string, isCoords: boolean): string {
  return isCoords ? dest : encodeURIComponent(dest);
}

/** True when we know enough about a place to point a map at it. */
export function canOpenDirections(t: MapsTarget): boolean {
  return destination(t).dest.length > 0;
}

/** Google Maps web URL — always-valid last resort. */
export function directionsWebUrl(t: MapsTarget): string | null {
  const { dest, isCoords } = destination(t);
  if (!dest) return null;
  const place = t.placeId ? `&destination_place_id=${encodeURIComponent(t.placeId)}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeDestination(dest, isCoords)}${place}`;
}

/**
 * Open DIRECTIONS in the device's native maps app.
 *
 *  - iOS:     tries Google Maps (`comgooglemaps://`) first since our business
 *             data comes from Google Places, then falls back to Apple Maps
 *             (`maps://`). Both open a native APP — an https maps URL would
 *             open Safari, which is the thing we're avoiding.
 *  - Android: the Google Maps https URL is an app link, so it opens the Google
 *             Maps app directly AND shows turn-by-turn directions. We put it
 *             first deliberately: `geo:` would only drop a pin, not route. If
 *             Google Maps isn't installed a browser handles the https URL, so
 *             the trailing `geo:` is just a last-ditch safety net for the rare
 *             device where nothing claims https.
 *
 * Each candidate is tried in order, falling back to the web URL.
 * Returns false when we don't have enough location info to try at all.
 */
export async function openDirections(t: MapsTarget): Promise<boolean> {
  const { dest, isCoords } = destination(t);
  if (!dest) return false;

  const encoded = encodeDestination(dest, isCoords);
  const web = directionsWebUrl(t)!;

  const candidates =
    Platform.OS === 'ios'
      ? [
          // Prefer Google Maps when the user actually has it installed — our
          // businesses come from Google Places, so it's the matching data set.
          // Safe without an LSApplicationQueriesSchemes entry: that's only
          // required by canOpenURL. openURL simply rejects when the app is
          // missing, so we fall through to Apple Maps.
          `comgooglemaps://?daddr=${encoded}`,
          `maps://?daddr=${encoded}`,
          `http://maps.apple.com/?daddr=${encoded}`,
          web,
        ]
      : [web, `geo:0,0?q=${encoded}`];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Nothing handled this scheme — try the next candidate.
    }
  }
  return false;
}

/**
 * Open a web page in an IN-APP browser so the user stays inside the app.
 * Falls back to the system browser if the in-app one can't be presented.
 */
export async function openExternalUrl(url: string | null | undefined): Promise<void> {
  const target = (url || '').trim();
  if (!target) return;
  const withScheme = /^https?:\/\//i.test(target) ? target : `https://${target}`;
  try {
    await WebBrowser.openBrowserAsync(withScheme, {
      toolbarColor: colors.paper,
      controlsColor: colors.accent,
    });
  } catch {
    try {
      await Linking.openURL(withScheme);
    } catch {
      // Nothing we can do — swallow rather than crash a tap handler.
    }
  }
}
