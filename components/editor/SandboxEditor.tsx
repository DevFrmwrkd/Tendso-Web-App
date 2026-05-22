"use client";

/**
 * SandboxEditor — admin submission page editor, 1:1 port of the v01
 * sandbox.html design (Landing Pages v01/sandbox.html), wired into
 * the Negosyo Digital data model.
 *
 * Live edit roundtrip:
 *   iframe → parent : { type: 'ed:click', field } (click-to-focus input)
 *   parent → iframe : { type: 'ed:update', field, value } (typing updates preview)
 *
 * Styles live in SandboxEditor.module.css.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Loader2,
    Monitor,
    Smartphone,
    Send,
    Sparkles,
    RefreshCw,
    Upload,
    EyeOff,
    Trash2,
    PanelRight,
    Globe,
    Lock,
    Plus,
    Image as ImageIcon,
    ChevronDown,
    ArrowUp,
    ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { injectEditorBridge } from "./editorBridge";
import {
    StylePreviewBadge,
    STYLE_METADATA,
    CATEGORY_STYLES,
    SECTION_LABELS,
    SECTION_FIELD_MAP,
    VariantPreview,
    type SectionId,
} from "../ContentEditor";
import s from "./SandboxEditor.module.css";

// ── BUCKETS · pick-one categories ────────────────────────────────────
const TEMPLATE_BUCKETS = [
    { id: "barber",     label: "Barber",     business: "Barber Shop",       desc: "Vintage masculine · heritage",    variantPrefix: "K" },
    { id: "salon",      label: "Beauty",     business: "Salon / Spa",       desc: "Luxe ethereal · soft & feminine", variantPrefix: "M" },
    { id: "auto",       label: "Automotive", business: "Auto Shop",         desc: "Industrial · technical · rugged", variantPrefix: "L" },
    { id: "restaurant", label: "Food",       business: "Restaurant / Café", desc: "Warm · appetizing · hospitable",  variantPrefix: "N" },
    { id: "clinic",     label: "Medical",    business: "Clinic / Dental",   desc: "Clean · trustworthy · professional", variantPrefix: "O" },
    { id: "retail",     label: "Retail",     business: "Retail Store",      desc: "Blueprint · clear · catalog",     variantPrefix: "" },
    { id: "fitness",    label: "Fitness",    business: "Gym / Studio",      desc: "Kinetic · bold · confident",      variantPrefix: "" },
    { id: "education",  label: "Education",  business: "School / Workshop", desc: "Warm · inviting · academic",      variantPrefix: "" },
    { id: "services",   label: "Services",   business: "Trades / Services", desc: "Service area · utility · clear",  variantPrefix: "" },
] as const;

// Variant counts per category-letter (matches astro-site-template/src/components/{heroes,about,services,gallery,contact}/).
// Hero has an extra M6 variant — the editorial NEO Labs salon hero we added.
const GENERIC_VARIANTS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
function variantsFor(section: "hero" | "about" | "services" | "gallery" | "contact", categoryLetter: string): string[] {
    const base = {
        K: ["K1", "K2", "K3", "K4", "K5"],
        L: ["L1", "L2", "L3", "L4", "L5"],
        M: ["M1", "M2", "M3", "M4", "M5"],
        N: ["N1", "N2", "N3", "N4", "N5"],
        O: ["O1", "O2", "O3", "O4", "O5"],
    } as Record<string, string[]>;
    let cat: string[] = base[categoryLetter] ?? [];
    if (section === "hero" && categoryLetter === "M") cat = [...cat, "M6"];
    return [...cat, ...GENERIC_VARIANTS];
}

// Friendly variant labels — short descriptive name per letter. Only A-J have
// distinct labels; numbered (K1, M6, …) are kept as-is in the dropdown since
// they're category-specific designs with no shared metadata.
const VARIANT_LABELS: Record<string, string> = {
    A: "Split Modern",
    B: "Fullscreen",
    C: "Carousel",
    D: "Agency Dark",
    E: "Visual Narrative",
    F: "Luxury Elegant",
    G: "First Class",
    H: "Nexus Forge",
    I: "Meridian Strategy",
    J: "Atelier Creative",
    M6: "Editorial (NEO Labs)",
};
const SECTION_KEYS: Array<{
    key: "hero" | "about" | "services" | "gallery" | "contact";
    label: string;
    custKey: keyof Pick<any, "heroStyle" | "aboutStyle" | "servicesStyle" | "galleryStyle" | "contactStyle">;
}> = [
    { key: "hero",     label: "Hero",     custKey: "heroStyle" },
    { key: "about",    label: "About",    custKey: "aboutStyle" },
    { key: "services", label: "Services", custKey: "servicesStyle" },
    { key: "gallery",  label: "Gallery",  custKey: "galleryStyle" },
    { key: "contact",  label: "Contact",  custKey: "contactStyle" },
];

// ── 15 v01 BLOCKS ─────────────────────────────────────────────────────
const ALL_BLOCKS: Array<{ name: string; tag: "required" | "recommended"; visKey: string }> = [
    { name: "HERO",             tag: "required",    visKey: "hero_section" },
    { name: "TRUST",            tag: "recommended", visKey: "trust_block" },
    { name: "ABOUT",            tag: "recommended", visKey: "about_section" },
    { name: "SERVICES",         tag: "required",    visKey: "services_section" },
    { name: "WHY-US",           tag: "recommended", visKey: "why_us_block" },
    { name: "HOW-IT-WORKS",     tag: "recommended", visKey: "how_it_works_block" },
    { name: "TESTIMONIALS",     tag: "recommended", visKey: "testimonials_block" },
    { name: "GALLERY",          tag: "recommended", visKey: "featured_section" },
    { name: "FAQ",              tag: "recommended", visKey: "faq_block" },
    { name: "SERVICE-AREA",     tag: "recommended", visKey: "service_area_block" },
    { name: "CREDENTIALS",      tag: "recommended", visKey: "credentials_block" },
    { name: "LOCATION",         tag: "required",    visKey: "location_block" },
    { name: "CTA-BAND",         tag: "recommended", visKey: "cta_band_block" },
    { name: "CLICK-TO-MESSAGE", tag: "recommended", visKey: "click_to_message" },
    { name: "FOOTER",           tag: "required",    visKey: "footer_section" },
    { name: "SCROLL-TO-TOP",    tag: "recommended", visKey: "scroll_top_button" },
];

// ── COLOR SCHEMES + FONT PAIRINGS (mirrors ContentEditor.tsx) ─────────
const COLOR_SCHEMES = [
    { id: "auto",      label: "Auto (from photos)" },
    { id: "blue",      label: "Blue · Professional" },
    { id: "green",     label: "Green · Fresh" },
    { id: "purple",    label: "Purple · Creative" },
    { id: "orange",    label: "Orange · Energetic" },
    { id: "dark",      label: "Dark · Elegant" },
    { id: "pink",      label: "Pink · Vibrant" },
    { id: "brown",     label: "Brown · Natural" },
    { id: "red",       label: "Red · Intense" },
    { id: "yellow",    label: "Yellow · Bright" },
    { id: "maroon",    label: "Maroon · Rich" },
    { id: "black",     label: "Black · Monochrome" },
    { id: "gold",      label: "Gold · Premium (cream)" },
    { id: "whitegold", label: "White & Gold · Luxe" },
];
const FONT_PAIRINGS = [
    { id: "modern",       label: "Modern (Default)" },
    { id: "classic",      label: "Classic Serif" },
    { id: "elegant",      label: "Elegant Display" },
    { id: "bold",         label: "Bold & Loud" },
    { id: "minimal",      label: "Minimal Sans" },
    { id: "professional", label: "Professional Sans" },
    { id: "creative",     label: "Creative Bold" },
    { id: "tech",         label: "Tech Mono" },
    { id: "friendly",     label: "Friendly Rounded" },
    { id: "luxury",       label: "Luxury Serif" },
    { id: "gourmet",      label: "Gourmet Elegant" },
];

// ── Bridge field mapping ──────────────────────────────────────────────
// State path → data-field selector on the iframe. The bridge updates any
// element with [data-field="<bridgeField>"] when we postMessage ed:update.
const STATE_TO_BRIDGE: Record<string, string> = {
    business_name: "business.name",
    tagline: "hero.headline",
    about: "hero.description",
    hero_badge_text: "hero.badge_text",
    hero_testimonial: "hero.testimonial",
    about_headline: "about.headline",
    about_description: "about.description",
    services_headline: "services.headline",
    services_subheadline: "services.subheadline",
    "contact.phone": "contact.phone",
    "contact.email": "contact.email",
    "contact.address": "contact.address",
};

type SandboxTab = "template" | "content" | "images" | "blocks" | "theme";

export interface SandboxEditorProps {
    submissionId: string;
    businessName: string;
    businessType?: string;
    htmlContent: string;
    content: any;
    customizations: any;
    photos: string[];

    onSaveContent: (content: any, customizationsOverride?: any) => Promise<void>;
    onUpdateDesign: (customizations: any) => Promise<void>;

    websitePublishedUrl?: string;
    websiteGenerated: boolean;
    generatingWebsite: boolean;
    publishingWebsite: boolean;
    republishingWebsite: boolean;
    unpublishingWebsite: boolean;
    enhancing: boolean;
    sendingEmail: boolean;

    onSendToClient: () => void;
    onEnhanceImages: () => void;
    onRegenerate: () => void;
    onPublish: () => void;
    onRepublish: () => void;
    onUnpublish: () => void;
    onDelete: () => void;

    onToggleDetails?: () => void;
    detailsOpen?: boolean;
}

export default function SandboxEditor(props: SandboxEditorProps) {
    const {
        submissionId,
        businessName,
        businessType,
        htmlContent,
        content,
        customizations,
        photos,
        onSaveContent,
        onUpdateDesign,
        websitePublishedUrl,
        websiteGenerated,
        publishingWebsite,
        republishingWebsite,
        unpublishingWebsite,
        enhancing,
        sendingEmail,
        onSendToClient,
        onEnhanceImages,
        onRegenerate,
        onPublish,
        onRepublish,
        onUnpublish,
        onDelete,
        onToggleDetails,
        detailsOpen,
    } = props;

    const [tab, setTab] = useState<SandboxTab>("content");
    const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    // Tracks which image slot (data-field) the admin clicked in the iframe
    // so the next upload REPLACES that specific image instead of appending.
    // Cleared after the upload (or when admin manually clicks Add image).
    const [pendingImageField, setPendingImageField] = useState<string | null>(null);

    // Collapsible section accordions (Template tab variant picker).
    // Hero is open by default so admin sees a starting point; the rest
    // collapse to keep the panel short — click to expand.
    const [expandedAccordions, setExpandedAccordions] = useState<Set<string>>(
        () => new Set(["hero"]),
    );
    const toggleAccordion = (key: string) => {
        setExpandedAccordions((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Scroll-to-top — track panelBody scroll position so we can pop a
    // floating button when the admin is scrolled past the fold.
    const panelBodyRef = useRef<HTMLDivElement | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    useEffect(() => {
        const el = panelBodyRef.current;
        if (!el) return;
        const onScroll = () => setShowScrollTop(el.scrollTop > 240);
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, [tab]);
    const scrollToTop = () => {
        panelBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };

    const [draft, setDraft] = useState<any>(content ?? {});
    useEffect(() => {
        setDraft(content ?? {});
    }, [content]);

    const [selectedBucket, setSelectedBucket] = useState<string>(() => {
        const initial = (businessType || draft?.business_type || "").toLowerCase();
        const match = TEMPLATE_BUCKETS.find(
            (b) => b.id === initial || b.label.toLowerCase() === initial,
        );
        return match?.id ?? "services";
    });

    // ── Iframe reference for live updates ─────────────────────────────
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const bridgeReady = useRef(false);

    // ── Live update: patch state AND push to iframe in one call ───────
    // The bridge protocol uses dot-notation field names. We map our
    // internal underscore_state_paths to those bridge names so a single
    // input change reflects in the iframe within a frame, with no rebuild.
    const liveUpdate = useCallback((statePath: string, value: any) => {
        setDraft((prev: any) => {
            const next = { ...(prev ?? {}) };
            const parts = statePath.split(".");
            let cur: any = next;
            for (let i = 0; i < parts.length - 1; i++) {
                const k = parts[i];
                cur[k] = { ...(cur[k] ?? {}) };
                cur = cur[k];
            }
            cur[parts[parts.length - 1]] = value;
            return next;
        });
        // Push to iframe so the preview reflects the change instantly.
        const bridgeField = STATE_TO_BRIDGE[statePath] ?? statePath;
        try {
            iframeRef.current?.contentWindow?.postMessage(
                { type: "ed:update", field: bridgeField, value },
                "*",
            );
        } catch {
            /* iframe sandboxed against same-origin will silently fail; that's OK */
        }
    }, []);

    const patch = liveUpdate; // backwards-compatible alias

    const eff = (path: string): string => {
        const parts = path.split(".");
        let cur: any = draft;
        for (const p of parts) {
            if (cur == null) return "";
            cur = cur[p];
        }
        return cur ?? "";
    };

    // ── BLOCKS ─────────────────────────────────────────────────────────
    const isBlockEnabled = (visKey: string): boolean => {
        const v = draft?.visibility ?? {};
        return v[visKey] !== false;
    };
    const toggleBlock = (visKey: string) => {
        const required = ALL_BLOCKS.find((b) => b.visKey === visKey)?.tag === "required";
        if (required) return;
        setDraft((prev: any) => ({
            ...(prev ?? {}),
            visibility: {
                ...(prev?.visibility ?? {}),
                [visKey]: prev?.visibility?.[visKey] === false,
            },
        }));
    };

    // ── Iframe live preview ───────────────────────────────────────────
    const previewHtml = useMemo(() => injectEditorBridge(htmlContent || ""), [htmlContent]);

    // Click-to-focus: iframe sends ed:click → either focus a text input
    // (Content tab) OR open the image picker for the clicked image slot
    // (Images tab). The two-RAF defer lets React mount whichever tab
    // before we query for the input/button to focus.
    useEffect(() => {
        function onMessage(e: MessageEvent) {
            if (!e?.data || typeof e.data !== "object") return;
            if (e.data.type === "ed:ready") {
                bridgeReady.current = true;
                return;
            }
            if (e.data.type === "ed:click" && typeof e.data.field === "string") {
                const field = e.data.field;

                // Heuristic: anything matching "*.image", "*.tile.*", or whose
                // name ends in /image|photo|tile|thumb/ is an image slot →
                // route to Images tab + remember which slot was clicked so the
                // upload replaces THAT image instead of appending a new one.
                const isImageField = /\.(image|photo|tile|thumb)(\.|$)|^hero\.image$|^about\.image$|^gallery\.tile\./.test(field);

                if (isImageField) {
                    setTab("images");
                    setPendingImageField(field);
                    // Don't auto-open file picker — admin may want to pick an
                    // existing photo from the list (one click on a photo card
                    // assigns it). Upload remains one click on the dropzone.
                    return;
                }

                setTab("content");
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const inputEl = document.querySelector(
                            `[data-field-input="${field}"]`,
                        ) as HTMLElement | null;
                        inputEl?.scrollIntoView({ block: "center", behavior: "smooth" });
                        (inputEl as any)?.focus?.();
                    });
                });
            }
        }
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, []);

    // ── Pending customizations (Template + Theme tabs) ────────────────
    // User selections are batched here — no regen on every click. They
    // get committed to the parent on Save changes (atomically with any
    // content draft) so the page regenerates ONCE with everything applied.
    const bucket = TEMPLATE_BUCKETS.find((b) => b.id === selectedBucket);
    const categoryLetter = bucket?.variantPrefix ?? "";

    const [pendingCustomizations, setPendingCustomizations] = useState<any>(customizations);
    useEffect(() => {
        setPendingCustomizations(customizations);
    }, [customizations]);

    const effectiveCustomizations = pendingCustomizations ?? customizations ?? {};

    function setVariant(custKey: string, value: string) {
        setPendingCustomizations((prev: any) => ({
            ...(prev ?? customizations ?? {}),
            [custKey]: value,
        }));
    }

    function setThemeField(field: "colorScheme" | "fontPairing", value: string) {
        setPendingCustomizations((prev: any) => ({
            ...(prev ?? customizations ?? {}),
            [field]: value,
            [`${field}Id`]: value,
        }));
    }

    const contentDirty = JSON.stringify(draft) !== JSON.stringify(content);
    const customizationsDirty =
        JSON.stringify(pendingCustomizations ?? null) !== JSON.stringify(customizations ?? null);
    const dirty = contentDirty || customizationsDirty;

    async function handleSave() {
        setSaving(true);
        // Sonner's loading toast that we promote to success/error when the
        // save actually completes. Lets admin see the regen is in flight
        // (Astro build can take 30-60s) and confirms when it lands.
        const toastId = toast.loading(
            customizationsDirty
                ? "Saving changes · regenerating site…"
                : "Saving content…",
            { duration: Infinity },
        );
        try {
            const toSave = { ...draft, business_type: selectedBucket };
            await onSaveContent(
                toSave,
                customizationsDirty ? pendingCustomizations : undefined,
            );
            toast.success("Changes saved", {
                id: toastId,
                description: customizationsDirty
                    ? "Theme + content applied. Refreshing preview."
                    : "Content updated. Refreshing preview.",
                duration: 4500,
            });
        } catch (err: any) {
            toast.error("Save failed", {
                id: toastId,
                description: err?.message ?? "Something went wrong. Try again.",
                duration: 7000,
            });
        } finally {
            setSaving(false);
        }
    }

    function handleReset() {
        setDraft(content ?? {});
        setPendingCustomizations(customizations);
    }

    // Merge generic A-J + category-specific (K1-K5, L1-L5, M1-M5, N1-N5,
    // O1-O5) variants per section. Hero gets an extra M6 (NEO Labs editorial).
    function variantsForSection(sectionId: SectionId): Array<{ key: string; label: string }> {
        const out: Array<{ key: string; label: string }> = [];
        const cat = CATEGORY_STYLES.find((c) => c.key === categoryLetter);
        if (cat) {
            for (const v of cat.sections[sectionId] ?? []) {
                out.push({ key: v.key, label: v.label });
            }
            if (sectionId === "hero" && categoryLetter === "M") {
                out.push({ key: "M6", label: "Editorial (NEO Labs)" });
            }
        }
        const generic = STYLE_METADATA[`${sectionId}Style`] ?? {};
        for (const [key, meta] of Object.entries(generic)) {
            out.push({ key, label: (meta as any).label ?? `Style ${key}` });
        }
        return out;
    }

    // ── Image upload (Images tab) ─────────────────────────────────────
    // Uses the existing /api/upload-image route which persists to R2 / cloud
    // storage and returns a public URL. Saved URLs flow into draft.images and
    // get committed to Convex via /api/save-content on Save changes.
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    /**
     * Apply an image URL to the draft. If `slot` is set, replace that
     * specific slot (hero.image → images[0], gallery.tile.N → featured_images[N], …).
     * If slot is null, append to the gallery.
     * Always also pushes ed:image to the iframe so the swap shows live.
     */
    function assignImageToSlot(url: string, slot: string | null) {
        setDraft((prev: any) => {
            const next = { ...(prev ?? {}) };
            const images = ((next.images as string[]) ?? []).slice();
            if (!slot) {
                next.images = [...images, url];
                return next;
            }
            if (slot === "hero.image") {
                if (images.length === 0) images.push(url);
                else images[0] = url;
                next.images = images;
            } else if (slot === "about.image") {
                const about = ((next.about_images as string[]) ?? []).slice();
                if (about.length === 0) about.push(url);
                else about[0] = url;
                next.about_images = about;
            } else if (slot === "services.image") {
                next.services_image = url;
            } else if (slot.startsWith("services.list.") && slot.endsWith(".image")) {
                // services.list.N.image → write per-service image so the
                // card thumb persists independent of the rotating photos pool.
                const idx = parseInt(slot.split(".")[2] || "0", 10);
                const list = ((next.services as any[]) ?? []).slice();
                while (list.length <= idx) list.push({ name: "", description: "" });
                list[idx] = { ...(list[idx] || {}), image: url };
                next.services = list;
            } else if (slot.startsWith("gallery.tile.")) {
                const idx = parseInt(slot.split(".")[2] || "0", 10);
                const featured = ((next.featured_images as string[]) ?? []).slice();
                while (featured.length <= idx) featured.push("");
                featured[idx] = url;
                next.featured_images = featured;
            } else {
                next.images = [...images, url];
            }
            return next;
        });
        if (slot) {
            try {
                iframeRef.current?.contentWindow?.postMessage(
                    { type: "ed:image", field: slot, src: url },
                    "*",
                );
            } catch { /* sandboxed: ignore */ }
        }
    }
    async function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.type.startsWith("image/")) {
            setUploadError("Please choose an image file.");
            return;
        }
        if (f.size > 10 * 1024 * 1024) {
            setUploadError("Image must be under 10MB.");
            return;
        }
        setUploadError(null);
        setUploadingPhoto(true);
        try {
            const fd = new FormData();
            fd.append("file", f);
            fd.append("submissionId", submissionId);
            const res = await fetch("/api/upload-image", { method: "POST", body: fd });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody?.error || `Upload failed (HTTP ${res.status})`);
            }
            const data = await res.json();
            const url: string | undefined = data?.url;
            if (!url) throw new Error("Upload succeeded but no URL returned");
            assignImageToSlot(url, pendingImageField);
            setPendingImageField(null);
        } catch (err: any) {
            setUploadError(err?.message ?? "Image upload failed");
        } finally {
            setUploadingPhoto(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    function removePhoto(index: number) {
        setDraft((prev: any) => ({
            ...(prev ?? {}),
            images: ((prev?.images as string[]) ?? []).filter((_, i) => i !== index),
        }));
    }

    // Effective photo list = draft.images (if admin uploaded any) else submission photos
    const effectivePhotos: string[] =
        (draft?.images && draft.images.length > 0 ? draft.images : photos) ?? [];

    // ── Trust block helpers (Content tab) ─────────────────────────────
    const trust = draft?.trust ?? {};
    const updateTrust = (field: string, value: any) => {
        setDraft((prev: any) => ({
            ...(prev ?? {}),
            trust: { ...(prev?.trust ?? {}), [field]: value },
        }));
    };
    const trustLicenses = (trust.licenses ?? []) as string[];
    const trustMemberships = (trust.memberships ?? []) as string[];

    const cx = (...classes: (string | false | null | undefined)[]) =>
        classes.filter(Boolean).join(" ");

    return (
        <div className={s.app}>
            {/* ─── LEFT PANEL ─────────────────────────────────────── */}
            <aside className={s.panel}>
                <div className={s.panelHead}>
                    <div className={s.brand}>SANDBOX · BUILDER</div>
                    <h1 className={s.h1}>{businessName || "Local-business landing page"}</h1>
                    <div className={s.sub}>Edit, swap, toggle, deploy.</div>
                </div>

                <div className={s.tabs}>
                    {(["template", "content", "images", "blocks", "theme"] as const).map((k) => (
                        <button
                            key={k}
                            type="button"
                            className={cx(s.tab, tab === k && s.tabActive)}
                            onClick={() => setTab(k)}
                        >
                            {k}
                        </button>
                    ))}
                </div>

                <div className={s.panelInner}>
                <div ref={panelBodyRef} className={cx(s.panelBody, s.scrollable)}>
                    {/* ── TEMPLATE ─────────────────────────────── */}
                    {/* Recycled 1:1 from ContentEditor's category picker —
                        same light card pattern (emoji + label + ACTIVE pill +
                        palette dots + chevron), same VariantPreview schematics.
                        Cards float as light "paper islands" inside the dark
                        sandbox panel for an editorial sidebar feel.

                        Pending selections accumulate in pendingCustomizations
                        and only commit on Save changes. */}
                    {tab === "template" && (
                        <div className="space-y-3">
                            {customizationsDirty && (
                                <div className={s.pendingBanner}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sx-accent)" }} />
                                    Pending · click Save changes to apply
                                </div>
                            )}

                            {CATEGORY_STYLES.map((cat) => {
                                const sectionKey = `cat-${cat.key}`;
                                const isExpanded = expandedAccordions.has(sectionKey);
                                const currentHero = (effectiveCustomizations as any)?.heroStyle ?? "";
                                const isActiveCat = currentHero.startsWith(cat.key);
                                return (
                                    <div
                                        key={cat.key}
                                        className="rounded-lg overflow-hidden transition-colors"
                                        style={{
                                            background: "var(--sx-panel-2)",
                                            border: isActiveCat
                                                ? "1px solid var(--sx-accent)"
                                                : "1px solid var(--sx-rule)",
                                        }}
                                    >
                                        {/* Category header — dark sandbox theme */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                toggleAccordion(sectionKey);
                                                const bucketMatch = TEMPLATE_BUCKETS.find(
                                                    (b) => b.variantPrefix === cat.key,
                                                );
                                                if (bucketMatch) setSelectedBucket(bucketMatch.id);
                                            }}
                                            className="w-full flex items-center gap-3 p-3 text-left transition-colors"
                                            style={{
                                                background: isActiveCat
                                                    ? "rgba(16, 185, 129, 0.08)"
                                                    : "transparent",
                                                color: "var(--sx-ink)",
                                                fontFamily: "var(--sx-sans)",
                                            }}
                                        >
                                            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{cat.emoji}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <span style={{ fontWeight: 600, color: "var(--sx-ink)" }}>{cat.label}</span>
                                                    {isActiveCat && (
                                                        <span
                                                            style={{
                                                                fontSize: 9,
                                                                fontWeight: 700,
                                                                textTransform: "uppercase",
                                                                letterSpacing: "0.1em",
                                                                color: "var(--sx-accent)",
                                                                background: "rgba(16, 185, 129, 0.18)",
                                                                borderRadius: 999,
                                                                padding: "2px 7px",
                                                                fontFamily: "var(--sx-mono)",
                                                            }}
                                                        >
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                                <p
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--sx-ink-soft)",
                                                        margin: "2px 0 0",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {cat.tagline}
                                                </p>
                                            </div>
                                            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                                <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: cat.palette.bg }} />
                                                <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: cat.palette.primary }} />
                                                <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: cat.palette.accent }} />
                                                <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", backgroundColor: cat.palette.text }} />
                                            </div>
                                            <ChevronDown
                                                style={{
                                                    width: 14,
                                                    height: 14,
                                                    color: isExpanded ? "var(--sx-accent)" : "var(--sx-ink-mute)",
                                                    flexShrink: 0,
                                                    transition: "transform 0.18s",
                                                    transform: isExpanded ? "rotate(180deg)" : "none",
                                                }}
                                            />
                                        </button>

                                        {/* Expanded — section sub-accordions, dark theme */}
                                        {isExpanded && (
                                            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--sx-rule)" }}>
                                                {(Object.keys(cat.sections) as SectionId[]).map((sectionId) => {
                                                    const variants = cat.sections[sectionId];
                                                    if (!variants) return null;
                                                    const fieldKey = SECTION_FIELD_MAP[sectionId];
                                                    const currentValue =
                                                        (effectiveCustomizations as any)?.[fieldKey];
                                                    const sectionMeta = SECTION_LABELS[sectionId];
                                                    const subKey = `${sectionKey}-${sectionId}`;
                                                    const isSubOpen =
                                                        expandedAccordions.has(subKey) ||
                                                        (sectionId === "hero" && isExpanded &&
                                                            !expandedAccordions.has(`${subKey}-closed`));
                                                    const toggleSub = () => {
                                                        if (sectionId === "hero" && isSubOpen) {
                                                            setExpandedAccordions((prev) => {
                                                                const next = new Set(prev);
                                                                next.add(`${subKey}-closed`);
                                                                next.delete(subKey);
                                                                return next;
                                                            });
                                                        } else if (sectionId === "hero" && !isSubOpen) {
                                                            setExpandedAccordions((prev) => {
                                                                const next = new Set(prev);
                                                                next.delete(`${subKey}-closed`);
                                                                next.add(subKey);
                                                                return next;
                                                            });
                                                        } else {
                                                            toggleAccordion(subKey);
                                                        }
                                                    };
                                                    return (
                                                        <div
                                                            key={sectionId}
                                                            style={{
                                                                background: "var(--sx-panel)",
                                                                border: "1px solid var(--sx-rule)",
                                                                borderRadius: 8,
                                                                overflow: "hidden",
                                                            }}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={toggleSub}
                                                                style={{
                                                                    width: "100%",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "space-between",
                                                                    padding: "10px 12px",
                                                                    background: "transparent",
                                                                    border: 0,
                                                                    color: "var(--sx-ink)",
                                                                    cursor: "pointer",
                                                                    fontFamily: "var(--sx-sans)",
                                                                }}
                                                            >
                                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 0 }}>
                                                                    <span
                                                                        style={{
                                                                            fontSize: 11,
                                                                            fontWeight: 700,
                                                                            color: "var(--sx-accent)",
                                                                            textTransform: "uppercase",
                                                                            letterSpacing: "0.16em",
                                                                            fontFamily: "var(--sx-mono)",
                                                                        }}
                                                                    >
                                                                        {sectionMeta.label}
                                                                    </span>
                                                                    <span
                                                                        style={{
                                                                            fontSize: 9,
                                                                            fontWeight: 600,
                                                                            color: "var(--sx-ink-mute)",
                                                                            textTransform: "uppercase",
                                                                            letterSpacing: "0.12em",
                                                                            fontFamily: "var(--sx-mono)",
                                                                        }}
                                                                    >
                                                                        {sectionMeta.sub}
                                                                    </span>
                                                                </div>
                                                                <ChevronDown
                                                                    style={{
                                                                        width: 13,
                                                                        height: 13,
                                                                        color: isSubOpen ? "var(--sx-accent)" : "var(--sx-ink-mute)",
                                                                        transition: "transform 0.18s",
                                                                        transform: isSubOpen ? "rotate(180deg)" : "none",
                                                                    }}
                                                                />
                                                            </button>

                                                            {isSubOpen && (
                                                                <div style={{ padding: 12, borderTop: "1px solid var(--sx-rule)" }}>
                                                                    <div className="grid grid-cols-2 gap-2.5">
                                                                        {variants.map((v) => {
                                                                            const isSelected = currentValue === v.key;
                                                                            const isAvailable = v.status === "available";
                                                                            return (
                                                                                <button
                                                                                    key={v.key}
                                                                                    type="button"
                                                                                    disabled={!isAvailable}
                                                                                    onClick={() =>
                                                                                        isAvailable &&
                                                                                        setVariant(
                                                                                            fieldKey as string,
                                                                                            v.key,
                                                                                        )
                                                                                    }
                                                                                    style={{
                                                                                        position: "relative",
                                                                                        display: "flex",
                                                                                        flexDirection: "column",
                                                                                        padding: 8,
                                                                                        borderRadius: 12,
                                                                                        background: isSelected
                                                                                            ? "rgba(16, 185, 129, 0.08)"
                                                                                            : "var(--sx-panel-2)",
                                                                                        border: isSelected
                                                                                            ? "1px solid var(--sx-accent)"
                                                                                            : "1px solid var(--sx-rule)",
                                                                                        cursor: isAvailable ? "pointer" : "not-allowed",
                                                                                        opacity: isAvailable ? 1 : 0.5,
                                                                                        textAlign: "left",
                                                                                        transition: "0.15s",
                                                                                        fontFamily: "var(--sx-sans)",
                                                                                    }}
                                                                                >
                                                                                    {/* Schematic preview — kept light on purpose
                                                                                        so the VariantPreview's white-fill schematics
                                                                                        stay legible against the dark card. */}
                                                                                    <div
                                                                                        style={{
                                                                                            width: "100%",
                                                                                            marginBottom: 6,
                                                                                            borderRadius: 8,
                                                                                            overflow: "hidden",
                                                                                            background: "#fff",
                                                                                            border: "1px solid rgba(255,255,255,0.06)",
                                                                                        }}
                                                                                    >
                                                                                        <VariantPreview
                                                                                            sectionId={sectionId}
                                                                                            variantKey={v.key}
                                                                                            palette={cat.palette}
                                                                                        />
                                                                                    </div>

                                                                                    <div style={{ flex: 1, minWidth: 0, padding: "0 2px" }}>
                                                                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                                                            <span
                                                                                                style={{
                                                                                                    fontSize: 10,
                                                                                                    fontWeight: 800,
                                                                                                    textTransform: "uppercase",
                                                                                                    letterSpacing: "-0.005em",
                                                                                                    color: isSelected
                                                                                                        ? "var(--sx-accent)"
                                                                                                        : "var(--sx-ink)",
                                                                                                    whiteSpace: "nowrap",
                                                                                                    overflow: "hidden",
                                                                                                    textOverflow: "ellipsis",
                                                                                                }}
                                                                                            >
                                                                                                {v.label}
                                                                                            </span>
                                                                                            {isSelected && (
                                                                                                <span
                                                                                                    style={{
                                                                                                        width: 12,
                                                                                                        height: 12,
                                                                                                        background: "var(--sx-accent)",
                                                                                                        borderRadius: "50%",
                                                                                                        display: "inline-flex",
                                                                                                        alignItems: "center",
                                                                                                        justifyContent: "center",
                                                                                                        color: "#052e1f",
                                                                                                        fontSize: 9,
                                                                                                        fontWeight: 700,
                                                                                                        flexShrink: 0,
                                                                                                    }}
                                                                                                >
                                                                                                    ✓
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div
                                                                                            style={{
                                                                                                fontSize: 9,
                                                                                                color: "var(--sx-ink-mute)",
                                                                                                fontWeight: 700,
                                                                                                marginTop: 2,
                                                                                                textTransform: "uppercase",
                                                                                                fontFamily: "var(--sx-mono)",
                                                                                                letterSpacing: "0.06em",
                                                                                            }}
                                                                                        >
                                                                                            Style {v.key}
                                                                                        </div>
                                                                                    </div>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── CONTENT ──────────────────────────────── */}
                    {tab === "content" && (
                        <>
                            <div className={s.section}>
                                <div className={s.sectionHead}>BUSINESS</div>
                                <div className={s.field}>
                                    <label>Name</label>
                                    <input
                                        type="text"
                                        data-field-input="business.name"
                                        value={eff("business_name")}
                                        onChange={(e) => liveUpdate("business_name", e.target.value)}
                                    />
                                </div>
                                <div className={s.row}>
                                    <div className={s.field}>
                                        <label>Phone</label>
                                        <input
                                            type="text"
                                            data-field-input="contact.phone"
                                            value={eff("contact.phone")}
                                            onChange={(e) => liveUpdate("contact.phone", e.target.value)}
                                        />
                                    </div>
                                    <div className={s.field}>
                                        <label>Email</label>
                                        <input
                                            type="text"
                                            data-field-input="contact.email"
                                            value={eff("contact.email")}
                                            onChange={(e) => liveUpdate("contact.email", e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className={s.field}>
                                    <label>Address</label>
                                    <input
                                        type="text"
                                        data-field-input="contact.address"
                                        value={eff("contact.address")}
                                        onChange={(e) => liveUpdate("contact.address", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className={s.section}>
                                <div className={s.sectionHead}>HERO</div>
                                <div className={s.field}>
                                    <label>Eyebrow / Badge</label>
                                    <input
                                        type="text"
                                        data-field-input="hero.badge_text"
                                        value={eff("hero_badge_text")}
                                        onChange={(e) => liveUpdate("hero_badge_text", e.target.value)}
                                    />
                                </div>
                                <div className={s.field}>
                                    <label>Headline (H1)</label>
                                    <textarea
                                        data-field-input="hero.headline"
                                        value={eff("tagline")}
                                        onChange={(e) => liveUpdate("tagline", e.target.value)}
                                    />
                                    <div className={s.hint}>
                                        A real, crafted headline. Avoid generic templates.
                                    </div>
                                </div>
                                <div className={s.field}>
                                    <label>Lede / Description</label>
                                    <textarea
                                        data-field-input="hero.description"
                                        value={eff("about")}
                                        onChange={(e) => liveUpdate("about", e.target.value)}
                                    />
                                </div>
                                <div className={s.field}>
                                    <label>Hero testimonial</label>
                                    <textarea
                                        data-field-input="hero.testimonial"
                                        value={eff("hero_testimonial")}
                                        onChange={(e) => liveUpdate("hero_testimonial", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className={s.section}>
                                <div className={s.sectionHead}>ABOUT</div>
                                <div className={s.field}>
                                    <label>About headline</label>
                                    <input
                                        type="text"
                                        data-field-input="about.headline"
                                        value={eff("about_headline")}
                                        onChange={(e) => liveUpdate("about_headline", e.target.value)}
                                    />
                                </div>
                                <div className={s.field}>
                                    <label>About description</label>
                                    <textarea
                                        data-field-input="about.description"
                                        value={eff("about_description")}
                                        onChange={(e) => liveUpdate("about_description", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className={s.section}>
                                <div className={s.sectionHead}>SERVICES</div>
                                <div className={s.field}>
                                    <label>Headline</label>
                                    <input
                                        type="text"
                                        data-field-input="services.headline"
                                        value={eff("services_headline")}
                                        onChange={(e) => liveUpdate("services_headline", e.target.value)}
                                    />
                                </div>
                                <div className={s.field}>
                                    <label>Subheadline</label>
                                    <textarea
                                        data-field-input="services.subheadline"
                                        value={eff("services_subheadline")}
                                        onChange={(e) => liveUpdate("services_subheadline", e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* TRUST block — properly designed editor card per
                                ConversionBlocks type in lib/services/groq.service.ts.
                                Three editable arrays: years line, licenses list,
                                memberships list. Each list item has an X to remove
                                and an empty trailing input that becomes a "+" line. */}
                            <div className={s.section}>
                                <div className={s.sectionHead}>TRUST · CREDIBILITY RIBBON</div>
                                <div className={s.hint} style={{ marginBottom: 12 }}>
                                    The trust ribbon under the hero. Years line + license claims
                                    + memberships. Keep each item short — &lt;5 words.
                                </div>

                                <div className={s.field}>
                                    <label>Years line</label>
                                    <input
                                        type="text"
                                        value={trust.years ?? ""}
                                        onChange={(e) => updateTrust("years", e.target.value)}
                                        placeholder="Serving Manila since 2018"
                                    />
                                </div>

                                <div className={s.field}>
                                    <label>Licenses</label>
                                    <ChipList
                                        items={trustLicenses}
                                        placeholder="Licensed barber · DOH-approved · …"
                                        onChange={(next) => updateTrust("licenses", next)}
                                    />
                                </div>

                                <div className={s.field}>
                                    <label>Memberships</label>
                                    <ChipList
                                        items={trustMemberships}
                                        placeholder="Chamber of Commerce member · …"
                                        onChange={(next) => updateTrust("memberships", next)}
                                    />
                                </div>
                            </div>

                            <div className={s.section}>
                                <div className={s.sectionHead}>CTA BAND</div>
                                <div className={s.field}>
                                    <label>CTA heading</label>
                                    <input
                                        type="text"
                                        value={eff("ctaBand.heading")}
                                        onChange={(e) => patch("ctaBand.heading", e.target.value)}
                                    />
                                </div>
                                <div className={s.field}>
                                    <label>CTA body</label>
                                    <textarea
                                        value={eff("ctaBand.body")}
                                        onChange={(e) => patch("ctaBand.body", e.target.value)}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── IMAGES ───────────────────────────────── */}
                    {tab === "images" && (
                        <div className={s.section}>
                            <div className={s.sectionHead}>IMAGES · {effectivePhotos.length} PHOTO{effectivePhotos.length === 1 ? "" : "S"}</div>

                            {pendingImageField && (
                                <div
                                    style={{
                                        padding: "10px 12px",
                                        marginBottom: 12,
                                        background: "rgba(16, 185, 129, 0.10)",
                                        border: "1px solid rgba(16, 185, 129, 0.4)",
                                        borderRadius: 6,
                                        color: "var(--sx-accent)",
                                        fontSize: 11,
                                        fontFamily: "var(--sx-mono)",
                                        letterSpacing: "0.06em",
                                        textTransform: "uppercase",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 8,
                                    }}
                                >
                                    <span>Replacing · {pendingImageField}</span>
                                    <button
                                        type="button"
                                        onClick={() => setPendingImageField(null)}
                                        style={{
                                            background: "transparent",
                                            border: 0,
                                            color: "var(--sx-accent)",
                                            cursor: "pointer",
                                            fontSize: 14,
                                            padding: 0,
                                            lineHeight: 1,
                                        }}
                                        title="Cancel slot replacement"
                                    >
                                        ×
                                    </button>
                                </div>
                            )}

                            <div className={s.hint} style={{ marginBottom: 12 }}>
                                Click any image in the preview to replace just that one,
                                or use the button below to add a new photo to the gallery.
                            </div>

                            {/* Big accent dropzone — click anywhere to upload. */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingPhoto}
                                style={{
                                    width: "100%",
                                    border: "1.5px dashed var(--sx-accent)",
                                    borderRadius: 12,
                                    padding: "22px 16px",
                                    marginBottom: 18,
                                    background: "rgba(16, 185, 129, 0.06)",
                                    color: "var(--sx-ink)",
                                    cursor: uploadingPhoto ? "wait" : "pointer",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 8,
                                    fontFamily: "var(--sx-sans)",
                                    transition: "background 0.18s, border-color 0.18s",
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(16, 185, 129, 0.12)";
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(16, 185, 129, 0.06)";
                                }}
                            >
                                {uploadingPhoto ? (
                                    <>
                                        <Loader2 style={{ width: 24, height: 24, color: "var(--sx-accent)" }} className="animate-spin" />
                                        <span style={{ fontSize: 13, fontWeight: 500 }}>Uploading…</span>
                                    </>
                                ) : (
                                    <>
                                        <div
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: "50%",
                                                background: "var(--sx-accent)",
                                                color: "#052e1f",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Plus style={{ width: 20, height: 20 }} strokeWidth={2.5} />
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>Click to upload an image</div>
                                        <div style={{ fontSize: 11, color: "var(--sx-ink-mute)", fontFamily: "var(--sx-mono)", letterSpacing: "0.06em" }}>
                                            JPG / PNG / WEBP · max 10MB
                                        </div>
                                    </>
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleAddPhoto}
                                style={{ display: "none" }}
                            />

                            {uploadError && (
                                <div
                                    style={{
                                        padding: "10px 12px",
                                        marginBottom: 12,
                                        background: "rgba(248, 113, 113, 0.08)",
                                        border: "1px solid rgba(248, 113, 113, 0.3)",
                                        borderRadius: 6,
                                        color: "#f87171",
                                        fontSize: 11,
                                        fontFamily: "var(--sx-mono)",
                                        letterSpacing: "0.04em",
                                    }}
                                >
                                    {uploadError}
                                </div>
                            )}

                            {effectivePhotos.length > 0 && (
                                <div
                                    className={s.hint}
                                    style={{
                                        marginBottom: 8,
                                        fontFamily: "var(--sx-mono)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.12em",
                                        fontSize: 10,
                                        color: "var(--sx-ink-mute)",
                                    }}
                                >
                                    {pendingImageField
                                        ? `Click a photo below to use it for ${pendingImageField}`
                                        : "Existing photos · click in the preview to swap one"}
                                </div>
                            )}
                            {effectivePhotos.length === 0 ? (
                                <div className={s.empty}>
                                    <ImageIcon style={{ width: 22, height: 22, opacity: 0.4, marginBottom: 6 }} />
                                    <div>No photos yet — drop one above to get started.</div>
                                </div>
                            ) : (
                                effectivePhotos.map((src, i) => {
                                    const assignable = !!pendingImageField;
                                    return (
                                        <div
                                            key={i}
                                            className={s.imageItem}
                                            style={
                                                assignable
                                                    ? {
                                                        cursor: "pointer",
                                                        borderColor: "var(--sx-accent)",
                                                        boxShadow: "0 0 0 1px var(--sx-accent) inset",
                                                    }
                                                    : undefined
                                            }
                                            role={assignable ? "button" : undefined}
                                            tabIndex={assignable ? 0 : undefined}
                                            onClick={
                                                assignable
                                                    ? () => {
                                                        assignImageToSlot(src, pendingImageField);
                                                        setPendingImageField(null);
                                                    }
                                                    : undefined
                                            }
                                            onKeyDown={
                                                assignable
                                                    ? (e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            assignImageToSlot(src, pendingImageField);
                                                            setPendingImageField(null);
                                                        }
                                                    }
                                                    : undefined
                                            }
                                            title={assignable ? `Use this photo for ${pendingImageField}` : undefined}
                                        >
                                            <div className={s.imageHead}>
                                                <div className={s.thumb}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={src} alt="" />
                                                </div>
                                                <div className={s.imageLabel}>
                                                    <div className={s.imageName}>
                                                        Photo {String(i + 1).padStart(2, "0")}
                                                        {assignable && (
                                                            <span
                                                                style={{
                                                                    marginLeft: 8,
                                                                    fontSize: 9,
                                                                    fontFamily: "var(--sx-mono)",
                                                                    color: "var(--sx-accent)",
                                                                    letterSpacing: "0.12em",
                                                                    textTransform: "uppercase",
                                                                }}
                                                            >
                                                                Click to use
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className={s.imageAlt}>
                                                        {src.startsWith("data:")
                                                            ? "(uploaded · pending save)"
                                                            : (src.length > 50 ? src.slice(0, 50) + "…" : src)}
                                                    </div>
                                                </div>
                                                {!assignable && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                                                        title="Remove photo"
                                                        style={{
                                                            background: "transparent",
                                                            border: 0,
                                                            color: "var(--sx-ink-mute)",
                                                            cursor: "pointer",
                                                            padding: 4,
                                                        }}
                                                    >
                                                        <Trash2 style={{ width: 14, height: 14 }} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* ── BLOCKS ───────────────────────────────── */}
                    {tab === "blocks" && (
                        <div className={s.section}>
                            <div className={s.sectionHead}>BLOCKS · TOGGLE OFF TO REMOVE</div>
                            <div className={s.hint} style={{ marginBottom: 16 }}>
                                Required blocks are locked. Toggle the rest off to drop them
                                from the published page.
                            </div>
                            {ALL_BLOCKS.map((b) => {
                                const isReq = b.tag === "required";
                                const enabled = isBlockEnabled(b.visKey);
                                return (
                                    <div
                                        key={b.name}
                                        className={cx(s.blockItem, isReq && s.blockLocked)}
                                    >
                                        <div className={s.blockLeft}>
                                            <div>
                                                <div className={s.blockName}>
                                                    {b.name}
                                                    <span className={cx(s.badge, isReq && s.badgeReq)}>
                                                        {isReq && (
                                                            <Lock
                                                                style={{
                                                                    width: 10,
                                                                    height: 10,
                                                                    marginRight: 3,
                                                                }}
                                                            />
                                                        )}
                                                        {b.tag}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <label className={cx(s.toggle, isReq && s.toggleLocked)}>
                                            <input
                                                type="checkbox"
                                                checked={enabled}
                                                disabled={isReq}
                                                onChange={() => toggleBlock(b.visKey)}
                                            />
                                            <span className={s.slider} />
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── THEME ────────────────────────────────── */}
                    {tab === "theme" && (
                        <div className={s.section}>
                            <div className={s.sectionHead}>THEME · COLOR + FONT</div>
                            <div className={s.hint} style={{ marginBottom: 16 }}>
                                Pick a curated color scheme + font pairing. Selections
                                batch with your Template + Content edits — they apply on
                                Save changes.
                            </div>
                            {customizationsDirty && (
                                <div className={s.pendingBanner}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sx-accent)" }} />
                                    Pending · click Save changes to apply
                                </div>
                            )}
                            <div className={s.field}>
                                <label>Color scheme</label>
                                <select
                                    value={
                                        (effectiveCustomizations as any)?.colorSchemeId ??
                                        (effectiveCustomizations as any)?.colorScheme ??
                                        "auto"
                                    }
                                    onChange={(e) => setThemeField("colorScheme", e.target.value)}
                                >
                                    {COLOR_SCHEMES.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={s.field}>
                                <label>Font pairing</label>
                                <select
                                    value={
                                        (effectiveCustomizations as any)?.fontPairingId ??
                                        (effectiveCustomizations as any)?.fontPairing ??
                                        "modern"
                                    }
                                    onChange={(e) => setThemeField("fontPairing", e.target.value)}
                                >
                                    {FONT_PAIRINGS.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Scroll-to-top button — appears when admin is scrolled past
                    the fold. Sticky to the bottom-right of the panel body. */}
                <button
                    type="button"
                    onClick={scrollToTop}
                    className={cx(s.scrollTopBtn, showScrollTop && s.scrollTopBtnVisible)}
                    aria-label="Scroll to top"
                    title="Scroll to top"
                >
                    <ArrowUp style={{ width: 16, height: 16 }} />
                </button>
                </div>

                <div className={s.saveBar}>
                    <button
                        type="button"
                        className={cx(s.btn, s.btnGhost)}
                        onClick={handleReset}
                        disabled={!dirty || saving}
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        className={s.btn}
                        onClick={handleSave}
                        disabled={!dirty || saving}
                    >
                        {saving ? (
                            <>
                                <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                                Saving…
                            </>
                        ) : (
                            <>↓ Save changes</>
                        )}
                    </button>
                </div>
            </aside>

            {/* ─── RIGHT PREVIEW ───────────────────────────────────── */}
            <section className={s.preview}>
                <div className={s.previewBar}>
                    <div className={s.previewInfo}>
                        <strong>{businessName || "Untitled"}</strong>
                        <span style={{ marginLeft: 12 }}>
                            · {TEMPLATE_BUCKETS.find((t) => t.id === selectedBucket)?.label ?? "Local"}
                            {customizations?.heroStyle ? ` · ${customizations.heroStyle}` : ""}
                        </span>
                    </div>
                    <div className={s.actions}>
                        <div className={s.vpToggle}>
                            <button
                                className={viewport === "desktop" ? s.vpToggleActive : ""}
                                onClick={() => setViewport("desktop")}
                            >
                                <Monitor style={{ width: 12, height: 12 }} /> Desktop
                            </button>
                            <button
                                className={viewport === "mobile" ? s.vpToggleActive : ""}
                                onClick={() => setViewport("mobile")}
                            >
                                <Smartphone style={{ width: 12, height: 12 }} /> Mobile
                            </button>
                        </div>

                        {websitePublishedUrl && (
                            <a
                                href={websitePublishedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cx(s.btn, s.btnGhost)}
                                title={websitePublishedUrl}
                            >
                                <Globe style={{ width: 12, height: 12 }} /> Live
                            </a>
                        )}

                        {/* View Site in new tab — full-window preview, always
                            available once a website is generated regardless of
                            publish state. Routes through /api/preview/<id>. */}
                        {websiteGenerated && (
                            <a
                                href={`/api/preview/${submissionId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cx(s.btn, s.btnGhost)}
                                title="Open full-page preview in new tab"
                            >
                                <ExternalLink style={{ width: 12, height: 12 }} />
                                View Site
                            </a>
                        )}

                        <button
                            type="button"
                            className={cx(s.btn, s.btnGhost)}
                            onClick={onEnhanceImages}
                            disabled={enhancing}
                            title="Enhance images via AI"
                        >
                            {enhancing ? (
                                <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                            ) : (
                                <Sparkles style={{ width: 12, height: 12 }} />
                            )}
                            Enhance
                        </button>

                        <button
                            type="button"
                            className={cx(s.btn, s.btnGhost)}
                            onClick={onRegenerate}
                            title="Regenerate from current content + customizations"
                        >
                            <RefreshCw style={{ width: 12, height: 12 }} />
                            Regen
                        </button>

                        {websiteGenerated && !websitePublishedUrl && (
                            <button
                                type="button"
                                className={s.btn}
                                onClick={onPublish}
                                disabled={publishingWebsite}
                            >
                                {publishingWebsite ? (
                                    <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                                ) : (
                                    <Upload style={{ width: 12, height: 12 }} />
                                )}
                                Publish
                            </button>
                        )}

                        {websitePublishedUrl && (
                            <button
                                type="button"
                                className={s.btn}
                                onClick={onRepublish}
                                disabled={republishingWebsite}
                            >
                                {republishingWebsite ? (
                                    <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                                ) : (
                                    <Upload style={{ width: 12, height: 12 }} />
                                )}
                                Republish
                            </button>
                        )}

                        {websitePublishedUrl && (
                            <button
                                type="button"
                                className={cx(s.btn, s.btnGhost)}
                                onClick={onUnpublish}
                                disabled={unpublishingWebsite}
                            >
                                {unpublishingWebsite ? (
                                    <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                                ) : (
                                    <EyeOff style={{ width: 12, height: 12 }} />
                                )}
                                Unpublish
                            </button>
                        )}

                        <button
                            type="button"
                            className={cx(s.btn, s.btnAccent)}
                            onClick={onSendToClient}
                            disabled={sendingEmail}
                        >
                            {sendingEmail ? (
                                <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                            ) : (
                                <Send style={{ width: 12, height: 12 }} />
                            )}
                            Send to client
                        </button>

                        {onToggleDetails && (
                            <button
                                type="button"
                                className={cx(s.btn, s.btnGhost)}
                                onClick={onToggleDetails}
                                title={detailsOpen ? "Hide details" : "Details"}
                            >
                                <PanelRight style={{ width: 12, height: 12 }} />
                                {detailsOpen ? "Hide" : "Details"}
                            </button>
                        )}

                        <button
                            type="button"
                            className={cx(s.btn, s.btnDanger)}
                            onClick={onDelete}
                            title="Delete submission"
                        >
                            <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                    </div>
                </div>

                <div className={cx(s.stage, s.scrollable)} style={{ position: "relative" }}>
                    <div
                        className={cx(
                            s.frameWrap,
                            viewport === "desktop" ? s.frameWrapDesktop : s.frameWrapMobile,
                        )}
                    >
                        {previewHtml ? (
                            <iframe
                                ref={iframeRef}
                                srcDoc={previewHtml}
                                title="preview"
                                sandbox="allow-same-origin allow-scripts allow-popups"
                            />
                        ) : (
                            <div className={s.empty}>No preview yet — regenerate to build the site.</div>
                        )}
                    </div>

                    {/* Regenerating overlay — covers the iframe with a dimmed
                        backdrop + status while the API rebuilds the site after
                        a theme or variant change. */}
                    {props.generatingWebsite && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "rgba(10, 12, 16, 0.72)",
                                backdropFilter: "blur(4px)",
                                pointerEvents: "none",
                                zIndex: 5,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 12,
                                    color: "#e9ecf2",
                                    fontFamily: "var(--sx-mono)",
                                    fontSize: 12,
                                    letterSpacing: "0.18em",
                                    textTransform: "uppercase",
                                }}
                            >
                                <Loader2 style={{ width: 28, height: 28, color: "#10b981" }} className="animate-spin" />
                                Regenerating site…
                                <span style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.12em" }}>
                                    Astro build · usually 30–60s
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

// ── ChipList — editable list-of-strings input with inline add/remove ──
function ChipList({
    items,
    placeholder,
    onChange,
}: {
    items: string[];
    placeholder?: string;
    onChange: (next: string[]) => void;
}) {
    const [draft, setDraft] = useState("");
    return (
        <div>
            {items.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {items.map((it, i) => (
                        <span
                            key={i}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 9px",
                                background: "rgba(16, 185, 129, 0.1)",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                color: "#10b981",
                                borderRadius: 999,
                                fontFamily: "var(--sx-mono, ui-monospace)",
                                fontSize: 11,
                                letterSpacing: "0.04em",
                            }}
                        >
                            {it}
                            <button
                                type="button"
                                onClick={() => onChange(items.filter((_, j) => j !== i))}
                                style={{
                                    background: "transparent",
                                    border: 0,
                                    color: "#10b981",
                                    cursor: "pointer",
                                    padding: 0,
                                    lineHeight: 1,
                                    fontSize: 14,
                                }}
                                title="Remove"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && draft.trim()) {
                            e.preventDefault();
                            onChange([...items, draft.trim()]);
                            setDraft("");
                        }
                    }}
                    placeholder={placeholder}
                    style={{ flex: 1 }}
                />
                <button
                    type="button"
                    onClick={() => {
                        if (!draft.trim()) return;
                        onChange([...items, draft.trim()]);
                        setDraft("");
                    }}
                    style={{
                        padding: "6px 12px",
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid rgba(16, 185, 129, 0.4)",
                        color: "#10b981",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                    title="Add"
                >
                    + Add
                </button>
            </div>
        </div>
    );
}
