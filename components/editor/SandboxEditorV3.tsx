"use client";

/**
 * SandboxEditorV3 — the unified editor.
 *
 * v2's design surface (live themeOverride recolour/refont, template design-preview
 * swap, safe in-iframe contenteditable, batched save-once → single rebuild)
 * + v1's structured power (schema sidebar form with add/remove/reorder lists,
 * image picker, link popover) surfaced by ROUTING preview clicks to those tested
 * sidebar editors — so everything v2 defers is recovered with zero new data-loss
 * surface (arrays/links/images are still written whole by v1's logic).
 *
 * Same SandboxEditorProps + onSaveContent + astro build + ed:* bridge as v1/v2;
 * a drop-in behind the editorVersion toggle. Draft model + undo/redo + local
 * draft recovery live in useEditorDraft.
 *
 * NOT runtime-tested locally (Next build won't finish on the dev box) — verify on
 * a throwaway submission per the PR's checklist.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { injectEditorBridge } from "./editorBridge";
import type { SandboxEditorProps } from "./editorProps";
import { TEMPLATE_FAMILIES, templateByCode, sectionsForTemplate, BLOCK_TIER, TIER_META, BLOCK_CONTENT_PATHS } from "./templateCatalog";
import { COLOR_SCHEMES, FONT_PAIRINGS, ALL_BLOCKS, schemesForTemplate, VIS_KEY_BY_BLOCK } from "./editorConstants";
import { buildOverrideCss, buildFontHref, resolveAutoScheme } from "./themeOverride";
import { buildRoleColorCss, roleForField, COLOR_ROLES, roleColorKey, sectionForField, scopeSelector, COLOR_STATES, COLOR_STATE_LABELS, type ColorRole, type ColorProp, type ColorState } from "@/lib/roleColors";
import { useEditorDraft } from "./useEditorDraft";
import { applyImageSlot, isImageField, uploadImage } from "./editorImageSlots";
import ContentFieldsAuto from "./ContentFieldsAuto";
import { isSchemaEditablePath, isSchemaListRowPath } from "./genericContentSchema";
import { rowWriteFromSchema } from "./listRowWrites";
import { deriveContentDefaults, getDerivedAt } from "@/lib/derive-content-defaults";
import ImagePickerModal from "./ImagePickerModal";
import LinkPopover, { type LinkPopoverData } from "./LinkPopover";

const TB = "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed";

const SCHEME_SWATCH: Record<string, string> = {
    auto: "#94a3b8", blue: "#2563eb", green: "#16a34a", purple: "#7c3aed",
    orange: "#ea580c", dark: "#1f2937", pink: "#db2777", brown: "#92400e",
    red: "#dc2626", yellow: "#eab308", maroon: "#7f1d1d", black: "#111111",
    gold: "#b8860b", whitegold: "#d4af37", professional: "#334155",
};

const VIEWPORTS: Record<string, number | null> = { desktop: null, tablet: 834, mobile: 390 };

// Which roles are offered the hover / pressed axis.
//
// The two button roles and `link` — the things a pointer actually interacts
// with. The link role's selector list is `a[data-href-field]:not(.btn)`, i.e.
// real anchors, so a hover colour picked there lands on something that
// genuinely HAS a hover, even when the click that opened the picker landed on
// a paragraph (roleForField falls back to `link` for plain text — and the
// match-count note already covers "this scope contains no links").
//
// Headings and eyebrows are excluded on purpose. They are static text: no
// template gives them a :hover, so a hover colour there would not be MATCHING
// an existing behaviour, it would be INVENTING one — a headline that changes
// colour when the pointer crosses it, which reads as a bug on a brochure site.
// An axis whose only use makes the page worse does not belong on screen.
// Excluding them also means those two roles keep writing exactly the keys they
// wrote before states existed, since roleColorKey collapses `base` back to a
// plain prop segment.
const ROLE_HAS_STATES: Record<ColorRole, boolean> = {
    primaryCta: true, secondaryCta: true, link: true, heading: false, eyebrow: false,
};

// Inject the picked Color Scheme / Font Pairing live into the same-origin preview
// iframe — identical to v2's applyThemeToIframe (SandboxEditorV2.tsx:30-63).
function applyThemeToIframe(iframe: HTMLIFrameElement | null, scheme: string, font: string, businessType: string, isBranded: boolean) {
    try {
        const doc = iframe?.contentDocument;
        if (!doc || !doc.body) return;
        // Respect lockVariant: branded / bespoke families keep their hand-tuned
        // palette on "auto" (the real astro build emits no override), so DON'T
        // apply the auto-by-business-type scheme for them — only generic
        // (recolour-ready) templates resolve an auto scheme. An EXPLICIT admin
        // pick still overrides for any family. This keeps the live preview
        // matching the real site (fixes branded secondary/ghost buttons
        // rendering wrong in v3 vs v1/v2).
        const resolvedScheme = !scheme || scheme === "auto" || scheme === "default"
            ? (isBranded ? "" : resolveAutoScheme(businessType))
            : scheme;
        const pairing = !font || font === "auto" || font === "default" ? "" : font;
        const fontHref = buildFontHref(pairing);
        if (fontHref && doc.head) {
            let linkEl = doc.getElementById("ed-live-font") as HTMLLinkElement | null;
            if (!linkEl) {
                linkEl = doc.createElement("link");
                linkEl.id = "ed-live-font";
                linkEl.rel = "stylesheet";
                doc.head.appendChild(linkEl);
            }
            if (linkEl.href !== fontHref) linkEl.href = fontHref;
        }
        const css = buildOverrideCss(resolvedScheme, pairing);
        let styleEl = doc.getElementById("ed-live-theme") as HTMLStyleElement | null;
        if (!css) { if (styleEl) styleEl.textContent = ""; return; }
        if (!styleEl) {
            styleEl = doc.createElement("style");
            styleEl.id = "ed-live-theme";
            doc.body.appendChild(styleEl);
        }
        styleEl.textContent = css;
    } catch { /* same-origin access can throw — Save still applies it for real */ }
}

// Inject per-role colour overrides (click-to-recolour) live into the preview
// iframe. Mirrors applyThemeToIframe; the same CSS is baked into the built HTML
// in app/api/generate-website so the colours persist on Save + Publish.
function applyRoleColorsToIframe(iframe: HTMLIFrameElement | null, roleColors: Record<string, string> | undefined) {
    try {
        const doc = iframe?.contentDocument;
        if (!doc || !doc.body) return;
        const css = buildRoleColorCss(roleColors);
        let styleEl = doc.getElementById("ed-role-colors") as HTMLStyleElement | null;
        if (!css) { if (styleEl) styleEl.textContent = ""; return; }
        if (!styleEl) {
            styleEl = doc.createElement("style");
            styleEl.id = "ed-role-colors";
            doc.body.appendChild(styleEl);
        }
        styleEl.textContent = css;
    } catch { /* same-origin can throw; Save bakes it in anyway */ }
}

// How many elements in the preview a role's colour would ACTUALLY hit at a
// given scope — same selector list buildRoleColorCss emits from, so zero here
// means the CSS it would write provably cannot touch anything on the page.
//
// Not hypothetical. The header's hooks are top-level paths
// (`navbar_links.0.href`, `navCtaText`) and SECTION_ALIASES names that section
// `header`, so scoping a nav link to its own section asks for
// a[data-href-field^="header."] — a selector no template can match. Every
// element in the header is like this. Without the count the picker would open
// on "This section" and silently do nothing for all of them, which is a worse
// failure than the bluntness this whole change is fixing.
//
// Returns -1 when there is no document to ask, which callers must not read as 0.
function countRoleMatches(doc: Document | null | undefined, role: ColorRole, section: string | null): number {
    if (!doc) return -1;
    const def = COLOR_ROLES[role];
    if (!def) return -1;
    const sels = section
        ? def.selectors.map((s) => scopeSelector(s, section)).filter((s): s is string => !!s)
        : def.selectors;
    let n = 0;
    for (const s of sels) {
        try { n += doc.querySelectorAll(s).length; } catch { /* a selector the browser rejects matches nothing */ }
    }
    return n;
}

type Panel = "design" | "content" | "media";

export default function SandboxEditorV3(props: SandboxEditorProps) {
    const {
        businessName, businessType, htmlContent, submissionId, photos, enhancedImageUrls,
        onSaveContent, websitePublishedUrl,
        websiteGenerated, generatingWebsite, publishingWebsite, republishingWebsite,
        unpublishingWebsite, enhancing, sendingEmail,
        onSendToClient, onEnhanceImages, onRegenerate, onPublish, onRepublish,
        onUnpublish, onDelete, onApprove, onReject, onToggleDetails, submissionStatus,
        onGiveFree, markingComped, isCustomDomainTier, isComped,
    } = props;

    // Promo eligibility — same rule TopActionBar applies, so the button appears
    // and disappears identically whichever surface the admin is looking at.
    const canGiveFree =
        !!onGiveFree &&
        !isComped &&
        !isCustomDomainTier &&
        websiteGenerated &&
        ["approved", "website_generated", "deployed", "pending_payment"].includes(submissionStatus ?? "");

    const m = useEditorDraft(props);
    // The LATEST hook object, readable from anything that runs after a commit
    // rather than during the render that made it. `m` is rebuilt every render,
    // so a callback that closed over it still holds the pre-commit values —
    // which is how Reset discarded a theme/colour change in the model and then
    // repainted the preview with the very values it had just thrown away (its
    // rAF re-ran the appliers, but the ones captured before resetDraft).
    const mRef = useRef(m);
    mRef.current = m;

    const [panel, setPanel] = useState<Panel>("design");
    const panelRef = useRef<Panel>(panel);
    panelRef.current = panel;
    const [viewport, setViewport] = useState<keyof typeof VIEWPORTS>("desktop");
    const [saving, setSaving] = useState(false);
    // Real-content preview: `previewBuildHtml` is the built HTML of the UNSAVED
    // draft in the picked template/theme (from /api/generate-website?preview) —
    // shown until "Back to saved" or Save. `previewing` gates the ~30–60s build.
    const [previewing, setPreviewing] = useState(false);
    const [previewBuildHtml, setPreviewBuildHtml] = useState<string | null>(null);
    const [imagePickerField, setImagePickerField] = useState<string | null>(null);
    const [linkData, setLinkData] = useState<LinkPopoverData | null>(null);
    const [pendingImageField, setPendingImageField] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    // Click-to-recolour (per-role): colorMode routes canvas clicks to a colour
    // popover instead of the text/link/image editors.
    //
    // `section` is the section of the element that was clicked (the leading
    // segment of its hook path) and `scopeAll` is the escape hatch out of it.
    // A role alone was too blunt a unit — primaryCta covers hero.cta1.text AND
    // ctaBand.cta.text, which sit on different grounds — so a pick is scoped to
    // the clicked section by DEFAULT. `scopeAll` writes the legacy every-section
    // key instead, which is what "make all the primary buttons green" needs and
    // is what the product did before sections existed. A field we cannot place
    // (section === "") has no choice: every-section is the only key there is.
    //
    // `state` is the third axis: the resting colour, the pointed-at one and the
    // held-down one are picked separately. It rides on the PROP segment of the
    // key ("hero:primaryCta:bg@hover") rather than taking a colon field of its
    // own — see lib/roleColors.ts, where a fourth field would have made
    // "role:prop:state" and "section:role:prop" indistinguishable.
    const [colorMode, setColorMode] = useState(false);
    const [colorPopover, setColorPopover] = useState<{
        role: ColorRole; prop: ColorProp; curBg: string; curFg: string;
        section: string; scopeAll: boolean;
        /** How many elements each scope would hit, counted off the live preview
         *  at click time (-1 = could not look). See countRoleMatches. */
        sectionMatches: number; allMatches: number;
        /** Resting / pointed-at / held-down. Always opens on 'base' (see the
         *  ed:color-click handler); roles with no pointer state ignore it. */
        state: ColorState;
    } | null>(null);

    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const railRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const busy = generatingWebsite || saving;
    const previewHtml = useMemo(() => injectEditorBridge(htmlContent || ""), [htmlContent]);

    // ── Stale-publish signal ──────────────────────────────────────────────
    // Every rebuild (Save, Regenerate) resets generatedWebsites.status to
    // 'draft' while publishedUrl stays set, so `draft + publishedUrl` means the
    // live Cloudflare Worker is still serving the OLD HTML. Save auto-republishes
    // (app/api/save-content), so this normally clears itself within seconds —
    // when it does NOT (republish failed, or the admin used Regenerate, which
    // doesn't publish), the admin has to see that the customer's site is behind.
    // Read off the reactive row so it lights and clears on its own.
    const websiteRow = useQuery(
        api.generatedWebsites.getBySubmissionId,
        submissionId ? { submissionId: submissionId as Id<"submissions"> } : "skip"
    );
    const publishStale = !!websiteRow?.publishedUrl && websiteRow?.status === "draft";
    // ── Tier-3 read: the defaults the BUILD pipeline applies ──────────────
    // The sidebar's read chain must match what the iframe renders, or the form
    // lies about the page. ContentFieldsAuto already does (1) draft and (2) the
    // schema's own fallbackPaths; this adds (3) the submission-derived defaults,
    // which is what v1 has always done.
    //
    // Without it a derived list reads as EMPTY, and "+ Add" then commits a
    // one-element array OVER the derived one — shipping a blank <h1> for
    // hero.headlineLines, a blank copyright row for footer.notes, and an empty
    // service area. Every section eyebrow and the closing-band CTA also render
    // as empty boxes on essentially every submission.
    // ── Photos actually in play ───────────────────────────────────────────
    // draft.images when the admin has uploaded any, else the submission's own
    // photos — the same rule v1 uses. Reading the raw `photos` prop instead (as
    // this panel did) meant a photo uploaded through v3's own button could NEVER
    // appear: /api/upload-image returns an R2 url into draft.images and never
    // touches submissions.photos, and the prop is rebuilt from the submission.
    // The admin watched the spinner stop, saw nothing, and re-uploaded.
    const effectivePhotos: string[] = useMemo(() => {
        const own = (m.draft as any)?.images;
        return Array.isArray(own) && own.length > 0 ? own : (photos ?? []);
    }, [m.draft, photos]);

    // Seeded from the POOL, not from draft.images — otherwise removing the first
    // photo of a submission that has never been edited is a no-op (v1's own bug:
    // it filters an array that is still empty).
    const removePhoto = useCallback((index: number) => {
        m.replaceDraft({
            ...(m.draftRef.current ?? {}),
            images: effectivePhotos.filter((_, i) => i !== index),
        });
    }, [m, effectivePhotos]);

    // Advisory only - it labels the toggle, it never disables it, because an
    // admin may be switching a section ON precisely in order to go and write it.
    // Depends on the draft being NORMALISED (Pass 1): several of these paths have
    // no bare-array fallback, so on raw AI content this would have stamped a
    // false "no content yet" on the very sections that DO have content.
    const blockHasContent = useCallback((blockName: string): boolean | null => {
        const paths = BLOCK_CONTENT_PATHS[blockName];
        if (!paths) return null; // HERO / FOOTER - always populated
        for (const path of paths) {
            const v = m.getValue(path);
            if (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : Boolean(v)) return true;
        }
        return false;
    }, [m]);

    // ── Human name for a hook-path section ────────────────────────────────
    // The colour popover has to say WHICH section it is about to recolour, or
    // "Primary buttons" reads as all of them. The name is the one the Sections
    // panel already prints — what THIS template calls the section on the page
    // ("The rooms", not "SERVICES") — because a second vocabulary for the same
    // sections would be a second thing to keep true.
    //
    // The two sides are keyed differently: sectionForField() returns the hook
    // path's leading segment ("ctaBand"), the labels are keyed by block name
    // ("CTA-BAND"). BLOCK_CONTENT_PATHS is the existing bridge between them —
    // its FIRST path per block is that block's namespace. Only the first: the
    // later fallbacks are shared namespaces ("contact", "photos") that no one
    // section owns, and pointing those at a section name would misdescribe the
    // scope, which really is "every contact.* field on the page".
    const sectionLabels = useMemo(() => {
        const byBlock = new Map<string, string>();
        for (const sec of sectionsForTemplate(m.currentHeroStyle)) byBlock.set(sec.block, sec.label);
        // Null prototype on purpose. `section` is a template-supplied path
        // segment, and on a plain object literal a segment named `constructor`
        // or `toString` resolves UP THE PROTOTYPE CHAIN to a function — which
        // sectionName would then hand to JSX as the section's name. Same reason
        // parseRoleColorKey uses hasOwnProperty instead of `in`.
        const out: Record<string, string> = Object.create(null);
        for (const [block, paths] of Object.entries(BLOCK_CONTENT_PATHS)) {
            const ns = String(paths[0] ?? "").split(".")[0];
            const label = byBlock.get(block);
            if (ns && label) out[ns] = label;
        }
        // HERO and FOOTER carry no BLOCK_CONTENT_PATHS entry (they are always
        // populated, so there is nothing to test), but they are the two sections
        // a colour click lands in most often. Their namespace is their block
        // name, lowercased.
        for (const [ns, block] of [["hero", "HERO"], ["footer", "FOOTER"]] as const) {
            const label = byBlock.get(block);
            if (label) out[ns] = label;
        }
        return out;
    }, [m.currentHeroStyle]);

    // Falls back to the RAW PATH, never to nothing: "header" is a poor name but
    // it is still true, and a scope with no name on it is the bug this fixes.
    const sectionName = useCallback((section: string) => sectionLabels[section] || section, [sectionLabels]);

    const faviconUrl: string = (m.getValue('favicon') as string) || '';
    const clearFavicon = useCallback(() => {
        // `undefined` is what save-content stores and astro-builder reads as
        // "emit no icon link" — an empty string would ship <link href="">.
        const next = { ...(m.draftRef.current ?? {}) };
        delete next.favicon;
        m.replaceDraft(next);
    }, [m]);

    const derived = useMemo(() => deriveContentDefaults({
        business_name: (m.draft as any)?.business_name || businessName,
        business_city: (m.draft as any)?.business_city || (m.draft as any)?.contact?.city,
        business_type: (m.draft as any)?.business_type || businessType,
        tagline: (m.draft as any)?.tagline,
        about: (m.draft as any)?.about,
        contact: (m.draft as any)?.contact,
    }, photos), [m.draft, businessName, businessType, photos]);

    const contentGetValue = useCallback((path: string) => {
        const v = m.getValue(path);
        if (v !== undefined && v !== null && v !== '') return v;
        return getDerivedAt(derived, path);
    }, [m.getValue, derived]);
    // The read chain, reachable from callbacks that must not re-bind on every
    // keystroke (the picker, the popover, the upload handler). Same value, read
    // late — never a stale closure over an older `derived`.
    const contentGetValueRef = useRef(contentGetValue);
    contentGetValueRef.current = contentGetValue;

    /**
     * setValue, but safe for LIST ROWS.
     *
     * A leaf write inside a list — gallery.items.3.image, footer.social.1.url —
     * is only correct when the draft already holds that whole list. It usually
     * does not: the sidebar (and the page) can be showing rows that came from a
     * schema fallbackPath or from the submission-derived defaults, in which case
     * the leaf write mints a fresh SPARSE array holding one partial row, and
     * JSON.stringify turns the holes into null. Four gallery tiles become
     * [null,null,null,{caption}] and two templates then throw on the rebuild.
     *
     * ContentFieldsAuto's own row inputs are fixed inside ListField, which holds
     * the array it rendered. This wrapper is for the writers that DO NOT have
     * the list in scope and never could:
     *   · the image picker — reachable from the sidebar AND from an
     *     ed:image-click anywhere in the preview, which never touches ListField
     *   · the link popover — likewise, opened by clicking a link in the iframe
     *   · a photo dropped on a slot / picked out of the Media grid
     * They only ever have a dotted path, so the list is recovered where the path
     * is: from the schema (which paths are lists, and what each falls back to)
     * plus this component's own read chain — the same chain the sidebar reads,
     * so what gets written back is what the admin was looking at.
     *
     * On WRITE only. Opening a submission still materialises nothing, so the
     * derived defaults stay derived and an untouched draft stays clean.
     */
    const setContentValue = useCallback((path: string, value: any) => {
        const write = rowWriteFromSchema(contentGetValueRef.current, path, value);
        // One setValue call either way: read-then-write in two steps would race
        // a second write on stale draft state.
        if (write) mRef.current.setValue(write.path, write.value);
        else mRef.current.setValue(path, value);
    }, []);

    /**
     * Put `url` into image slot `slot` — the Media tab's upload and its
     * click-a-photo-to-assign grid.
     *
     * applyImageSlot's catch-all branch is a plain dotted-path write (its
     * setAtPath has precisely the sparse-array behaviour this fix removes), so a
     * slot like `gallery.items.2.image` rebuilt items as a one-row array exactly
     * the way the picker did. Schema list rows go through the list-safe writer
     * instead; everything else still goes to applyImageSlot, whose named LEGACY
     * slots (favicon, hero.image, about.image, services.image,
     * services.list.N.image, gallery.tile.N, and null = append to the library)
     * are not schema list paths and so can never be intercepted by accident.
     */
    const assignImageSlot = useCallback((slot: string | null, url: string) => {
        const write = slot ? rowWriteFromSchema(contentGetValueRef.current, slot, url) : null;
        if (write) mRef.current.setValue(write.path, write.value);
        else mRef.current.replaceDraft(applyImageSlot(mRef.current.draftRef.current, slot, url));
    }, []);

    const curatedSchemes = schemesForTemplate(m.activeFamily, String((m.effectiveCustomizations as any)?.heroStyle ?? ""));

    // ── Live theme apply ──────────────────────────────────────────────────
    // Branded (non-generic) families are lockVariant — their hand-tuned palette
    // must survive "auto" in the live preview exactly as it does in the build.
    const isBrandedFamily = !!m.activeFamily && m.activeFamily !== "generic";
    // Reads through mRef, not the closure: handleReset defers this to an rAF
    // AFTER discarding the draft, so a closed-over m.currentScheme would put the
    // discarded scheme straight back on the page.
    const applyTheme = useCallback(() => {
        const mm = mRef.current;
        applyThemeToIframe(
            iframeRef.current, mm.currentScheme, mm.currentFont, mm.btForTheme,
            !!mm.activeFamily && mm.activeFamily !== "generic",
        );
    }, []);

    const setThemeField = (field: "colorScheme" | "fontPairing", value: string) => {
        m.setThemeField(field, value);
        const nextScheme = field === "colorScheme" ? value : m.currentScheme;
        const nextFont = field === "fontPairing" ? value : m.currentFont;
        applyThemeToIframe(iframeRef.current, nextScheme, nextFont, m.btForTheme, isBrandedFamily);
    };

    // ── Live text push to the iframe (sidebar edit → preview) ─────────────
    const pushLiveText = useCallback((path: string, value: any) => {
        try { iframeRef.current?.contentWindow?.postMessage({ type: "ed:update", field: path, value }, "*"); } catch { /* ignore */ }
    }, []);

    // ── Safe in-iframe contenteditable (v2:201-252, unchanged SKIP set) ───
    const setupInlineEditing = useCallback(() => {
        const doc = iframeRef.current?.contentDocument;
        if (!doc) return;
        // Allow-list, not deny-list. A node is inline-editable only if the
        // sidebar schema declares that exact path, so a template that ships a new
        // data-field cannot silently acquire a destructive editor (see
        // isSchemaEditablePath). The three structural exclusions stay on top:
        // hero.headline is a whole <h1> assembled from lines, and nav.* is
        // layout-backed, so editing either as raw text corrupts the structure.
        const SKIP = (f: string) =>
            !isSchemaEditablePath(f) ||
            f === "hero.headline" ||
            /^(nav\.brand|nav\.status|nav\.links|navbar_links)(\.|$)/.test(f) ||
            // Array rows stay OUT, even though the schema owns them. An earlier
            // adversarial pass on the inline editor found that committing one
            // row inline dropped its siblings, which is why they were excluded
            // in the first place. The allow-list above must only ever NARROW
            // what is editable — never re-open something that was closed for a
            // data-loss reason. Rows are edited in the sidebar, which writes the
            // whole array at once.
            //
            // ASK THE SCHEMA WHAT A ROW IS. This was
            // `/\.(items|steps|paragraphs)\.\d+/`, which keys on list NAMES and
            // so covered only 10 of the 20 lists the schema declares —
            // hero.headlineLines.0, trust.cells.0.num, about.specs.0.label,
            // area.places.0, area.rows.0.place, location.rules.0.label,
            // footer.visit.lines.0, footer.explore.links.0.text,
            // footer.hours.0.day, footer.social.0.platform and footer.notes.0
            // were all still inline-editable, each one a single-leaf commit into
            // a list the draft may not hold yet (the sparse-array/null bug).
            // footer.hours.<i>.day is the same path family that already cost
            // data at location.hours. isSchemaListRowPath reads the shape off
            // the ListSpecs, so a list declared tomorrow is excluded for free.
            isSchemaListRowPath(f);
        const readVal = (node: Element) =>
            ((node as HTMLElement).innerText ?? node.textContent ?? "")
                .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        const wire = (target: HTMLElement, ownerField: string) => {
            const orig = readVal(target);
            target.setAttribute("contenteditable", "true");
            target.setAttribute("spellcheck", "false");
            target.addEventListener("keydown", (ev: any) => {
                if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); target.blur(); }
            });
            target.addEventListener("blur", () => {
                const val = readVal(target);
                if (val === orig) return;
                m.setDeepDraft(ownerField, val);
            });
        };
        doc.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
            const field = el.getAttribute("data-field") || "";
            if (!field || (el as any).__v3wired) return;
            if (el.hasAttribute("data-href-field") || el.hasAttribute("data-image-field")) return;
            if (el.tagName.toLowerCase() === "a" && /^(tel:|mailto:)/i.test(el.getAttribute("href") || "")) return;
            if (SKIP(field)) return;
            const childEls = Array.from(el.children);
            const looseText = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && !!n.nodeValue && !!n.nodeValue.trim());
            (el as any).__v3wired = true;
            if (childEls.length === 0) {
                wire(el, field);
            } else if (looseText.length === 1 && childEls.every((c) => !(c.textContent || "").trim())) {
                const s = doc.createElement("span");
                el.replaceChild(s, looseText[0]);
                s.appendChild(looseText[0]);
                wire(s, field);
            }
        });
    }, [m]);

    // ── Focus a sidebar input by data-field path (v1:566-630) ─────────────
    const focusSidebarField = useCallback((field: string, opts?: { pulse?: boolean }) => {
        if (panelRef.current !== "content") setPanel("content");
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const el = document.querySelector(`[data-field-input="${field}"]`) as HTMLElement | null;
            if (!el) return;
            el.scrollIntoView({ block: "center", behavior: "smooth" });
            // N3 — INLINE EDITING IS THE PRIMARY PATH, so this never steals focus
            // back from the iframe. It used to call .focus() here, two rAFs after
            // every ed:click, which blurred the element the bridge had just put a
            // caret in: v3's headline feature only worked on fields that had NO
            // sidebar input, i.e. exactly the off-schema paths B3 now forbids.
            // With the allow-list in place every editable field HAS an input, so
            // focusing here would have left inline editing reachable for nothing.
            // The sidebar still scrolls to the matching field and pulses, so the
            // admin can see where the value lives and use it if they prefer.
            el.classList.add("ed-selection-pulse");
            window.setTimeout(() => el.classList.remove("ed-selection-pulse"), 1400);
        }));
    }, []);

    // ── Click-to-recolour (per-role) ──────────────────────────────────────
    // Same reason as applyTheme: this is the applier handleReset runs on an rAF
    // after the discard, so it has to read the map that survived the discard —
    // not the one the render before it was holding.
    const applyRoleColors = useCallback(() => {
        applyRoleColorsToIframe(iframeRef.current, (mRef.current.effectiveCustomizations as any)?.roleColors);
    }, []);

    const toggleColorMode = useCallback(() => {
        setColorMode((prev) => {
            const next = !prev;
            try { iframeRef.current?.contentWindow?.postMessage({ type: "ed:set-mode", mode: next ? "color" : "edit" }, "*"); } catch { /* ignore */ }
            if (!next) setColorPopover(null);
            return next;
        });
    }, []);

    // `section` null → the legacy every-section key, which is still exactly the
    // string published sites carry, so an old site keeps rendering as it does.
    // The live injection needs no scope logic of its own: it rebuilds the whole
    // CSS from the whole map, and buildRoleColorCss is what knows that a
    // section-scoped rule has to be emitted after the every-section one.
    //
    // `state` is the third axis, and roleColorKey collapses 'base' back to a
    // plain "bg" / "fg" — so a resting pick writes byte-identically to what it
    // wrote before states existed, and no stored map needs migrating.
    const applyRoleColor = useCallback((role: ColorRole, prop: ColorProp, color: string | null, section: string | null, state: ColorState) => {
        const key = roleColorKey(role, prop, section, state);
        m.setRoleColor(key, color);
        const base = (((m.effectiveCustomizations as any)?.roleColors) ?? {}) as Record<string, string>;
        const nextMap = { ...base };
        if (color) nextMap[key] = color; else delete nextMap[key];
        applyRoleColorsToIframe(iframeRef.current, nextMap);
    }, [m]);

    // ── Instant section show/hide (Blocks toggles) ────────────────────────
    const applyBlockVisibility = useCallback(() => {
        try {
            const w = iframeRef.current?.contentWindow;
            if (!w) return;
            for (const b of ALL_BLOCKS) {
                // Essentials are never hidden, so never broadcast one. Stored
                // content can carry visibility.hero_section === false from an old
                // save, and replaying that on load blanked whichever section the
                // resolver picked — with the toggle rendered disabled, leaving the
                // admin no way to put it back.
                if ((BLOCK_TIER[b.name] ?? "extra") === "essential") continue;
                w.postMessage({ type: "ed:section-visibility", block: b.visKey, visible: m.isBlockEnabled(b.visKey) }, "*");
            }
        } catch { /* ignore */ }
    }, [m]);

    const handleToggleBlock = useCallback((visKey: string) => {
        const nextVisible = !m.isBlockEnabled(visKey);
        m.toggleBlock(visKey);
        try { iframeRef.current?.contentWindow?.postMessage({ type: "ed:section-visibility", block: visKey, visible: nextVisible }, "*"); } catch { /* ignore */ }
    }, [m]);

    const handleIframeLoad = useCallback(() => {
        setupInlineEditing();
        applyTheme();
        applyRoleColors();
        applyBlockVisibility();
        if (colorMode) { try { iframeRef.current?.contentWindow?.postMessage({ type: "ed:set-mode", mode: "color" }, "*"); } catch { /* ignore */ } }
    }, [setupInlineEditing, applyTheme, applyRoleColors, applyBlockVisibility, colorMode]);

    // ── ed:* click routing (from v1, adapted to the 3-panel rail) ─────────
    useEffect(() => {
        function onMessage(e: MessageEvent) {
            const data: any = e?.data;
            if (!data || typeof data !== "object" || !data.type) return;
            if (data.type === "ed:link-click") {
                setLinkData({
                    field: String(data.field || ""),
                    hrefField: String(data.hrefField || ""),
                    platformField: data.platformField ? String(data.platformField) : undefined,
                    text: String(data.text || ""),
                    href: String(data.href || ""),
                    platform: data.platform ? String(data.platform) : undefined,
                });
                return;
            }
            if (data.type === "ed:image-click" && typeof data.field === "string") {
                setImagePickerField(data.field);
                return;
            }
            if (data.type === "ed:color-click" && typeof data.field === "string") {
                const role = roleForField(data.field, !!data.isButton);
                // The section is not new state — it is already the head of the
                // hook path the admin clicked, so nothing has to be stored or
                // guessed to know it. Scope defaults to that section; a field
                // with no placeable section opens on every-section, which is the
                // only key that can be written for it.
                const section = sectionForField(data.field);
                const doc = iframeRef.current?.contentDocument ?? null;
                const sectionMatches = section ? countRoleMatches(doc, role, section) : 0;
                const allMatches = countRoleMatches(doc, role, null);
                setColorPopover({
                    role, prop: COLOR_ROLES[role].defaultProp,
                    curBg: String(data.curBg || ""), curFg: String(data.curFg || ""),
                    section,
                    // The resting colour, on every open. An admin who clicks a
                    // button means "this button's colour" far more often than
                    // "this button's hover", and one who never noticed the state
                    // axis must still land on the pick they came for. Reopening
                    // deliberately forgets the last state for the same reason.
                    state: "base",
                    // Section scope is the default and the point of the change —
                    // EXCEPT where it is provably inert (the header, whose hooks
                    // are top-level paths). Opening on a scope that cannot change
                    // a pixel would be a worse default than a blunt one, so those
                    // open on every-section, which is what they did before today.
                    scopeAll: !section || sectionMatches === 0,
                    sectionMatches, allMatches,
                });
                return;
            }
            if (data.type === "ed:select" && typeof data.field === "string") {
                focusSidebarField(data.field, { pulse: true });
                return;
            }
            if (data.type === "ed:click" && typeof data.field === "string") {
                // An image slot clicked as plain text → open the picker on it.
                if (isImageField(data.field)) { setImagePickerField(data.field); return; }
                focusSidebarField(data.field);
            }
        }
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [focusSidebarField]);

    // ── Image picker select (v1:661-670 parity: write the data-field path) ─
    // Through setContentValue, not m.setValue. gallery.items.N.image is the most
    // reachable instance of the sparse-array bug in the whole editor — every
    // branded family draws a gallery, any submission with 2+ photos fills it,
    // and the tiles are usually DERIVED, so the draft holds no gallery.items at
    // all until the moment this write lands.
    const handleImagePick = useCallback((field: string, src: string) => {
        try { iframeRef.current?.contentWindow?.postMessage({ type: "ed:image", field, src }, "*"); } catch { /* ignore */ }
        setContentValue(field, src);
        setImagePickerField(null);
    }, [setContentValue]);

    // ── Link popover save (v1:637-658) ────────────────────────────────────
    const handleLinkSave = useCallback((next: LinkPopoverData) => {
        try {
            iframeRef.current?.contentWindow?.postMessage({
                type: "ed:link-update", field: next.field, hrefField: next.hrefField,
                text: next.text, href: next.href, platformField: next.platformField, platform: next.platform,
            }, "*");
        } catch { /* ignore */ }
        // Two writes, and both are safe to run back to back: setValue commits
        // into draftRef SYNCHRONOUSLY, so the href write re-reads the array the
        // text write just materialised instead of racing it.
        if (next.field) setContentValue(next.field, next.text);
        if (next.hrefField) setContentValue(next.hrefField, next.href);
    }, [setContentValue]);

    // ── Upload a photo into a slot (v1 assignImageToSlot path) ────────────
    const handleUpload = useCallback(async (file: File, slot: string | null) => {
        setUploadError(null);
        setUploadingPhoto(true);
        try {
            const url = await uploadImage(file, submissionId);
            assignImageSlot(slot, url);
            if (slot) {
                try { iframeRef.current?.contentWindow?.postMessage({ type: "ed:image", field: slot, src: url }, "*"); } catch { /* ignore */ }
            }
            setPendingImageField(null);
        } catch (err: any) {
            setUploadError(err?.message ?? "Image upload failed");
        } finally {
            setUploadingPhoto(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [assignImageSlot, submissionId]);

    // ── Save (v2:301-331) — batched, single rebuild ───────────────────────
    const handleReset = useCallback(() => {
        if (!m.dirty) return;
        m.resetDraft();
        // The appliers inject theme / role colours / section visibility straight
        // into the iframe, so without re-running them the preview would keep
        // rendering the look that was just discarded.
        requestAnimationFrame(() => { applyTheme(); applyRoleColors(); applyBlockVisibility(); });
        toast.success("Changes discarded", { description: "Back to the last saved version." });
    }, [m, applyTheme, applyRoleColors, applyBlockVisibility]);

    const handleSave = useCallback(async () => {
        if (busy || previewing) return; // don't save while a preview build is in flight
        try { (iframeRef.current?.contentDocument?.activeElement as HTMLElement | null)?.blur?.(); } catch { /* ignore */ }
        const currentDraft = m.draftRef.current;
        // Recompute from refs: the blur above may be what committed the edit, and
        // m.contentDirty is this render's closure - i.e. pre-blur. Reading it here
        // made Save silently no-op with no network call, no toast and no error.
        const now = m.isDirtyNow();
        if (!now.dirty) { toast.info("Nothing to save", { description: "No changes since the last save." }); return; }
        setSaving(true);
        const toastId = toast.loading(now.customizationsDirty ? "Saving changes · regenerating site…" : "Saving content…", { duration: Infinity });
        try {
            await onSaveContent({ ...currentDraft, business_type: m.selectedBucket }, now.customizationsDirty ? m.pendingCustomizations : undefined);
            setPreviewBuildHtml(null);
            m.clearCache();
            toast.success("Changes saved", { id: toastId, description: now.customizationsDirty ? "Theme + content applied. Refreshing preview." : "Content updated." });
        } catch (err: any) {
            toast.error("Save failed", { id: toastId, description: err?.message ?? "Please try again." });
        } finally {
            setSaving(false);
        }
    }, [busy, previewing, m, onSaveContent]);

    // ── "Preview my site" — build the UNSAVED draft into real HTML and show it,
    // persisting nothing. This is the only way to see real content in a picked
    // template (structural change needs the astro build, ~30–60s). Colour/font/
    // text/image edits already preview live, so this is mainly for template picks.
    const handlePreviewBuild = useCallback(async () => {
        if (busy || previewing) return;
        try { (iframeRef.current?.contentDocument?.activeElement as HTMLElement | null)?.blur?.(); } catch { /* ignore */ }
        setPreviewing(true);
        const toastId = toast.loading("Building a preview with your content… (~30–60s)", { duration: Infinity });
        try {
            const res = await fetch("/api/generate-website", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    submissionId,
                    preview: true,
                    content: { ...m.draftRef.current, business_type: m.selectedBucket },
                    customizations: m.pendingCustomizations,
                }),
            });
            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e?.error || `Preview failed (HTTP ${res.status})`);
            }
            const data = await res.json();
            if (!data?.html) throw new Error("Preview returned no HTML");
            setPreviewBuildHtml(data.html as string);
            toast.success("Preview ready", { id: toastId, description: "Your content in the picked template. Save to keep it." });
        } catch (err: any) {
            toast.error("Preview failed", { id: toastId, description: err?.message ?? "Please try again." });
        } finally {
            setPreviewing(false);
        }
    }, [busy, previewing, submissionId, m]);

    // ── Keyboard shortcuts: ⌘S save · ⌘Z undo · ⌘⇧Z redo ──────────────────
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;
            const k = e.key.toLowerCase();
            if (k === "s") { e.preventDefault(); void handleSave(); }
            else if (k === "z" && !e.shiftKey) { e.preventDefault(); m.undo(); }
            else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); m.redo(); }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [handleSave, m]);

    // ── Template thumbnail lazy-mount (v2:268-299) ────────────────────────
    useEffect(() => {
        const root = railRef.current;
        if (!root) return;
        const W = 1280;
        const fill = (thumb: HTMLElement) => {
            if (thumb.dataset.done) return;
            const src = thumb.dataset.src;
            if (!src) return;
            thumb.dataset.done = "1";
            const scale = (thumb.clientWidth || 150) / W;
            const ifr = document.createElement("iframe");
            // Every one of the 55 preview documents contains a <script>, and 30 of
            // them pull leaflet from a CDN. v1 mounted them with sandbox="" so all of
            // that was inert; without it they execute same-origin with /admin, where
            // they can reach the admin session's storage. Expect the map previews to
            // stop painting - that is exactly v1's behaviour, not a regression.
            ifr.setAttribute("sandbox", "");
            ifr.setAttribute("scrolling", "no");
            ifr.setAttribute("tabindex", "-1");
            ifr.setAttribute("aria-hidden", "true");
            ifr.style.transform = `scale(${scale.toFixed(4)})`;
            ifr.addEventListener("load", () => { thumb.querySelector(".v3-ph")?.remove(); });
            ifr.src = src;
            thumb.appendChild(ifr);
        };
        const thumbs = Array.from(root.querySelectorAll<HTMLElement>(".v3-thumb"));
        if (!("IntersectionObserver" in window)) { thumbs.forEach(fill); return; }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); fill(e.target as HTMLElement); } });
        }, { root, rootMargin: "260px 0px" });
        thumbs.forEach((t) => io.observe(t));
        return () => io.disconnect();
        // panel switches re-mount the grid; re-observe when Design opens
    }, [panel]);

    const vw = VIEWPORTS[viewport];

    return (
        <div className="flex h-[calc(100vh-8rem)] min-h-[560px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {/* Draft-recovery banner */}
            {m.hasCachedDraft && (
                <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">
                    <span>You have unsaved edits from a previous session.</span>
                    <span className="flex gap-2">
                        <button type="button" onClick={m.restoreCachedDraft} className="rounded bg-amber-500 px-2.5 py-1 font-semibold text-white hover:bg-amber-600">Restore</button>
                        <button type="button" onClick={m.dismissCachedDraft} className="rounded border border-amber-300 px-2.5 py-1 font-medium hover:bg-amber-100">Dismiss</button>
                    </span>
                </div>
            )}

            <div className="flex min-h-0 flex-1">
                {/* ── Left rail ─────────────────────────────────────────── */}
                <aside ref={railRef} className="flex w-[320px] flex-shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-neutral-50">
                    <div className="border-b border-neutral-200 px-4 py-3">
                        <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-600">Editor v3</div>
                        <h2 className="truncate text-sm font-bold text-neutral-900">{businessName}</h2>
                    </div>
                    {/* Panel switch */}
                    <div className="flex gap-1 border-b border-neutral-200 p-2">
                        {(["design", "content", "media"] as Panel[]).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPanel(p)}
                                className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold capitalize transition-colors ${panel === p ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}
                            >{p}</button>
                        ))}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {panel === "design" && (
                            <>
                                <section className="border-b border-neutral-200 p-4">
                                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Template</h3>
                                    {m.customizationsDirty && (
                                        <div className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                                            Pending · click Save changes to apply
                                            {m.savedHero && m.savedHero !== m.currentHeroStyle && (
                                                <span className="ml-1 font-normal">(saved: {m.savedHero})</span>
                                            )}
                                        </div>
                                    )}
                                    {/* S6 — "no template" is a real routed state (index.astro falls
                                        through to a bare stub), and without this card a mis-clicked
                                        template on a legacy submission could not be undone, nor could
                                        an admin see that no template was set. */}
                                    <button
                                        type="button"
                                        aria-pressed={m.currentHeroStyle === ""}
                                        onClick={() => m.onPickTemplate("")}
                                        className={`mb-3 flex w-full items-center gap-2 rounded-lg border border-dashed p-2 text-left text-[11px] transition-colors ${m.currentHeroStyle === "" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-neutral-300 text-neutral-500 hover:border-neutral-400"}`}
                                    >
                                        <span className="font-semibold">Auto / placeholder</span>
                                        <span className="text-neutral-400">use when no template is set</span>
                                    </button>
                                    {TEMPLATE_FAMILIES.map((fam) => (
                                        <div key={fam.family} className="mb-3 last:mb-0">
                                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{fam.label}</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {fam.templates.map((t) => {
                                                    const active = t.code === m.currentHeroStyle;
                                                    return (
                                                        <button
                                                            key={t.code}
                                                            type="button"
                                                            title={t.tagline}
                                                            aria-pressed={active}
                                                            onClick={() => m.onPickTemplate(t.code)}
                                                            className={`flex flex-col gap-1.5 overflow-hidden rounded-lg border p-1.5 text-left transition-all ${active ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500" : "border-neutral-200 bg-white hover:border-neutral-300 hover:-translate-y-px"}`}
                                                        >
                                                            <div className="v3-thumb relative aspect-[16/10] w-full overflow-hidden rounded-md border border-neutral-200 bg-white [&>iframe]:pointer-events-none [&>iframe]:absolute [&>iframe]:left-0 [&>iframe]:top-0 [&>iframe]:h-[800px] [&>iframe]:w-[1280px] [&>iframe]:origin-top-left [&>iframe]:border-0" data-src={t.preview}>
                                                                <span className="v3-ph absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-wide text-neutral-300">preview</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-neutral-800">{t.label}</span>
                                                                <span className="flex-shrink-0 font-mono text-[8px] uppercase text-neutral-400">{t.letter}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </section>
                                <section className="border-b border-neutral-200 p-4">
                                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                                        Colors {m.activeFamily && <span className="font-normal normal-case tracking-normal text-neutral-400">· suggested for {m.activeFamily}</span>}
                                    </h3>
                                    <div className="grid grid-cols-4 gap-2">
                                        {/* m.currentScheme is spliced in so a scheme saved OUTSIDE this
                                            family's curated set still shows as selected. v1 is the default
                                            today and lets any scheme be set on any template, so those rows
                                            exist - and they used to open here with every swatch unlit,
                                            reading as "nothing set". */}
                                        {["auto", ...curatedSchemes, m.currentScheme].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i).map((id) => {
                                            const active = m.currentScheme === id;
                                            return (
                                                <button key={id} type="button" title={COLOR_SCHEMES.find((c) => c.id === id)?.label ?? id} aria-pressed={active}
                                                    onClick={() => setThemeField("colorScheme", id)}
                                                    className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${active ? "border-amber-500 ring-1 ring-amber-500" : "border-neutral-200 hover:border-neutral-300"}`}>
                                                    <span className="h-5 w-full rounded" style={{ background: SCHEME_SWATCH[id] ?? "#999" }} />
                                                    <span className="w-full truncate text-center text-[8.5px] capitalize text-neutral-500">{id}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {/* The curated set is a shortlist, never a hard limit - the
                                        stated intent in editorConstants was that any scheme stays
                                        selectable. Without this an admin simply could not make a
                                        clinic site black and gold: medical hides 10 of the 15. */}
                                    {COLOR_SCHEMES.filter((c) => c.id !== "auto" && !curatedSchemes.includes(c.id) && c.id !== m.currentScheme).length > 0 && (
                                        <details className="mt-2">
                                            <summary className="cursor-pointer text-[10px] font-semibold text-neutral-500 hover:text-neutral-700">More colours</summary>
                                            <div className="mt-2 grid grid-cols-4 gap-2">
                                                {COLOR_SCHEMES.filter((c) => c.id !== "auto" && !curatedSchemes.includes(c.id) && c.id !== m.currentScheme).map((c) => (
                                                    <button key={c.id} type="button" title={c.label} aria-pressed={false}
                                                        onClick={() => setThemeField("colorScheme", c.id)}
                                                        className="flex flex-col items-center gap-1 rounded-lg border border-neutral-200 p-1.5 transition-colors hover:border-neutral-300">
                                                        <span className="h-5 w-full rounded" style={{ background: SCHEME_SWATCH[c.id] ?? "#999" }} />
                                                        <span className="w-full truncate text-center text-[8.5px] capitalize text-neutral-500">{c.id}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                </section>
                                <section className="border-b border-neutral-200 p-4">
                                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Font</h3>
                                    <div className="flex flex-wrap gap-1.5">
                                        {FONT_PAIRINGS.map((f) => {
                                            const active = m.currentFont === f.id;
                                            return (
                                                <button key={f.id} type="button" aria-pressed={active} onClick={() => setThemeField("fontPairing", f.id)}
                                                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${active ? "border-amber-500 bg-amber-50 font-semibold text-amber-700" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"}`}>
                                                    {f.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                                <section className="p-4">
                                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Sections</h3>
                                    <div className="space-y-0.5">
                                        {/* THE SELECTED TEMPLATE'S OWN SECTIONS, in the order that
                                            template renders them and under the names it prints on
                                            the page — "The rooms", not "SERVICES". Grouped by tier
                                            so an admin can still see what is structural and what is
                                            enrichment. sectionsForTemplate() reads membership and
                                            order from templateSectionOrder.generated.ts, which is
                                            generated from the wrappers, so this list cannot offer a
                                            switch the template has no section for. */}
                                        {(() => {
                                            const sections = sectionsForTemplate(String((m.effectiveCustomizations as any)?.heroStyle ?? ""));
                                            return TIER_META.map((tier) => {
                                                const inTier = sections.filter((sec) => (BLOCK_TIER[sec.block] ?? "extra") === tier.id);
                                                if (!inTier.length) return null;
                                                return (
                                                    <div key={tier.id} className="mb-3 last:mb-0">
                                                        <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                                                            {tier.label}<span className="ml-1 font-normal text-neutral-300">{inTier.length}</span>
                                                        </div>
                                                        <p className="mb-1.5 text-[10px] leading-snug text-neutral-400">{tier.blurb}</p>
                                                        {inTier.map((sec) => {
                                                            const visKey = VIS_KEY_BY_BLOCK[sec.block];
                                                            if (!visKey) return null;
                                                            const on = m.isBlockEnabled(visKey);
                                                            const required = tier.id === "essential";
                                                            const empty = blockHasContent(sec.block) === false;
                                                            return (
                                                                <button key={visKey} type="button" disabled={required} onClick={() => handleToggleBlock(visKey)} aria-checked={on} role="switch"
                                                                    title={sec.blurb}
                                                                    className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${required ? "cursor-not-allowed opacity-60" : "hover:bg-neutral-100"}`}>
                                                                    <span className={`relative mt-0.5 h-4 w-7 flex-shrink-0 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-neutral-300"}`}>
                                                                        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${on ? "translate-x-3.5" : "translate-x-0.5"}`} />
                                                                    </span>
                                                                    <span className="min-w-0 flex-1">
                                                                        <span className={`flex items-center gap-1 text-[11px] font-medium ${on ? "text-neutral-700" : "text-neutral-400"}`}>
                                                                            <span className="truncate">{sec.label}</span>
                                                                            {empty && <span className="flex-shrink-0 rounded bg-neutral-100 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-neutral-400" title="Nothing to show here yet - the section will render empty or auto-hide.">empty</span>}
                                                                            {required && <span className="flex-shrink-0 font-mono text-[8px] uppercase text-neutral-400">locked</span>}
                                                                        </span>
                                                                        {sec.blurb && <span className="mt-0.5 block text-[10px] leading-snug text-neutral-400">{sec.blurb}</span>}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </section>
                            </>
                        )}

                        {panel === "content" && (
                            <div className="p-3">
                                <p className="mb-2 px-1 text-[10px] leading-snug text-neutral-400">Edit any field here, or click text in the preview to jump to it. Lists, links &amp; images add/remove/reorder safely.</p>
                                <ContentFieldsAuto getValue={contentGetValue} setValue={setContentValue} openImagePicker={(path) => setImagePickerField(path)} pushLiveText={pushLiveText} templateCode={String((m.effectiveCustomizations as any)?.heroStyle ?? "")} />
                            </div>
                        )}

                        {panel === "media" && (
                            <section className="p-4">
                                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">Media</h3>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f, pendingImageField); }} />
                                <div className="flex flex-col gap-2">
                                    <button type="button" disabled={uploadingPhoto} onClick={() => { setPendingImageField(null); fileInputRef.current?.click(); }} className={TB}>
                                        {uploadingPhoto ? "Uploading…" : "Upload photo"}
                                    </button>
                                    <button type="button" disabled={uploadingPhoto} onClick={() => { setPendingImageField("favicon"); fileInputRef.current?.click(); }} className={TB}>
                                        Set favicon
                                    </button>
                                    {uploadError && <p className="text-[11px] text-red-600">{uploadError}</p>}
                                    <p className="text-[10px] leading-snug text-neutral-400">Tip: click any image in the preview to swap it from your photos.</p>
                                </div>
                                {/* Favicon card: v3 had a bare "Set favicon" button with no
                                    thumbnail, no current-state and no way to clear one — and a
                                    wrong favicon ships to the customer's browser tab and to link
                                    unfurls, where astro-builder also uses it as the og:image
                                    fallback. */}
                                <div className="mt-3 flex items-center gap-3 rounded-lg border border-neutral-200 p-2">
                                    {faviconUrl
                                        ? <img src={faviconUrl} alt="" className="h-10 w-10 shrink-0 rounded border border-neutral-200 object-cover" />
                                        : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-dashed border-neutral-300 text-[9px] text-neutral-400">none</div>}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">Favicon</p>
                                        <p className="truncate text-[10px] text-neutral-500">{faviconUrl || "Using the template default"}</p>
                                    </div>
                                    {faviconUrl && (
                                        <button type="button" onClick={clearFavicon} className="shrink-0 text-[10px] font-semibold text-red-600 hover:underline">Remove</button>
                                    )}
                                </div>

                                {effectivePhotos.length > 0 && (
                                    <>
                                        <div className="mt-3 flex items-baseline justify-between">
                                            <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                                                Photos <span className="text-neutral-300">· {effectivePhotos.length}</span>
                                            </h4>
                                            {pendingImageField && (
                                                <button type="button" onClick={() => setPendingImageField(null)} className="text-[10px] font-semibold text-neutral-500 hover:underline">Cancel</button>
                                            )}
                                        </div>
                                        {/* Click-to-assign: with a slot pending, the grid becomes a
                                            picker so an EXISTING photo can fill it with no re-upload.
                                            v3 had no path to that at all. */}
                                        {pendingImageField && (
                                            <p className="mt-1 text-[10px] text-amber-700">Pick a photo for <b>{pendingImageField}</b>.</p>
                                        )}
                                        <div className="mt-2 grid grid-cols-3 gap-2">
                                            {effectivePhotos.map((url, i) => {
                                                const uploaded = !(photos ?? []).includes(url);
                                                return (
                                                    <div key={`${url}-${i}`} className="group relative">
                                                        <img
                                                            src={url} alt="" loading="lazy"
                                                            onClick={() => { if (pendingImageField) { assignImageSlot(pendingImageField, url); setPendingImageField(null); } }}
                                                            className={`aspect-square w-full rounded-md border object-cover ${pendingImageField ? "cursor-pointer border-amber-400 hover:ring-2 hover:ring-amber-400" : "border-neutral-200"}`}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removePhoto(i)}
                                                            title="Remove this photo"
                                                            aria-label="Remove this photo"
                                                            className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white group-hover:flex"
                                                        >×</button>
                                                        {/* The badge used to read "uploaded · unsaved" for as long as the
                                                            photo existed. `uploaded` only means "this url is not one of
                                                            the submission's ORIGINAL photos" — and saving persists the draft,
                                                            not submissions.photos, so that stayed true after a successful
                                                            save and the label went on calling a saved photo unsaved. An
                                                            admin uploads, saves, still reads "unsaved", and re-uploads.
                                                            The upload half is a fact about the photo; the unsaved half is a
                                                            fact about the DRAFT, so it now tracks the real dirty state. */}
                                                        {uploaded && (
                                                            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[8px] font-semibold text-white">
                                                                {m.dirty ? "uploaded · unsaved" : "uploaded"}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </section>
                        )}
                    </div>
                </aside>

                {/* ── Preview + toolbar ─────────────────────────────────── */}
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
                        {/* Dirty-gated, so the button IS the unsaved indicator. v3 injects
                            theme and colour live into the iframe, so without this the page
                            looks changed while nothing is persisted — an admin could pick a
                            scheme, watch it apply, and leave believing it had saved. */}
                        <button type="button" onClick={handleSave} disabled={busy || previewing || !m.dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40">
                            {saving ? "Saving…" : m.dirty ? "Save changes" : "Saved"}
                        </button>
                        <button type="button" onClick={handleReset} disabled={busy || previewing || !m.dirty} className={TB} title="Discard every unsaved change and go back to the last saved version">Reset</button>
                        <button type="button" onClick={handlePreviewBuild} disabled={busy || previewing || !m.dirty} className={TB} title="Build your real content into the current picks (~30–60s) without saving">
                            {previewing ? "Building…" : "Preview my site"}
                        </button>
                        <button type="button" onClick={m.undo} disabled={!m.canUndo} className={TB} title="Undo (Ctrl/Cmd+Z)">Undo</button>
                        <button type="button" onClick={m.redo} disabled={!m.canRedo} className={TB} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button>
                        {/* The tooltip has to say the same thing the picker does. It
                            used to promise "its whole kind", which is now the OPT-IN
                            ("Every section") rather than what a click does. */}
                        <button type="button" onClick={toggleColorMode} aria-pressed={colorMode} className={`${TB}${colorMode ? " ring-2 ring-neutral-900" : ""}`} title="Colour mode — click any button, heading, or text to recolour its kind in that section; the picker can widen it to every section, and give buttons and links their own hover and pressed colours">
                            {colorMode ? "🎨 Colors ✓" : "🎨 Colors"}
                        </button>
                        <div className="ml-1 flex overflow-hidden rounded-lg border border-neutral-200">
                            {(Object.keys(VIEWPORTS) as Array<keyof typeof VIEWPORTS>).map((vp) => (
                                <button key={vp} type="button" onClick={() => setViewport(vp)} className={`px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-colors ${viewport === vp ? "bg-neutral-900 text-white" : "bg-white text-neutral-500 hover:bg-neutral-100"}`}>{vp}</button>
                            ))}
                        </div>
                        <button type="button" onClick={onRegenerate} disabled={busy || previewing} className={TB}>Regenerate</button>
                        {/* Two anchors, both present. They are not interchangeable: after a
                            Regenerate (which rebuilds but never publishes) the published URL
                            still serves the OLD page, so collapsing them with `||` broke
                            exactly the comparison the "out of date" badge asks for. */}
                        {websiteGenerated && (
                            <a href={`/api/preview/${submissionId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-neutral-300" title="The build currently on disk, published or not">View build</a>
                        )}
                        {websitePublishedUrl && (
                            <a href={websitePublishedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-neutral-300" title="The page the public sees right now">Live</a>
                        )}
                        <button type="button" onClick={onEnhanceImages} disabled={enhancing} className={TB}>{enhancing ? "Enhancing…" : "Enhance"}</button>
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            {/* Hidden once the submission is settled. Re-approving is not a
                                no-op: it re-sends the creator an approval notification and
                                re-increments the approvedCount that drives their price-ceiling
                                unlock, and nothing server-side guards against it. */}
                            {onApprove && submissionStatus !== "approved" && submissionStatus !== "rejected" && <button type="button" onClick={onApprove} className={TB}>Approve</button>}
                            {onReject && submissionStatus !== "rejected" && <button type="button" onClick={onReject} className={`${TB} !text-red-600`}>Reject</button>}
                            {publishStale && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-bold text-amber-900" title="The live site still has the previous version. Click Republish to update it.">
                                    ⚠ Live site is out of date
                                </span>
                            )}
                            {websitePublishedUrl ? (
                                <>
                                    <button type="button" onClick={onRepublish} disabled={republishingWebsite} className={publishStale ? "inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40" : TB}>{republishingWebsite ? "Republishing…" : publishStale ? "Republish · changes not live" : "Republish"}</button>
                                    <button type="button" onClick={onUnpublish} disabled={unpublishingWebsite} className={TB}>{unpublishingWebsite ? "Unpublishing…" : "Unpublish"}</button>
                                </>
                            ) : (
                                <button type="button" onClick={onPublish} disabled={publishingWebsite || !websiteGenerated} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-700 disabled:opacity-40">{publishingWebsite ? "Publishing…" : "Publish"}</button>
                            )}
                            <button type="button" onClick={onSendToClient} disabled={sendingEmail} className={TB}>{sendingEmail ? "Sending…" : "Send to client"}</button>
                            {canGiveFree && <button type="button" onClick={onGiveFree} disabled={markingComped} className={TB} title="Give this website to the owner for free — the creator is still paid.">{markingComped ? "Giving…" : "Give free"}</button>}
                            {onToggleDetails && <button type="button" onClick={onToggleDetails} className={TB}>Details</button>}
                            <button type="button" onClick={onDelete} className={`${TB} !text-red-600`}>Delete</button>
                        </div>
                    </div>

                    <div className="relative flex-1 overflow-auto bg-neutral-100">
                        {(busy || previewing) && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                                <div className="flex items-center gap-3 text-sm font-medium text-neutral-600">
                                    <span className="h-5 w-5 animate-spin rounded-full border-b-2 border-amber-500" />
                                    {saving ? "Saving + rebuilding…" : previewing ? "Building a preview with your content…" : "Rebuilding website…"}
                                </div>
                            </div>
                        )}
                        {previewBuildHtml && (
                            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-amber-500/95 px-3 py-1.5 text-[11px] font-semibold text-white">
                                <span className="truncate">Previewing your unsaved changes (real content) — click “Save changes” to keep them.</span>
                                <button type="button" onClick={() => setPreviewBuildHtml(null)} className="flex-shrink-0 rounded bg-white/20 px-2 py-0.5 hover:bg-white/30">Back to saved</button>
                            </div>
                        )}
                        <div className="mx-auto h-full bg-white" style={vw ? { width: vw, maxWidth: "100%", boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" } : { width: "100%" }}>
                            {previewBuildHtml ? (
                                <iframe key="v3-preview" ref={iframeRef} srcDoc={injectEditorBridge(previewBuildHtml)} title="Unsaved preview (v3)" className="h-full w-full border-0 bg-white" sandbox="allow-same-origin allow-scripts allow-popups" onLoad={handleIframeLoad} />
                            ) : htmlContent ? (
                                <iframe key="v3-saved" ref={iframeRef} srcDoc={previewHtml} title="Website preview (v3)" className="h-full w-full border-0 bg-white" sandbox="allow-same-origin allow-scripts allow-popups" onLoad={handleIframeLoad} />
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm text-neutral-400">No website generated yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {colorMode && !colorPopover && (
                <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 9998, background: "#0f172a", color: "#fff", borderRadius: 999, padding: "8px 16px", fontSize: 12, fontWeight: 600, fontFamily: "ui-sans-serif, system-ui, sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
                    🎨 Colour mode — click a button, heading, or text to recolour its kind in that section
                </div>
            )}
            {colorPopover && (() => {
                const def = COLOR_ROLES[colorPopover.role];
                const prop = colorPopover.prop;
                // THE SCOPE ON SCREEN decides the key — null for every-section.
                // `existing`, the swatch and Reset all read that one key, so
                // flipping the scope shows that scope's own stored colour and
                // Reset can only ever clear the colour being shown. Reading the
                // role's other key here would have made Reset clear a colour the
                // admin was not looking at.
                const scoped = colorPopover.scopeAll ? null : (colorPopover.section || null);
                // The same trap as the scope axis, now three-deep: the swatch,
                // Reset and the stored key all follow prop x scope x STATE. A
                // role that is not offered the state axis is pinned to 'base',
                // so it goes on writing exactly the key it always wrote.
                const hasStates = ROLE_HAS_STATES[colorPopover.role];
                const state: ColorState = hasStates ? colorPopover.state : "base";
                const storedMap = (((m.effectiveCustomizations as any)?.roleColors) ?? {}) as Record<string, string>;
                // What a given state has STORED at the prop + scope on screen.
                // The dots report this and only this — never the fallback below,
                // or every state would look as though it had been picked.
                const storedFor = (st: ColorState) =>
                    storedMap[roleColorKey(colorPopover.role, prop, scoped, st)] as string | undefined;
                const key = roleColorKey(colorPopover.role, prop, scoped, state);
                const existing = storedMap[key] as string | undefined;
                // Where the picker starts when this triple has nothing stored.
                // For a non-resting state that is the BASE pick if there is one:
                // 'base' paints :hover as well (STATE_SUFFIXES), so the base
                // colour is literally what the page renders when pointed at.
                // Starting from the element's own computed colour instead would
                // open on a colour the page stopped using the moment the resting
                // one was picked.
                const computed = prop === "bg" ? colorPopover.curBg : colorPopover.curFg;
                const fallback = (state !== "base" ? storedFor("base") : undefined)
                    || computed
                    || (prop === "bg" ? "#3366cc" : "#111111");
                const value = (existing || fallback || "#000000").slice(0, 7);
                const where = scoped ? sectionName(scoped) : "every section";
                const propLabel = prop === "bg" ? "fill" : "text";
                // Say so rather than letting a pick land on nothing. `-1` means
                // the count could not be taken, which is not the same as zero.
                const activeMatches = colorPopover.scopeAll ? colorPopover.allMatches : colorPopover.sectionMatches;
                const note = activeMatches !== 0 ? null
                    : colorPopover.scopeAll
                        ? "Nothing on this page uses this colour."
                        : `Nothing in ${sectionName(colorPopover.section)} uses this colour — pick “Every section”.`;
                const segBtn = (active: boolean) => ({
                    padding: "6px 10px", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                    whiteSpace: "nowrap" as const,
                    background: active ? "#0f172a" : "#fff", color: active ? "#fff" : "#64748b",
                });
                const caption = {
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
                    textTransform: "uppercase" as const, color: "#64748b",
                };
                return (
                    <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 9998, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,0.22)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, fontFamily: "ui-sans-serif, system-ui, sans-serif", minWidth: 300, maxWidth: "min(420px, calc(100vw - 32px))" }}>
                        {/* Three segmented controls side by side is one row nobody
                            reads, so the popover is a COLUMN: what is changing, then
                            the two "which pixels" axes, then the state axis on a row
                            of its own (it is three segments wide and each carries a
                            swatch), then the colour itself. */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                <span style={caption}>Recolour</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>{def.label}</span>
                                {/* Never just "Primary buttons": the same role lives in
                                    the hero and the closing band, so the name of the
                                    role alone cannot say which one is about to change. */}
                                <span style={{ fontSize: 11, color: "#64748b" }}>in {where}</span>
                            </div>
                            <button type="button" onClick={() => setColorPopover(null)} aria-label="Close"
                                style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 0 0 6px" }}>&times;</button>
                        </div>
                        {(def.props.length > 1 || !!colorPopover.section) && (
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                                {def.props.length > 1 && (
                                    <div role="group" aria-label="Which part of the element this colour applies to"
                                        style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                                        {def.props.map((p) => (
                                            <button key={p} type="button" aria-pressed={prop === p} onClick={() => setColorPopover((c) => (c ? { ...c, prop: p } : c))}
                                                style={segBtn(prop === p)}>
                                                {p === "bg" ? "Fill" : "Text"}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {/* Offered only when the click could be placed in a section
                                    — with none, every-section is not a choice, it is the
                                    only key there is. */}
                                {colorPopover.section && (
                                    <div role="group" aria-label="Which sections this colour applies to"
                                        style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                                        <button type="button" aria-pressed={!colorPopover.scopeAll}
                                            onClick={() => setColorPopover((c) => (c ? { ...c, scopeAll: false } : c))}
                                            title={colorPopover.sectionMatches === 0
                                                ? `Nothing in ${sectionName(colorPopover.section)} uses this colour`
                                                : `Only in ${sectionName(colorPopover.section)}`}
                                            style={segBtn(!colorPopover.scopeAll)}>This section</button>
                                        <button type="button" aria-pressed={colorPopover.scopeAll}
                                            onClick={() => setColorPopover((c) => (c ? { ...c, scopeAll: true } : c))}
                                            title={`${def.label} everywhere on the page`}
                                            style={segBtn(colorPopover.scopeAll)}>Every section</button>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Each segment wears the colour stored for its state at the
                            prop + scope on screen — hollow when there is none. An
                            admin cannot be asked to click all three to find out which
                            ones they have already set, and the dot is also the only
                            thing that separates "Hover is deliberately the same" from
                            "Hover was never touched". */}
                        {hasStates && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={caption}>State</span>
                                <div role="group" aria-label="Which pointer state this colour applies to"
                                    style={{ display: "flex", alignSelf: "flex-start", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                                    {COLOR_STATES.map((st) => {
                                        const on = state === st;
                                        const stColor = storedFor(st);
                                        return (
                                            <button key={st} type="button" aria-pressed={on}
                                                onClick={() => setColorPopover((c) => (c ? { ...c, state: st } : c))}
                                                aria-label={`${COLOR_STATE_LABELS[st]} — ${stColor ? `${propLabel} colour set, ${stColor}` : `no ${propLabel} colour set`}`}
                                                title={stColor
                                                    ? `${COLOR_STATE_LABELS[st]}: ${stColor}`
                                                    // `base` paints :hover as well, so an unset Hover
                                                    // really does follow Normal. Nothing paints
                                                    // :active until :active is picked, so an unset
                                                    // Pressed is the template's own, not Normal's.
                                                    : st === "hover"
                                                        ? "Hover: follows Normal"
                                                        : `${COLOR_STATE_LABELS[st]}: unchanged from the template`}
                                                style={{ ...segBtn(on), display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                <span aria-hidden="true" style={{
                                                    width: 10, height: 10, borderRadius: "50%", flex: "0 0 auto",
                                                    background: stColor || "transparent",
                                                    border: stColor
                                                        ? `1px solid ${on ? "rgba(255,255,255,0.8)" : "rgba(15,23,42,0.28)"}`
                                                        : `1px dashed ${on ? "rgba(255,255,255,0.6)" : "#cbd5e1"}`,
                                                }} />
                                                {COLOR_STATE_LABELS[st]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <input type="color" value={value} onChange={(e) => applyRoleColor(colorPopover.role, prop, e.target.value, scoped, state)}
                                style={{ width: 44, height: 36, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", padding: 2, flex: "0 0 auto" }}
                                aria-label={`${def.label} ${propLabel} colour${hasStates ? `, ${COLOR_STATE_LABELS[state].toLowerCase()} state` : ""}, in ${where}`} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: existing ? "#0f172a" : "#94a3b8" }}>
                                {existing ? existing.toUpperCase() : "Not set"}
                            </span>
                            {existing && (
                                <button type="button" onClick={() => applyRoleColor(colorPopover.role, prop, null, scoped, state)}
                                    title={`Remove the ${hasStates ? `${COLOR_STATE_LABELS[state].toLowerCase()} ` : ""}${propLabel} colour for ${def.label} in ${where}`}
                                    style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>Reset</button>
                            )}
                        </div>
                        {note && (
                            <span role="status" style={{ fontSize: 11, fontWeight: 600, color: "#b45309" }}>{note}</span>
                        )}
                    </div>
                );
            })()}
            {/* originals={effectivePhotos}, NOT the raw photos prop.
                /api/upload-image returns an R2 url into draft.images and never
                touches submissions.photos, so a photo uploaded in the Media tab
                was missing from the one picker an admin actually reaches — the
                one that opens when they click an image in the preview. The
                Media grid was fixed for this; the modal was not. */}
            <ImagePickerModal
                open={!!imagePickerField}
                field={imagePickerField}
                originals={effectivePhotos}
                enhanced={(enhancedImageUrls ?? []) as unknown as Record<string, any>}
                onClose={() => setImagePickerField(null)}
                onSelect={handleImagePick}
            />
            <LinkPopover open={!!linkData} initial={linkData} onClose={() => setLinkData(null)} onSave={handleLinkSave} />
        </div>
    );
}
