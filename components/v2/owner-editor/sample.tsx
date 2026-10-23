"use client";

/**
 * The editor on a local sample site, for development and review only
 * (/v2/my-site/sample, 404 in production). It exists so the editor can be seen
 * and tried without a Clerk sign-in or a built customer site. Nothing here
 * talks to Convex: saves are no-ops, "builds" return the design's own sample
 * page, uploads become local object URLs.
 */

import { useEffect, useMemo, useState } from "react";

import { OwnerSiteEditor } from "./OwnerSiteEditor";
import type { Json, OwnerEditorActions, OwnerSite } from "./types";

const BASE_PAGE = "/template-previews/bp.html"; // Forge Barber Co., barbershop:BP
const BASE_CODE = "barbershop:BP";

/** The owner's own phone photos, and Tendso's polished versions of the same shop. */
const ORIGINALS = ["phone-chair", "phone-inside", "phone-outside", "phone-haircut"];
const POLISHED = ["pro3-finished", "pro3-detail", "pro3-outside", "pro3-tools"];
const photoUrl = (name: string) => `${window.location.origin}/owner-editor-sample/${name}.jpg`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Read the page's own [data-field] hooks back into a content object. */
export function contentFromMarkers(html: string): Json {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const content: Json = {};
    doc.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
        const path = el.getAttribute("data-field") || "";
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!path || !text || el.children.length > 2) return;
        const parts = path.split(".");
        let cur = content;
        parts.forEach((part, i) => {
            const last = i === parts.length - 1;
            const nextNumeric = !last && /^\d+$/.test(parts[i + 1]!);
            if (last) { if (cur[part] === undefined) cur[part] = text; return; }
            if (cur[part] === undefined || typeof cur[part] !== "object") cur[part] = nextNumeric ? [] : {};
            cur = cur[part];
        });
    });
    content.business_name = doc.title.split("—")[0]!.trim() || "Forge Barber Co.";
    return content;
}

export function SampleOwnerEditor() {
    const [site, setSite] = useState<OwnerSite | null>(null);

    useEffect(() => {
        let off = false;
        fetch(BASE_PAGE).then((r) => r.text()).then((fetched) => {
            let html = fetched;
            if (off) return;
            const doc = new DOMParser().parseFromString(html, "text/html");
            // The design's own placeholders become the shop's polished photos.
            let n = 0;
            doc.querySelectorAll<HTMLElement>("[data-image-field]").forEach((el) => {
                const url = photoUrl(POLISHED[n++ % POLISHED.length]!);
                const img = el.tagName === "IMG" ? el : el.querySelector("img");
                if (img) { img.setAttribute("src", url); img.removeAttribute("srcset"); } else el.style.backgroundImage = `url('${url}')`;
            });
            html = "<!DOCTYPE html>" + doc.documentElement.outerHTML;
            const content = contentFromMarkers(html);
            const customizations = { heroStyle: BASE_CODE, colorScheme: "auto", colorSchemeId: "auto", fontPairing: "auto", fontPairingId: "auto" };
            setSite({
                submissionId: "sample",
                businessName: "Forge Barber Co.",
                businessType: "Barber",
                live: true,
                publishedUrl: "https://forge-barber.sites.tendso.com",
                html,
                base: { content, customizations },
                saved: { content, customizations },
                photos: ORIGINALS.map(photoUrl),
                polished: POLISHED.map(photoUrl),
            });
        });
        return () => { off = true; };
    }, []);

    const actions = useMemo<OwnerEditorActions>(() => ({
        async saveDraft() { await wait(150); },
        async discard() { await wait(50); },
        async uploadPhoto(file) { await wait(400); return URL.createObjectURL(file); },
        async buildPreview(templateCode) {
            await wait(1800); // stands in for the ~1 minute real build
            const letter = (templateCode ?? BASE_CODE).split(":")[1]!.toLowerCase();
            return await fetch(`/template-previews/${letter}.html`).then((r) => r.text());
        },
        async publish() {
            await wait(1800);
            return { live: true, republished: true, pendingWorker: false, publishedUrl: "https://forge-barber.sites.tendso.com" };
        },
    }), []);

    if (!site) return <div className="flex h-dvh items-center justify-center bg-v2-stage text-[20px] font-medium text-v2-ink-2">Opening your site…</div>;
    return <OwnerSiteEditor site={site} actions={actions} backHref="/v2/my-site/sample" />;
}
