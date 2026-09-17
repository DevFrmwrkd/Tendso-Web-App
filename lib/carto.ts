/**
 * CARTO basemap key — every Leaflet map on the platform draws CARTO tiles.
 *
 * In late August 2026 CARTO started stamping "API KEY REQUIRED" across tiles
 * requested without a key. The key goes on the tile URL as `?key=`, and it
 * reaches the browser on every tile request anyway, so it is public by design:
 * one `NEXT_PUBLIC_` variable serves both the server and the landing map.
 *
 * About 70 site templates each hard-code a tile URL inside an inline script,
 * where Astro cannot interpolate anything. So the key is not added in the
 * templates. It is written into the finished HTML instead, at two points:
 *
 *   • buildAstroSite — new builds come out with the key already in them.
 *   • resolveWebsiteHtml — HTML stored before this change (or under a rotated
 *     key) gets the current key whenever it is previewed or published, so a
 *     republish is enough to fix a live site; no regeneration.
 *
 * The rewrite replaces an existing `?key=` rather than adding a second one, so
 * running it twice is harmless and rotating the key only takes a republish.
 * With no key configured, the HTML passes through unchanged.
 */

export function cartoApiKey(): string {
    return process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim() || '';
}

// `//{s}.basemaps.cartocdn.com/<style path>/{z}/{x}/{y}{r}.png` plus any key a
// previous rewrite already put there.
const TILE_URL = /(\/\/(?:\{s\}\.)?basemaps\.cartocdn\.com\/[\w/{}.-]*?\.png)(\?key=[^"'&\s\\]*)?/g;

export function withCartoKey(html: string, key: string = cartoApiKey()): string {
    if (!key || !html) return html;
    const param = `?key=${encodeURIComponent(key)}`;
    return html.replace(TILE_URL, (_match, url: string) => url + param);
}
