/**
 * Pages for the preview iframe: the bridge that lets taps reach the editor, the
 * live theme (colour and font) and the section order.
 */

import { injectEditorBridge } from "@/components/editor/editorBridge";
import { buildFontHref, buildOverrideCss, resolveAutoScheme } from "@/components/editor/themeOverride";
import { applySectionOrder } from "@/lib/sectionOrder";

/** A tap highlight that reads on any page and uses no yellow text or outline. */
const TAP_STYLE = `<style id="owner-tap">
[data-field]:hover,[data-image-field]:hover,a[data-href-field]:hover{outline:2px solid rgba(12,10,8,.78)!important;outline-offset:3px!important;cursor:pointer!important}
[data-field].ed-focused,[data-image-field].ed-focused,a[data-href-field].ed-focused{outline:3px solid #0C0A08!important;outline-offset:3px!important}
html{scroll-behavior:auto!important}
</style>`;

/** The page, in the section order the owner picked, with the bridge and tap style. */
export function composePreview(html: string, order: readonly string[] | null | undefined): string {
    if (!html) return "";
    const ordered = applySectionOrder(html, order);
    const withBridge = injectEditorBridge(ordered);
    const at = withBridge.lastIndexOf("</head>");
    return at === -1 ? TAP_STYLE + withBridge : withBridge.slice(0, at) + TAP_STYLE + withBridge.slice(at);
}

/** Same-origin access to the iframe's document, or null. */
export function docOf(iframe: HTMLIFrameElement | null): Document | null {
    try { return iframe?.contentDocument ?? null; } catch { return null; }
}

/**
 * Put the chosen colours and font on the page in the iframe — the same
 * override the build bakes in (themeOverride.ts is a port of it).
 * `branded` templates keep their hand-tuned palette on "auto".
 */
export function applyTheme(iframe: HTMLIFrameElement | null, scheme: string, font: string, businessType: string, branded: boolean) {
    const doc = docOf(iframe);
    if (!doc || !doc.body) return;
    const resolvedScheme = !scheme || scheme === "auto" || scheme === "default"
        ? (branded ? "" : resolveAutoScheme(businessType))
        : scheme;
    const pairing = !font || font === "auto" || font === "default" ? "" : font;
    const href = buildFontHref(pairing);
    if (href && doc.head) {
        let link = doc.getElementById("ed-live-font") as HTMLLinkElement | null;
        if (!link) {
            link = doc.createElement("link");
            link.id = "ed-live-font";
            link.rel = "stylesheet";
            doc.head.appendChild(link);
        }
        if (link.href !== href) link.href = href;
    }
    const css = buildOverrideCss(resolvedScheme, pairing);
    let style = doc.getElementById("ed-live-theme") as HTMLStyleElement | null;
    if (!css) { if (style) style.textContent = ""; return; }
    if (!style) {
        style = doc.createElement("style");
        style.id = "ed-live-theme";
        doc.body.appendChild(style);
    }
    style.textContent = css;
}

/** Send a bridge message to the page in the iframe. */
export function post(iframe: HTMLIFrameElement | null, message: Record<string, unknown>) {
    try { iframe?.contentWindow?.postMessage(message, "*"); } catch { /* the page is not ready */ }
}

export interface PhotoSlot { field: string; src: string }

/** The photo slots on the page, in page order, with what each shows now. */
export function readPhotoSlots(iframe: HTMLIFrameElement | null): PhotoSlot[] {
    const doc = docOf(iframe);
    if (!doc) return [];
    const seen = new Set<string>();
    const out: PhotoSlot[] = [];
    doc.querySelectorAll<HTMLElement>("[data-image-field]").forEach((el) => {
        const field = el.getAttribute("data-image-field") || "";
        if (!field || seen.has(field)) return;
        const img = el.tagName === "IMG" ? (el as HTMLImageElement) : el.querySelector("img");
        let src = img?.getAttribute("src") || "";
        if (!src) {
            const bg = el.style.backgroundImage || doc.defaultView?.getComputedStyle(el).backgroundImage || "";
            const m = /url\(["']?([^"')]+)["']?\)/.exec(bg);
            src = m?.[1] ?? "";
        }
        if (!src) return;
        seen.add(field);
        out.push({ field, src });
    });
    return out;
}

/** Replay current draft photos synchronously before the picker reads the slots. */
export function syncPhotoSlots(iframe: HTMLIFrameElement | null, originals: PhotoSlot[], get: (field: string) => unknown) {
    const doc = docOf(iframe);
    if (!doc) return;
    const values = new Map(originals.map((slot) => {
        const value = get(slot.field);
        return [slot.field, typeof value === "string" && value ? value : slot.src];
    }));
    doc.querySelectorAll<HTMLElement>("[data-image-field]").forEach((el) => {
        const src = values.get(el.getAttribute("data-image-field") || "");
        if (!src) return;
        const img = el.tagName === "IMG" ? el as HTMLImageElement : el.querySelector("img");
        if (img) img.setAttribute("src", src);
        else el.style.backgroundImage = `url(${JSON.stringify(src)})`;
    });
}
