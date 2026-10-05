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
 * Same SandboxEditorProps + onSaveContent + astro build + ed:* bridge as v1/v2.
 * Draft model + undo/redo + local draft recovery live in useEditorDraft.
 *
 * ROUND 1 LAYOUT (board Review). The left panel (Design · Content · Media tabs),
 * the preview frame in the middle, and a slot on the right for the page's
 * details panel. The editor's own toolbar is gone: its controls (save, undo,
 * redo, preview size) are handed to the page through `renderHeader`, which
 * draws the one workspace header the board asks for, with the page's actions
 * beside them. On a phone the panels and the preview take turns behind one
 * tab row (Preview · Design · Content · Media).
 *
 * Everything below the layout — how the draft is read, written, saved, drafted
 * and previewed, and every message sent to or received from the iframe — is
 * exactly what it was.
 *
 * NOT runtime-tested locally (Next build won't finish on the dev box) — verify on
 * a throwaway submission per the PR's checklist.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { Check, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Dot, Field, Icon, Segmented, Select, Tabs, cx, type TabItem } from "@/components/r1";
import WebsitePreview, { PREVIEW_DEVICE_OPTIONS, type PreviewDevice } from "@/components/WebsitePreview";
import { injectEditorBridge } from "./editorBridge";
import type { EditorJson, EditorTools, SandboxEditorProps } from "./editorProps";
import { ALL_TEMPLATES, TEMPLATE_FAMILIES, familyOf, templateByCode, sectionsForTemplate, BLOCK_TIER, BLOCK_CONTENT_PATHS } from "./templateCatalog";
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
import { useMinWidth } from "./useMinWidth";

/**
 * The colour each scheme swatch shows. These are the CUSTOMER SITE's scheme
 * colours (data, not Round 1 chrome), so they stay literal.
 */
const SCHEME_SWATCH: Record<string, string> = {
    auto: "#94a3b8", blue: "#2563eb", green: "#16a34a", purple: "#7c3aed",
    orange: "#ea580c", dark: "#1f2937", pink: "#db2777", brown: "#92400e",
    red: "#dc2626", yellow: "#eab308", maroon: "#7f1d1d", black: "#111111",
    gold: "#b8860b", whitegold: "#d4af37", professional: "#334155",
};

/** Rows the Sections list and the template shortlist show before "Show all". */
const SHORTLIST = 6;

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

/** "https://x.sites.tendso.com/" → "x.sites.tendso.com", for the address bar. */
function hostOf(url: string): string {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

type Panel = "design" | "content" | "media";
/** The phone's extra tab: the preview cannot sit beside the panels there. */
type Pane = Panel | "preview";

export default function SandboxEditorV3(props: SandboxEditorProps) {
    const {
        businessName, businessType, htmlContent, htmlLoading, submissionId, photos, enhancedImageUrls,
        onSaveContent, websitePublishedUrl, websiteGenerated, generatingWebsite,
        renderHeader, aside,
    } = props;

    const m = useEditorDraft(props);
    // The LATEST hook object, readable from anything that runs after a commit
    // rather than during the render that made it. `m` is rebuilt every render,
    // so a callback that closed over it still holds the pre-commit values —
    // which is how Reset discarded a theme/colour change in the model and then
    // repainted the preview with the very values it had just thrown away (its
    // rAF re-ran the appliers, but the ones captured before resetDraft).
    const mRef = useRef(m);
    mRef.current = m;

    // Desk: the panels (Design · Content · Media) sit beside the preview, which
    // is always in view. Phone: one pane at a time, the preview first.
    const isDesk = useMinWidth(1024);
    const [pane, setPane] = useState<Pane>("preview");
    const activePane: Pane = isDesk && pane === "preview" ? "design" : pane;
    const panelRef = useRef<Pane>(activePane);
    panelRef.current = activePane;
    // The preview size. Until the admin picks one it follows the screen: a
    // phone shows the phone layout (a 1440px desktop at a quarter scale is
    // unreadable there), anything wider the desktop one.
    const [deviceChoice, setDevice] = useState<PreviewDevice | null>(null);
    const small = !useMinWidth(640);
    const device: PreviewDevice = deviceChoice ?? (small ? "phone" : "desktop");
    // "Full width" hides the panels so the preview gets the whole column.
    const [fullWidth, setFullWidth] = useState(false);
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
    // Show-all toggles for the Design panel's three lists.
    const [templatesAll, setTemplatesAll] = useState(false);
    const [schemesAll, setSchemesAll] = useState(false);
    const [sectionsAll, setSectionsAll] = useState(false);
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
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const busy = generatingWebsite || saving;
    const previewHtml = useMemo(() => injectEditorBridge(htmlContent || ""), [htmlContent]);
    const unsavedPreviewHtml = useMemo(() => (previewBuildHtml ? injectEditorBridge(previewBuildHtml) : ""), [previewBuildHtml]);

    // ── Stale-publish signal ──────────────────────────────────────────────
    // Every rebuild (Save, Regenerate) resets generatedWebsites.status to
    // 'draft' while publishedUrl stays set, so `draft + publishedUrl` means the
    // live Cloudflare Worker is still serving the OLD HTML. Save auto-republishes
    // (app/api/save-content), so this normally clears itself within seconds —
    // when it does NOT (republish failed, or the admin used Regenerate, which
    // doesn't publish), the admin has to see that the customer's site is behind.
    // Read off the reactive row so it lights and clears on its own. The page's
    // header shows it ("Changes not live yet"); here it only labels the frame.
    const websiteRow = useQuery(
        api.generatedWebsites.getBySubmissionId,
        submissionId ? { submissionId: submissionId as Id<"submissions"> } : "skip"
    );
    // Offline = the Worker serves the holding page. The page withholds
    // websitePublishedUrl then, so the address bar says so instead.
    const websiteOffline = !!websiteRow?.offlineAt;
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
        const own = (m.draft as EditorJson)?.images;
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
        business_name: (m.draft as EditorJson)?.business_name || businessName,
        business_city: (m.draft as EditorJson)?.business_city || (m.draft as EditorJson)?.contact?.city,
        business_type: (m.draft as EditorJson)?.business_type || businessType,
        tagline: (m.draft as EditorJson)?.tagline,
        about: (m.draft as EditorJson)?.about,
        contact: (m.draft as EditorJson)?.contact,
    }, photos), [m.draft, businessName, businessType, photos]);

    const contentGetValue = useCallback((path: string) => {
        const v = m.getValue(path);
        if (v !== undefined && v !== null && v !== '') return v;
        return getDerivedAt(derived, path);
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const setContentValue = useCallback((path: string, value: EditorJson) => {
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

    const curatedSchemes = schemesForTemplate(m.activeFamily, String((m.effectiveCustomizations as EditorJson)?.heroStyle ?? ""));

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
    const pushLiveText = useCallback((path: string, value: EditorJson) => {
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
            target.addEventListener("keydown", (ev: KeyboardEvent) => {
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
            const wiredEl = el as HTMLElement & { __v3wired?: boolean };
            if (!field || wiredEl.__v3wired) return;
            if (el.hasAttribute("data-href-field") || el.hasAttribute("data-image-field")) return;
            if (el.tagName.toLowerCase() === "a" && /^(tel:|mailto:)/i.test(el.getAttribute("href") || "")) return;
            if (SKIP(field)) return;
            const childEls = Array.from(el.children);
            const looseText = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && !!n.nodeValue && !!n.nodeValue.trim());
            wiredEl.__v3wired = true;
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
    const focusSidebarField = useCallback((field: string) => {
        // On a phone the preview and the panels take turns. While the admin is
        // looking at the preview, a click there is an inline edit in progress:
        // switching to the Content pane would hide the very text being typed
        // into, so the preview stays. On a desk both are in view and the
        // sidebar follows the click, as it always has.
        if (panelRef.current === "preview") return;
        if (panelRef.current !== "content") setPane("content");
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
        applyRoleColorsToIframe(iframeRef.current, (mRef.current.effectiveCustomizations as EditorJson)?.roleColors);
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
        const base = (((m.effectiveCustomizations as EditorJson)?.roleColors) ?? {}) as Record<string, string>;
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
            const data: EditorJson = e?.data;
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
                focusSidebarField(data.field);
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
        } catch (err: unknown) {
            setUploadError(err instanceof Error ? err.message : "Image upload failed");
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
        } catch (err: unknown) {
            toast.error("Save failed", { id: toastId, description: err instanceof Error ? err.message : "Please try again." });
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
        } catch (err: unknown) {
            toast.error("Preview failed", { id: toastId, description: err instanceof Error ? err.message : "Please try again." });
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

    // ── What the page's header gets ───────────────────────────────────────
    const tools: EditorTools = {
        dirty: m.dirty,
        saving,
        save: () => { void handleSave(); },
        discard: handleReset,
        previewUnsaved: () => { void handlePreviewBuild(); },
        previewing,
        undo: m.undo,
        redo: m.redo,
        canUndo: m.canUndo,
        canRedo: m.canRedo,
        device,
        setDevice,
        busy: busy || previewing,
    };

    // ── Design panel data ─────────────────────────────────────────────────
    const savedHero = m.savedHero;
    const pickedHero = m.currentHeroStyle;
    const savedTemplate = templateByCode(savedHero);
    const pickedTemplate = templateByCode(pickedHero);
    // The shortlist leads with the saved template's own family (the likeliest
    // alternatives), then the catalogue in its usual order. A pending pick from
    // "Show all" is pulled in so the highlighted card is always on screen.
    const tryAnother = (() => {
        const fam = familyOf(savedHero);
        const pool = [
            ...ALL_TEMPLATES.filter((t) => fam && familyOf(t.code) === fam),
            ...ALL_TEMPLATES,
        ].filter((t, i, a) => t.code !== savedHero && a.findIndex((x) => x.code === t.code) === i);
        let six = pool.slice(0, SHORTLIST);
        if (pickedTemplate && pickedHero !== savedHero && !six.some((t) => t.code === pickedHero)) {
            six = [pickedTemplate, ...six.slice(0, SHORTLIST - 1)];
        }
        return six;
    })();
    const templatePending = m.customizationsDirty && pickedHero !== savedHero;

    // m.currentScheme is spliced in so a scheme saved OUTSIDE this family's
    // curated set still shows as selected. v1 let any scheme be set on any
    // template, so those rows exist - and they used to open here with every
    // swatch unlit, reading as "nothing set".
    const schemeShortlist = ["auto", ...curatedSchemes, m.currentScheme].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);
    // The curated set is a shortlist, never a hard limit - the stated intent in
    // editorConstants was that any scheme stays selectable. Without "Show all"
    // an admin simply could not make a clinic site black and gold: medical
    // hides 10 of the 15.
    const schemeRest = COLOR_SCHEMES.map((c) => c.id as string).filter((id) => !schemeShortlist.includes(id));
    const schemesShown = schemesAll ? [...schemeShortlist, ...schemeRest] : schemeShortlist;
    const schemeLabelOf = (id: string) => COLOR_SCHEMES.find((c) => c.id === id)?.label ?? id;
    const fontKnown = FONT_PAIRINGS.some((f) => f.id === m.currentFont);

    // THE SELECTED TEMPLATE'S OWN SECTIONS, in the order that template renders
    // them and under the names it prints on the page — "The rooms", not
    // "SERVICES". sectionsForTemplate() reads membership and order from
    // templateSectionOrder.generated.ts, which is generated from the wrappers,
    // so this list cannot offer a switch the template has no section for.
    const templateSections = sectionsForTemplate(String((m.effectiveCustomizations as EditorJson)?.heroStyle ?? ""))
        .filter((sec) => !!VIS_KEY_BY_BLOCK[sec.block]);
    const sectionsOnCount = templateSections.filter((sec) => m.isBlockEnabled(VIS_KEY_BY_BLOCK[sec.block])).length;
    const sectionsShown = sectionsAll ? templateSections : templateSections.slice(0, SHORTLIST);

    const linkBtn = "inline-flex h-8 items-center self-start border-0 bg-transparent p-0 text-[13px] font-medium text-r1-ink underline decoration-r1-ink-4 underline-offset-[3px] hover:decoration-r1-ink disabled:cursor-not-allowed disabled:opacity-45";

    const templateCard = (code: string, name: string, tag: string) => (
        <button
            key={code || "auto"}
            type="button"
            aria-pressed={pickedHero === code}
            onClick={() => m.onPickTemplate(code)}
            className="flex min-h-14 min-w-0 flex-col items-start gap-1 rounded-r1 border border-r1-line bg-r1-paper p-2.5 text-left hover:bg-r1-fill-row aria-pressed:border-r1-ink aria-pressed:shadow-[inset_0_0_0_1px_var(--r1-ink)]"
        >
            <span className="w-full truncate text-[13px] font-medium leading-[18px] text-r1-ink">{name}</span>
            <span className="line-clamp-2 text-xs leading-4 text-r1-ink-3">{tag}</span>
        </button>
    );

    const designPanel = (
        <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-2.5" aria-label="Template">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold leading-5 text-r1-ink">Template</h2>
                    <span className="t-count">{ALL_TEMPLATES.length} in {TEMPLATE_FAMILIES.length} families</span>
                </div>
                {templatePending && (
                    <div className="flex items-start gap-2 text-[13px] leading-[18px] text-r1-ink-2" role="status">
                        <Dot tone="attn" className="mt-[5px]" />
                        <span>
                            {pickedTemplate ? pickedTemplate.label : "No template"} is picked but not built yet. Save changes to apply it,
                            or{" "}
                            <button type="button" className="t-link font-medium" disabled={busy || previewing} onClick={() => void handlePreviewBuild()}>
                                {previewing ? "building a preview…" : "preview it with your content first"}
                            </button>
                            .
                        </span>
                    </div>
                )}
                <span className="t-label">Generated with</span>
                {/* "No template" is a real routed state (index.astro falls
                    through to a bare stub). The card says so rather than
                    showing nothing, and the Auto option below stays pickable,
                    so a mis-clicked template on a legacy submission can still
                    be undone. */}
                <button
                    type="button"
                    aria-pressed={pickedHero === savedHero}
                    onClick={() => m.onPickTemplate(savedHero)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-r1 border border-r1-line bg-r1-paper px-3 py-2.5 text-left hover:bg-r1-fill-row aria-pressed:border-r1-ink aria-pressed:shadow-[inset_0_0_0_1px_var(--r1-ink)]"
                >
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] font-medium leading-[18px] text-r1-ink">{savedTemplate ? savedTemplate.label : "Auto / placeholder"}</span>
                        <span className="text-xs leading-4 text-r1-ink-3">{savedTemplate ? savedTemplate.tagline : "No template set: the page falls back to a stub"}</span>
                    </span>
                </button>
                <span className="t-label">Try another</span>
                <div className="grid grid-cols-2 gap-2">
                    {tryAnother.map((t) => templateCard(t.code, t.label, t.tagline))}
                </div>
                {templatesAll && (
                    <>
                        {savedHero !== "" && (
                            <>
                                <span className="t-label">No template</span>
                                <div className="grid grid-cols-2 gap-2">{templateCard("", "Auto / placeholder", "Use when no template is set")}</div>
                            </>
                        )}
                        {TEMPLATE_FAMILIES.map((fam) => (
                            <div key={fam.family} className="flex flex-col gap-2.5">
                                <span className="t-label">{fam.label}</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {fam.templates.map((t) => templateCard(t.code, t.label, t.tagline))}
                                </div>
                            </div>
                        ))}
                    </>
                )}
                <button type="button" className={linkBtn} aria-expanded={templatesAll} onClick={() => setTemplatesAll((v) => !v)}>
                    {templatesAll ? "Show fewer" : `Show all ${ALL_TEMPLATES.length}`}
                </button>
            </section>

            <section className="flex flex-col gap-2.5" aria-label="Colour scheme">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold leading-5 text-r1-ink">Colour scheme</h2>
                    <span className="t-meta truncate">{schemeLabelOf(m.currentScheme)}</span>
                </div>
                {m.activeFamily && <p className="t-help">Suggested for {m.activeFamily} first.</p>}
                <div role="group" aria-label="Colour scheme" className="grid grid-cols-[repeat(6,40px)] gap-2">
                    {schemesShown.map((id) => {
                        const label = schemeLabelOf(id);
                        return (
                            <button
                                key={id}
                                type="button"
                                aria-label={label}
                                title={label}
                                aria-pressed={m.currentScheme === id}
                                onClick={() => setThemeField("colorScheme", id)}
                                className="h-10 w-10 cursor-pointer rounded-r1 border border-r1-line-2 p-0 aria-pressed:ring-2 aria-pressed:ring-r1-ink aria-pressed:ring-offset-2 aria-pressed:ring-offset-r1-paper"
                                style={{ background: SCHEME_SWATCH[id] ?? SCHEME_SWATCH.auto }}
                            />
                        );
                    })}
                </div>
                {schemeRest.length > 0 && (
                    <button type="button" className={linkBtn} aria-expanded={schemesAll} onClick={() => setSchemesAll((v) => !v)}>
                        {schemesAll ? "Show fewer" : `Show all ${COLOR_SCHEMES.length}`}
                    </button>
                )}
            </section>

            <Field label="Font pairing">
                <Select value={m.currentFont} onChange={(e) => setThemeField("fontPairing", e.target.value)}>
                    {/* A branded family's pick stamps "auto" (its own fonts).
                        Offered only while it is the value, so the list never
                        claims a pairing the page is not using. */}
                    {!fontKnown && <option value={m.currentFont}>Template default</option>}
                    {FONT_PAIRINGS.map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                </Select>
            </Field>

            <section className="flex flex-col gap-1" aria-label="Sections">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold leading-5 text-r1-ink">Sections</h2>
                    <span className="t-count">{sectionsOnCount} of {templateSections.length} shown</span>
                </div>
                <div className="flex flex-col">
                    {sectionsShown.map((sec) => {
                        const visKey = VIS_KEY_BY_BLOCK[sec.block];
                        const on = m.isBlockEnabled(visKey);
                        // Essentials are not switchable (useEditorDraft refuses too).
                        const required = (BLOCK_TIER[sec.block] ?? "extra") === "essential";
                        const empty = blockHasContent(sec.block) === false;
                        return (
                            <div key={visKey} className="flex min-h-10 items-center justify-between gap-3 border-b border-r1-line-3" title={sec.blurb || undefined}>
                                <span className={cx("min-w-0 truncate text-sm", on ? "text-r1-ink" : "text-r1-ink-3")}>
                                    {sec.label}
                                    {empty && <span className="t-meta" title="Nothing to show here yet - the section will render empty or auto-hide."> · nothing yet</span>}
                                </span>
                                {required ? (
                                    <span className="flex-none text-xs text-r1-ink-3">Always on</span>
                                ) : (
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={on}
                                        aria-label={`Show the ${sec.label} section`}
                                        onClick={() => handleToggleBlock(visKey)}
                                        className="flex h-10 w-11 flex-none cursor-pointer items-center justify-end border-0 bg-transparent p-0"
                                    >
                                        <span className={cx("relative block h-5 w-[34px] rounded-full transition-colors", on ? "bg-r1-ink" : "bg-r1-line-2")}>
                                            <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-r1-paper transition-[left]", on ? "left-4" : "left-0.5")} />
                                        </span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
                {templateSections.length > SHORTLIST && (
                    <button type="button" className={cx(linkBtn, "mt-1.5")} aria-expanded={sectionsAll} onClick={() => setSectionsAll((v) => !v)}>
                        {sectionsAll ? "Show fewer" : `Show all ${templateSections.length}`}
                    </button>
                )}
            </section>
        </div>
    );

    const contentPanel = (
        <div className="flex flex-col gap-3">
            <p className="t-meta">
                The words on the site, section by section. Click any text in the preview to jump to it here; lists, links and images add, remove and reorder safely.
            </p>
            <ContentFieldsAuto getValue={contentGetValue} setValue={setContentValue} openImagePicker={(path) => setImagePickerField(path)} pushLiveText={pushLiveText} templateCode={String((m.effectiveCustomizations as EditorJson)?.heroStyle ?? "")} />
        </div>
    );

    const mediaPanel = (
        <div className="flex flex-col gap-4">
            <p className="t-meta">
                {effectivePhotos.length === 1 ? "1 photo." : `${effectivePhotos.length} photos.`} Click any image in the preview to choose which photo goes there.
            </p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f, pendingImageField); }} />
            <Button block disabled={uploadingPhoto} onClick={() => { setPendingImageField(null); fileInputRef.current?.click(); }}>
                <Icon icon={Upload} />
                {uploadingPhoto ? "Uploading…" : "Upload a photo"}
            </Button>
            {uploadError && <p className="t-error" role="alert">{uploadError}</p>}

            {effectivePhotos.length > 0 && (
                <div className="flex flex-col gap-2">
                    {/* Click-to-assign: with a slot pending, the grid becomes a
                        picker so an EXISTING photo can fill it with no re-upload.
                        v3 had no path to that at all. */}
                    {pendingImageField && (
                        <p className="flex items-center justify-between gap-2 text-[13px] leading-[18px] text-r1-ink-2" role="status">
                            <span>Pick a photo for <span className="t-mono">{pendingImageField}</span>.</span>
                            <button type="button" className={linkBtn} onClick={() => setPendingImageField(null)}>Cancel</button>
                        </p>
                    )}
                    <div className="grid grid-cols-3 gap-1.5">
                        {effectivePhotos.map((url, i) => {
                            const uploaded = !(photos ?? []).includes(url);
                            const thumb = (
                                // Photos come from storage and R2 on several hosts.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt={pendingImageField ? "" : `Photo ${i + 1}`} loading="lazy" className="block h-full w-full object-cover" />
                            );
                            return (
                                <div key={`${url}-${i}`} className="relative">
                                    {pendingImageField ? (
                                        <button
                                            type="button"
                                            onClick={() => { assignImageSlot(pendingImageField, url); setPendingImageField(null); }}
                                            aria-label={`Use photo ${i + 1} for ${pendingImageField}`}
                                            className="block h-[72px] w-full cursor-pointer overflow-hidden rounded-r1 border-0 bg-r1-fill p-0 outline-offset-1 hover:outline-2 hover:outline-r1-ink"
                                        >
                                            {thumb}
                                        </button>
                                    ) : (
                                        <span className="block h-[72px] overflow-hidden rounded-r1 bg-r1-fill">{thumb}</span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(i)}
                                        title="Remove this photo"
                                        aria-label={`Remove photo ${i + 1}`}
                                        className="absolute right-1 top-1 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 bg-r1-paper/90 p-0 text-r1-red shadow-r1-menu"
                                    >
                                        <Icon icon={X} size={14} />
                                    </button>
                                    {/* `uploaded` only means "this url is not one of the
                                        submission's ORIGINAL photos" — and saving persists
                                        the draft, not submissions.photos, so it stays true
                                        after a successful save. The upload half is a fact
                                        about the photo; the unsaved half is a fact about
                                        the DRAFT, so it tracks the real dirty state. */}
                                    {uploaded && (
                                        <span className="pointer-events-none absolute bottom-1 left-1 rounded-r1-sm bg-r1-ink/75 px-1 py-0.5 text-[10px] font-medium leading-3 text-r1-paper">
                                            {m.dirty ? "uploaded · unsaved" : "uploaded"}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Favicon: a wrong one ships to the customer's browser tab and to
                link unfurls, where astro-builder also uses it as the og:image
                fallback, so it shows what is set and can be cleared. */}
            <div className="flex items-center gap-3 rounded-r1 border border-r1-line p-2.5">
                {faviconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={faviconUrl} alt="" className="h-10 w-10 flex-none rounded-r1-sm border border-r1-line object-cover" />
                ) : (
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-r1-sm border border-dashed border-r1-line-2 text-[11px] text-r1-ink-3">none</span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium text-r1-ink">Favicon</span>
                    <span className="t-meta truncate">{faviconUrl || "Using the template default"}</span>
                </span>
                {faviconUrl && <Button variant="ghost" size="sm" onClick={clearFavicon}>Remove</Button>}
                <Button size="sm" disabled={uploadingPhoto} onClick={() => { setPendingImageField("favicon"); fileInputRef.current?.click(); }}>
                    {faviconUrl ? "Replace" : "Set"}
                </Button>
            </div>
        </div>
    );

    const paneTabs: TabItem<Pane>[] = [
        ...(isDesk ? [] : [{ value: "preview" as const, label: "Preview" }]),
        { value: "design", label: "Design" },
        { value: "content", label: "Content" },
        { value: "media", label: "Media" },
    ];
    const panelBody = activePane === "design" ? designPanel : activePane === "content" ? contentPanel : activePane === "media" ? mediaPanel : undefined;

    // ── The preview's address bar ─────────────────────────────────────────
    // Two addresses, never collapsed into one: after a Regenerate (which
    // rebuilds but never publishes) the published URL still serves the OLD
    // page, so the bar says where the public goes while the frame shows the
    // build on disk. The build itself opens from the page's More menu.
    let frameLabel: ReactNode;
    if (previewBuildHtml) frameLabel = `Unsaved preview · ${pickedTemplate ? pickedTemplate.label : "no template"}`;
    else if (websiteOffline) frameLabel = "Offline · visitors see a holding page";
    else if (websitePublishedUrl) {
        frameLabel = (
            <>
                Live at{" "}
                <a href={websitePublishedUrl} target="_blank" rel="noopener noreferrer" className="t-link" title="The page the public sees right now">
                    {hostOf(websitePublishedUrl)}
                </a>
            </>
        );
    } else frameLabel = `Preview · ${savedTemplate ? savedTemplate.label : "no template"} · not live yet`;

    const busyText = saving
        ? "Saving and rebuilding…"
        : previewing
            ? "Building a preview with your content…"
            : generatingWebsite
                ? "Rebuilding website…"
                : htmlLoading
                    ? "Loading the site…"
                    : null;

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {renderHeader?.(tools)}

            {/* Draft recovery: offered, never adopted on its own (see useEditorDraft). */}
            {m.hasCachedDraft && (
                <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-b border-r1-gold-line bg-r1-gold-bg px-4 py-2" role="status">
                    <span className="text-[13px] leading-[18px] text-r1-ink-2">There are unsaved edits from an earlier session in this browser.</span>
                    <span className="flex gap-2">
                        <Button size="sm" onClick={m.restoreCachedDraft}>Restore them</Button>
                        <Button size="sm" variant="ghost" onClick={m.dismissCachedDraft}>Dismiss</Button>
                    </span>
                </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <section
                    aria-label="Edit the site"
                    className={cx(
                        "flex min-h-0 flex-col bg-r1-paper",
                        activePane === "preview" ? "flex-none" : "flex-1",
                        "lg:w-80 lg:flex-none lg:border-r lg:border-r1-line",
                        fullWidth && "lg:hidden",
                    )}
                >
                    <Tabs
                        label="Editor panels"
                        tabs={paneTabs}
                        value={activePane}
                        onChange={setPane}
                        className={cx(
                            // The tab row's hairline stops short of the edges, as on the board.
                            "min-h-0 [&>[role=tablist]]:mx-4 [&>[role=tablist]]:flex-none lg:[&>[role=tablist]]:mx-5",
                            "[&>[role=tabpanel]]:min-h-0 [&>[role=tabpanel]]:flex-1 [&>[role=tabpanel]]:overflow-y-auto [&>[role=tabpanel]]:px-4 [&>[role=tabpanel]]:pb-6 [&>[role=tabpanel]]:pt-1 lg:[&>[role=tabpanel]]:px-5",
                            activePane === "preview" ? "flex-none" : "flex-1",
                        )}
                    >
                        {panelBody}
                    </Tabs>
                </section>

                <div className={cx("min-h-0 min-w-0 flex-1 flex-col", activePane === "preview" ? "flex" : "hidden lg:flex")}>
                    {/* The size switch sits in the page's header on a wide desk;
                        below that the header has no room for it, so it sits here. */}
                    <div className="flex flex-none justify-center bg-r1-fill-2 px-4 pt-3 xl:hidden">
                        <Segmented label="Preview size" options={PREVIEW_DEVICE_OPTIONS} value={device} onChange={setDevice} />
                    </div>
                    <WebsitePreview
                        className="flex-1"
                        device={device}
                        html={previewBuildHtml ? unsavedPreviewHtml : previewHtml}
                        iframeKey={previewBuildHtml ? "v3-preview" : "v3-saved"}
                        iframeRef={iframeRef}
                        onLoad={handleIframeLoad}
                        title={previewBuildHtml ? "Unsaved preview" : "Website preview"}
                        sandbox="allow-same-origin allow-scripts allow-popups"
                        label={frameLabel}
                        empty={websiteGenerated ? "This site has no page to show yet." : "No website generated yet."}
                        busy={busyText}
                        banner={previewBuildHtml ? (
                            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-r1-ink px-3 py-1.5 text-[13px] leading-[18px] text-r1-paper">
                                <span className="truncate">Previewing your unsaved changes with real content. Save to keep them.</span>
                                <button type="button" onClick={() => setPreviewBuildHtml(null)} className="flex-none cursor-pointer border-0 bg-transparent p-0 font-medium text-r1-gold-light">
                                    Back to saved
                                </button>
                            </div>
                        ) : undefined}
                        barActions={(
                            <>
                                {/* The tooltip says what a click does: recolour that
                                    kind of element in that section; the picker can
                                    widen it to every section and give buttons and
                                    links their own hover and pressed colours. */}
                                <Button
                                    variant="ghost"
                                    aria-pressed={colorMode}
                                    onClick={toggleColorMode}
                                    title="Click any button, heading or text to recolour its kind in that section"
                                    className="aria-pressed:bg-r1-fill-nav"
                                >
                                    {colorMode && <Icon icon={Check} />}
                                    Recolour
                                </Button>
                                <Button
                                    variant="ghost"
                                    aria-pressed={fullWidth}
                                    onClick={() => setFullWidth((v) => !v)}
                                    className="hidden lg:inline-flex"
                                >
                                    {fullWidth ? "Show panels" : "Full width"}
                                </Button>
                            </>
                        )}
                    />
                </div>

                {aside}
            </div>

            {colorMode && !colorPopover && (
                <div className="fixed bottom-6 left-1/2 z-40 w-max max-w-[calc(100vw_-_32px)] -translate-x-1/2 rounded-full bg-r1-ink px-4 py-2 text-center text-[13px] font-medium leading-[18px] text-r1-paper shadow-r1-menu" role="status">
                    Recolour: click a button, heading or text to recolour its kind in that section
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
                const storedMap = (((m.effectiveCustomizations as EditorJson)?.roleColors) ?? {}) as Record<string, string>;
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
                return (
                    // Not modal on purpose: with the popover open the admin can
                    // keep clicking elements in the preview, and each click
                    // re-targets it.
                    <div
                        role="dialog"
                        aria-label={`Recolour ${def.label}`}
                        className="r1 fixed bottom-6 left-1/2 z-40 flex w-[min(420px,calc(100vw_-_32px))] -translate-x-1/2 flex-col gap-3 rounded-[10px] border border-r1-line bg-r1-paper p-4 shadow-r1-dialog"
                    >
                        {/* Three segmented controls side by side is one row nobody
                            reads, so the popover is a COLUMN: what is changing, then
                            the two "which pixels" axes, then the state axis on a row
                            of its own (it is three segments wide and each carries a
                            swatch), then the colour itself. */}
                        <div className="flex items-start gap-3">
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="t-label">Recolour</span>
                                <span className="t-h2 truncate">{def.label}</span>
                                {/* Never just "Primary buttons": the same role lives in
                                    the hero and the closing band, so the name of the
                                    role alone cannot say which one is about to change. */}
                                <span className="t-meta">in {where}</span>
                            </div>
                            <Button variant="ghost" size="sm" icon aria-label="Close" className="ml-auto" onClick={() => setColorPopover(null)}>
                                <Icon icon={X} />
                            </Button>
                        </div>
                        {(def.props.length > 1 || !!colorPopover.section) && (
                            <div className="flex flex-wrap items-center gap-2">
                                {def.props.length > 1 && (
                                    <div role="group" aria-label="Which part of the element this colour applies to" className="t-seg">
                                        {def.props.map((p) => (
                                            <button key={p} type="button" aria-pressed={prop === p} onClick={() => setColorPopover((c) => (c ? { ...c, prop: p } : c))}>
                                                {p === "bg" ? "Fill" : "Text"}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {/* Offered only when the click could be placed in a section
                                    — with none, every-section is not a choice, it is the
                                    only key there is. */}
                                {colorPopover.section && (
                                    <div role="group" aria-label="Which sections this colour applies to" className="t-seg">
                                        <button type="button" aria-pressed={!colorPopover.scopeAll}
                                            onClick={() => setColorPopover((c) => (c ? { ...c, scopeAll: false } : c))}
                                            title={colorPopover.sectionMatches === 0
                                                ? `Nothing in ${sectionName(colorPopover.section)} uses this colour`
                                                : `Only in ${sectionName(colorPopover.section)}`}>
                                            This section
                                        </button>
                                        <button type="button" aria-pressed={colorPopover.scopeAll}
                                            onClick={() => setColorPopover((c) => (c ? { ...c, scopeAll: true } : c))}
                                            title={`${def.label} everywhere on the page`}>
                                            Every section
                                        </button>
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
                            <div className="flex flex-col gap-1.5">
                                <span className="t-label">State</span>
                                <div role="group" aria-label="Which pointer state this colour applies to" className="t-seg self-start">
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
                                                className="inline-flex items-center gap-1.5">
                                                <span
                                                    aria-hidden="true"
                                                    className={cx("inline-block h-2.5 w-2.5 flex-none rounded-full", stColor ? "border border-r1-line-2" : "border border-dashed border-r1-ink-4")}
                                                    style={stColor ? { background: stColor } : undefined}
                                                />
                                                {COLOR_STATE_LABELS[st]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-2.5">
                            <input type="color" value={value} onChange={(e) => applyRoleColor(colorPopover.role, prop, e.target.value, scoped, state)}
                                className="h-9 w-11 flex-none cursor-pointer rounded-r1 border border-r1-line bg-r1-paper p-0.5"
                                aria-label={`${def.label} ${propLabel} colour${hasStates ? `, ${COLOR_STATE_LABELS[state].toLowerCase()} state` : ""}, in ${where}`} />
                            <span className={cx("t-mono", existing ? "text-r1-ink" : "text-r1-ink-3")}>
                                {existing ? existing.toUpperCase() : "Not set"}
                            </span>
                            {existing && (
                                <button type="button" onClick={() => applyRoleColor(colorPopover.role, prop, null, scoped, state)}
                                    title={`Remove the ${hasStates ? `${COLOR_STATE_LABELS[state].toLowerCase()} ` : ""}${propLabel} colour for ${def.label} in ${where}`}
                                    className={cx(linkBtn, "ml-auto self-center")}>
                                    Reset
                                </button>
                            )}
                        </div>
                        {note && (
                            <p role="status" className="flex items-start gap-2 text-[13px] leading-[18px] text-r1-gold-ink">
                                <Dot tone="attn" className="mt-[5px]" />
                                {note}
                            </p>
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
                enhanced={(enhancedImageUrls ?? []) as unknown as Record<string, EditorJson>}
                onClose={() => setImagePickerField(null)}
                onSelect={handleImagePick}
            />
            <LinkPopover open={!!linkData} initial={linkData} onClose={() => setLinkData(null)} onSave={handleLinkSave} />
        </div>
    );
}
