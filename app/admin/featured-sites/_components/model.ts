import { SHOWCASE_SITES } from "@/components/landing/landingData"

/*
 * Site settings: the pure part. What the Convex settings hold, the built-in
 * fallback, and the checks the drawer and the store-link fields run. No React,
 * no Convex calls.
 */

/** One curated site, exactly as the setting stores it and the landing reads it. */
export type FeaturedSite = { name: string; category: string; city: string; url: string }

/** The Convex setting the landing's "Real sites" band reads (an array of FeaturedSite). */
export const FEATURED_KEY = "featured_sites"

/** Saved with the featured list, so the settings table says what the key is for. */
export const FEATURED_DESCRIPTION = "Curated live sites shown in the landing 'Real Sites' proof grid"

/**
 * What the landing falls back to while nothing is saved. The editor starts
 * from this list when the setting is unset or empty, so nothing changes until
 * an admin saves, and "Reset to defaults" brings it back.
 */
export const DEFAULT_SITES: FeaturedSite[] = SHOWCASE_SITES.filter((s) => !!s.url).map((s) => ({
    name: s.name,
    category: s.category,
    city: s.city,
    url: s.url as string,
}))

/** "https://Hapag.pages.dev/" and "hapag.pages.dev" are the same site. */
function urlKey(url: string): string {
    return url.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase()
}

// The built-in sites have real screenshots in /public/Pages. A site an admin
// adds has none (the landing shows it as a live preview instead), so its row
// and preview card get the empty frame rather than a borrowed picture.
const SCREENSHOTS = new Map<string, string>(SHOWCASE_SITES.flatMap((s) => (s.src && s.url ? [[urlKey(s.url), s.src] as [string, string]] : [])))

export function screenshotFor(url: string): string | null {
    return SCREENSHOTS.get(urlKey(url)) ?? null
}

/** "https://hapag.pages.dev/" → "hapag.pages.dev" */
export function bareUrl(url: string): string {
    return url.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
}

/** Category and city, whichever exist: "Restaurant · Meycauayan, Bulacan". */
export function siteMeta(site: FeaturedSite): string {
    return [site.category, site.city]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" · ")
}

const text = (v: unknown): string => (typeof v === "string" ? v : "")

/**
 * The saved list, or null when there is none (unset, empty, or not a list).
 * Each entry is coerced to strings: the value is `v.any()` in Convex and the
 * mobile app shares the deployment, so a malformed row must not crash this.
 */
export function readSaved(value: unknown): FeaturedSite[] | null {
    if (!Array.isArray(value) || value.length === 0) return null
    return value.map((s) => {
        const o = (s ?? {}) as Record<string, unknown>
        return { name: text(o.name), category: text(o.category), city: text(o.city), url: text(o.url) }
    })
}

export function sameSite(a: FeaturedSite, b: FeaturedSite): boolean {
    return a.name === b.name && a.category === b.category && a.city === b.city && a.url === b.url
}

export function sameSites(a: FeaturedSite[], b: FeaturedSite[]): boolean {
    return a.length === b.length && a.every((s, i) => sameSite(s, b[i]))
}

/**
 * A full web address: http(s), a host with a dot, no spaces. The landing
 * frames and links whatever is saved, so "hapag.pages.dev" without the
 * scheme would be a broken card.
 */
export function isWebUrl(value: string): boolean {
    const v = value.trim()
    if (!/^https?:\/\//i.test(v) || /\s/.test(v)) return false
    try {
        const u = new URL(v)
        return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".")
    } catch {
        return false
    }
}

export type SiteErrors = { url?: string; name?: string }

export function siteErrors(site: FeaturedSite): SiteErrors {
    const errors: SiteErrors = {}
    if (!site.url.trim()) errors.url = "Add the site’s live URL."
    else if (!isWebUrl(site.url)) errors.url = "Use the full address, starting with https://"
    if (!site.name.trim()) errors.name = "Add the business name."
    return errors
}

export function trimSite(site: FeaturedSite): FeaturedSite {
    return { name: site.name.trim(), category: site.category.trim(), city: site.city.trim(), url: site.url.trim() }
}

/** A store link may be blank (that store's button is hidden); anything else must be a full address. */
export function storeLinkError(value: string): string | null {
    const v = value.trim()
    if (!v) return null
    return isWebUrl(v) ? null : "Use the full store address, starting with https://"
}

/** "A, B, C and D" */
export function joinNames(names: string[]): string {
    if (names.length <= 1) return names.join("")
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}
