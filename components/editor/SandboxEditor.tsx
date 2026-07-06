"use client";

/**
 * SandboxEditor — admin submission page editor, 1:1 port of the v01
 * sandbox.html design (Landing Pages v01/sandbox.html), wired into
 * the Tendso data model.
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
    Check,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { injectEditorBridge } from "./editorBridge";
import LinkPopover, { type LinkPopoverData } from "./LinkPopover";
import ImagePickerModal from "./ImagePickerModal";
import ContentFieldsAuto from "./ContentFieldsAuto";
import { deriveContentDefaults, getDerivedAt } from "@/lib/derive-content-defaults";
import s from "./SandboxEditor.module.css";

// ── GENERIC LANDING PAGES · 5 templates with iframe previews ─────────
// Each entry maps to a `customizations.heroStyle = "generic:<letter>"`
// selection that the Astro page router uses to render PageA…PageE.
const GENERIC_TEMPLATES = [
    { letter: 'A', code: 'generic:A', label: 'Ironwood',      tagline: 'Paper + gold · café',           preview: '/template-previews/a.html' },
    { letter: 'B', code: 'generic:B', label: 'Stillwater',    tagline: 'Teal + peach · yoga / studio',  preview: '/template-previews/b.html' },
    { letter: 'C', code: 'generic:C', label: 'Cedar & Stone', tagline: 'Amber + forest · build trades', preview: '/template-previews/c.html' },
    { letter: 'D', code: 'generic:D', label: 'Northpoint',    tagline: 'Lime on dark · tech / IT',      preview: '/template-previews/d.html' },
    { letter: 'E', code: 'generic:E', label: 'Wash House',    tagline: 'Blue + yellow · laundry',       preview: '/template-previews/e.html' },
] as const;

// ── BARBERSHOP · Forge family · 5 letter variants ────────────────────
// Codes map to `customizations.heroStyle = "barbershop:<letter>"` which
// the Astro router resolves to PageF…PageJ. Each variant shares the
// same 16 Letter F section components and only swaps :root tokens for
// per-letter palette / typography identity.
const BARBERSHOP_TEMPLATES = [
    { letter: 'F', code: 'barbershop:F', label: 'Forge',     tagline: 'Paper + brass · classic',           preview: '/template-previews/f.html' },
    { letter: 'G', code: 'barbershop:G', label: 'Cinematic', tagline: 'Oversized type · editorial',         preview: '/template-previews/g.html' },
    { letter: 'H', code: 'barbershop:H', label: 'Kinetic',   tagline: 'Black + green · energetic',          preview: '/template-previews/h.html' },
    { letter: 'I', code: 'barbershop:I', label: 'Minimal',   tagline: 'Neutral grayscale · refined',        preview: '/template-previews/i.html' },
    { letter: 'J', code: 'barbershop:J', label: 'Stacked',   tagline: 'Stone + dark red · bold serif',      preview: '/template-previews/j.html' },
] as const;

// ── SALONSPA · 5 letter variants K–O ─────────────────────────────────
// Codes map to `customizations.heroStyle = "salonspa:<letter>"` which the
// Astro router resolves to PageK…PageO. Each variant has a hand-tuned
// serif/sans pairing + accent palette. Shared section components from
// letter K; per-variant heroes (HeroK/L/M/N/O) match the source
// 01–05 SalonSpa HTMLs' distinct hero structures.
const SALONSPA_TEMPLATES = [
    { letter: 'K', code: 'salonspa:K', label: 'Atelier',  tagline: 'Pearl + brass · refined salon',         preview: '/template-previews/k.html' },
    { letter: 'L', code: 'salonspa:L', label: 'Botanica', tagline: 'Sage + cream · botanical spa',          preview: '/template-previews/l.html' },
    { letter: 'M', code: 'salonspa:M', label: 'Clinic',   tagline: 'Mist + teal · clinical aesthetic',      preview: '/template-previews/m.html' },
    { letter: 'N', code: 'salonspa:N', label: 'Vogue',    tagline: 'Mauve pink · editorial beauty',         preview: '/template-previews/n.html' },
    { letter: 'O', code: 'salonspa:O', label: 'Bloom',    tagline: 'Mauve + cream · romantic',              preview: '/template-previews/o.html' },
] as const;

// ── AUTOSHOP · 5 letter variants P–T ─────────────────────────────────
// Codes map to `customizations.heroStyle = "autoshop:<letter>"` → PageP…PageT.
const AUTOSHOP_TEMPLATES = [
    { letter: 'P', code: 'autoshop:P', label: 'Foundry',      tagline: 'Concrete + hazard orange · industrial', preview: '/template-previews/p.html' },
    { letter: 'Q', code: 'autoshop:Q', label: 'Meridian',     tagline: 'Clean steel · precision service',       preview: '/template-previews/q.html' },
    { letter: 'R', code: 'autoshop:R', label: 'Volt',         tagline: 'Electric accent · EV / modern',         preview: '/template-previews/r.html' },
    { letter: 'S', code: 'autoshop:S', label: 'Redline',      tagline: 'Bold red · performance shop',            preview: '/template-previews/s.html' },
    { letter: 'T', code: 'autoshop:T', label: 'Maple Street', tagline: 'Warm neighbourhood · trusted garage',    preview: '/template-previews/t.html' },
] as const;

// ── RESTAURANT · 5 letter variants U–Y ───────────────────────────────
// Codes map to `customizations.heroStyle = "restaurant:<letter>"` → PageU…PageY.
const RESTAURANT_TEMPLATES = [
    { letter: 'U', code: 'restaurant:U', label: 'Harvest',  tagline: 'Rustic + olive · farm-to-table',      preview: '/template-previews/u.html' },
    { letter: 'V', code: 'restaurant:V', label: 'Atelier',  tagline: 'Minimal · refined dining',            preview: '/template-previews/v.html' },
    { letter: 'W', code: 'restaurant:W', label: 'Press',    tagline: 'Bold type · casual eatery',           preview: '/template-previews/w.html' },
    { letter: 'X', code: 'restaurant:X', label: 'Ember',    tagline: 'Cinematic · fine dining',             preview: '/template-previews/x.html' },
    { letter: 'Y', code: 'restaurant:Y', label: 'Garden',   tagline: 'Playful · cafe / brunch',             preview: '/template-previews/y.html' },
] as const;

// ── SHIRTSTORE · 5 letter variants Z, AA–AD ──────────────────────────
// Codes map to `customizations.heroStyle = "shirtstore:<letter>"` → PageZ…PageAD.
const SHIRTSTORE_TEMPLATES = [
    { letter: 'Z',  code: 'shirtstore:Z',  label: 'Editorial',   tagline: 'Warm editorial · apparel brand',    preview: '/template-previews/z.html' },
    { letter: 'AA', code: 'shirtstore:AA', label: 'Streetwear',  tagline: 'Bold urban · drops / merch',        preview: '/template-previews/aa.html' },
    { letter: 'AB', code: 'shirtstore:AB', label: 'Artisan',     tagline: 'Handmade · small-batch',            preview: '/template-previews/ab.html' },
    { letter: 'AC', code: 'shirtstore:AC', label: 'Modern',      tagline: 'Clean minimal · DTC store',         preview: '/template-previews/ac.html' },
    { letter: 'AD', code: 'shirtstore:AD', label: 'Kinetic',     tagline: 'Energetic · statement tees',        preview: '/template-previews/ad.html' },
] as const;

type TemplateFamily = 'generic' | 'barbershop' | 'salonspa' | 'autoshop' | 'restaurant' | 'shirtstore';
const ALL_TEMPLATES = [...GENERIC_TEMPLATES, ...BARBERSHOP_TEMPLATES, ...SALONSPA_TEMPLATES, ...AUTOSHOP_TEMPLATES, ...RESTAURANT_TEMPLATES, ...SHIRTSTORE_TEMPLATES] as readonly { letter: string; code: string; label: string; tagline: string; preview: string }[];

// ── BUCKETS · pick-one categories ────────────────────────────────────
// `business_type` carries forward, but the variant-prefix routing was
// removed when the template library was wiped. New designs decide for
// themselves whether/how to use the bucket id.
const TEMPLATE_BUCKETS = [
    { id: "barber",     label: "Barber",     business: "Barber Shop",       desc: "Vintage masculine · heritage" },
    { id: "salon",      label: "Beauty",     business: "Salon / Spa",       desc: "Luxe ethereal · soft & feminine" },
    { id: "auto",       label: "Automotive", business: "Auto Shop",         desc: "Industrial · technical · rugged" },
    { id: "restaurant", label: "Food",       business: "Restaurant / Café", desc: "Warm · appetizing · hospitable" },
    { id: "clinic",     label: "Medical",    business: "Clinic / Dental",   desc: "Clean · trustworthy · professional" },
    { id: "retail",     label: "Retail",     business: "Retail Store",      desc: "Blueprint · clear · catalog" },
    { id: "fitness",    label: "Fitness",    business: "Gym / Studio",      desc: "Kinetic · bold · confident" },
    { id: "education",  label: "Education",  business: "School / Workshop", desc: "Warm · inviting · academic" },
    { id: "services",   label: "Services",   business: "Trades / Services", desc: "Service area · utility · clear" },
] as const;

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
    { name: "LOCATION",         tag: "recommended", visKey: "location_block" },
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
    /**
     * AI-enhanced image URLs resolved by the parent page (Convex storage
     * IDs already converted to https URLs via api.files.getMultipleUrls).
     * The Image-picker modal's "AI-enhanced" tab reads from this list.
     */
    enhancedImageUrls?: string[];

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
    onApprove?: () => void;
    onReject?: () => void;
    submissionStatus?: string;

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
        enhancedImageUrls,
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
        onApprove,
        onReject,
        submissionStatus,
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

    // Normalize Why / How / Testimonials / FAQ / Credentials when loading
    // content into the editor draft. The AI extraction emits flat arrays
    // with field names like `name` + `context`; the ContentFieldsAuto schema
    // expects `{items[]}` wrappers + canonical field names (`who`, `role`).
    // Mirrors lib/astro-builder.ts#normalizeBlock so the editor sidebar shows
    // the same content the rendered iframe shows. See the fix-thread in
    // docs/changes/TEMPLATES-SALONSPA-PLAN.md for full context.
    const normalizeBlockEditor = (
        input: any,
        itemsKey: 'items' | 'steps' = 'items',
        aliases: Record<string, string> = {},
        altItemsKey?: string,
    ): any => {
        if (input == null) return input;
        let arr: any[] | null = null;
        let wrapper: Record<string, any> = {};
        if (Array.isArray(input)) {
            arr = input;
        } else if (typeof input === 'object') {
            wrapper = { ...input };
            if (Array.isArray(input[itemsKey])) {
                arr = input[itemsKey];
            } else if (altItemsKey && Array.isArray(input[altItemsKey])) {
                arr = input[altItemsKey];
            }
        }
        if (!arr) return input;
        const mapped = arr.map((it: any) => {
            if (!it || typeof it !== 'object') return it;
            const out: Record<string, any> = { ...it };
            for (const [from, to] of Object.entries(aliases)) {
                if (out[from] != null && out[to] == null) out[to] = out[from];
            }
            return out;
        });
        delete wrapper[itemsKey];
        if (altItemsKey) delete wrapper[altItemsKey];
        return { ...wrapper, [itemsKey]: mapped };
    };
    const normalizeDraft = (raw: any): any => {
        if (!raw || typeof raw !== 'object') return raw ?? {};
        return {
            ...raw,
            why: normalizeBlockEditor(raw.why, 'items', { description: 'body' }),
            how: normalizeBlockEditor(raw.how, 'steps', { description: 'body' }, 'items'),
            testimonials: normalizeBlockEditor(raw.testimonials, 'items', { name: 'who', author: 'who', context: 'role' }),
            faq: normalizeBlockEditor(raw.faq, 'items', { question: 'q', answer: 'a' }),
            credentials: normalizeBlockEditor(raw.credentials, 'items', { description: 'desc', body: 'desc' }),
        };
    };

    const [draft, setDraft] = useState<any>(() => normalizeDraft(content));
    useEffect(() => {
        setDraft(normalizeDraft(content));
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

    // ── Link popover + Image picker modal state ───────────────────────
    // Both modals open in response to iframe → parent messages. The link
    // popover edits an <a>'s text + href in place. The image picker shows
    // originals + AI-enhanced for the clicked slot.
    const [linkPopover, setLinkPopover] = useState<LinkPopoverData | null>(null);
    const [imagePicker, setImagePicker] = useState<string | null>(null);
    // Template-tab accordions — Modern Designs (Generic) + Barbershop + SalonSpa.
    // Each defaults open if no template selected OR the active selection
    // belongs to that family; collapsed otherwise (still expandable).
    const __initStyle = String((customizations as any)?.heroStyle ?? "");
    const [templateAccordionOpen, setTemplateAccordionOpen] = useState<boolean>(
        () => /^generic:[A-E]$/.test(__initStyle) || !/^(generic|barbershop|salonspa|autoshop|restaurant|shirtstore):/.test(__initStyle),
    );
    const [barbershopAccordionOpen, setBarbershopAccordionOpen] = useState<boolean>(
        () => /^barbershop:[F-J]$/.test(__initStyle),
    );
    const [salonspaAccordionOpen, setSalonspaAccordionOpen] = useState<boolean>(
        () => /^salonspa:[K-O]$/.test(__initStyle),
    );
    const [autoshopAccordionOpen, setAutoshopAccordionOpen] = useState<boolean>(
        () => /^autoshop:[P-T]$/.test(__initStyle),
    );
    const [restaurantAccordionOpen, setRestaurantAccordionOpen] = useState<boolean>(
        () => /^restaurant:[U-Y]$/.test(__initStyle),
    );
    const [shirtstoreAccordionOpen, setShirtstoreAccordionOpen] = useState<boolean>(
        () => /^shirtstore:(Z|A[A-D])$/.test(__initStyle),
    );

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

            // Link click — open the link popover. data-href-field on the
            // anchor tells us where to write the new href; data-field (if
            // present) is the text-label field.
            if (e.data.type === "ed:link-click") {
                setLinkPopover({
                    field: String(e.data.field || ''),
                    hrefField: String(e.data.hrefField || ''),
                    platformField: e.data.platformField ? String(e.data.platformField) : undefined,
                    text: String(e.data.text || ''),
                    href: String(e.data.href || ''),
                    platform: e.data.platform ? String(e.data.platform) : undefined,
                });
                return;
            }

            // Image click — open the image picker modal.
            if (e.data.type === "ed:image-click" && typeof e.data.field === "string") {
                setImagePicker(e.data.field);
                return;
            }

            // Selection inside iframe → soft-focus the matching sidebar input.
            // Unlike ed:click this doesn't switch tabs; it only scrolls + ring-
            // highlights the input so admin sees where the field lives.
            if (e.data.type === "ed:select" && typeof e.data.field === "string") {
                const field = e.data.field;
                if (tab === "content") {
                    requestAnimationFrame(() => {
                        const inputEl = document.querySelector(
                            `[data-field-input="${field}"]`,
                        ) as HTMLElement | null;
                        if (inputEl) {
                            inputEl.scrollIntoView({ block: "center", behavior: "smooth" });
                            inputEl.classList.add("ed-selection-pulse");
                            window.setTimeout(() => inputEl.classList.remove("ed-selection-pulse"), 1400);
                        }
                    });
                } else {
                    // Other tab is open — flip to content so the highlight is
                    // visible. This is the "highlight to edit" UX flow.
                    setTab("content");
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            const inputEl = document.querySelector(
                                `[data-field-input="${field}"]`,
                            ) as HTMLElement | null;
                            if (inputEl) {
                                inputEl.scrollIntoView({ block: "center", behavior: "smooth" });
                                inputEl.classList.add("ed-selection-pulse");
                                window.setTimeout(() => inputEl.classList.remove("ed-selection-pulse"), 1400);
                            }
                        });
                    });
                }
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

    // ── Link popover save — push update to iframe + patch draft ──────
    const handleLinkSave = useCallback((next: LinkPopoverData) => {
        // 1. Live-update the iframe so the preview shows the change.
        try {
            iframeRef.current?.contentWindow?.postMessage(
                {
                    type: "ed:link-update",
                    field: next.field,
                    hrefField: next.hrefField,
                    text: next.text,
                    href: next.href,
                    platformField: next.platformField,
                    platform: next.platform,
                },
                "*",
            );
        } catch { /* sandboxed iframe — ignore */ }
        // 2. Patch the draft so the change survives Save. We write under
        //    the SHORT path segments (text → data-field path, href →
        //    data-href-field path with the trailing ".href" implied).
        if (next.field) setDeepDraft(next.field, next.text);
        if (next.hrefField) setDeepDraft(next.hrefField, next.href);
    }, []);

    // ── Image picker — apply the chosen URL ──────────────────────────
    const handleImagePick = useCallback((field: string, src: string) => {
        try {
            iframeRef.current?.contentWindow?.postMessage(
                { type: "ed:image", field, src },
                "*",
            );
        } catch { /* sandboxed iframe — ignore */ }
        setDeepDraft(field, src);
        setImagePicker(null);
    }, []);

    // ── setDeepDraft — write a dotted path into the content draft ─────
    // Used by the link popover and image picker so changes persist past
    // the in-iframe live update. Mutates a new copy and updates state.
    function setDeepDraft(path: string, value: any) {
        setDraft((prev: any) => {
            const root = prev ? { ...prev } : {};
            const parts = path.split('.');
            let cur: any = root;
            for (let i = 0; i < parts.length - 1; i++) {
                const k = parts[i];
                const nextKey = parts[i + 1];
                const numeric = /^\d+$/.test(nextKey);
                // Preserve existing value's array-ness; otherwise create
                // an array when next segment is a number, else an object.
                if (Array.isArray(cur[k])) {
                    cur[k] = [...cur[k]];
                } else if (typeof cur[k] === 'object' && cur[k] !== null) {
                    cur[k] = { ...cur[k] };
                } else {
                    cur[k] = numeric ? [] : {};
                }
                cur = cur[k];
            }
            cur[parts[parts.length - 1]] = value;
            return root;
        });
    }

    // ── Pending customizations (Template + Theme tabs) ────────────────
    // User selections are batched here — no regen on every click. They
    // get committed to the parent on Save changes (atomically with any
    // content draft) so the page regenerates ONCE with everything applied.
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
            if (slot === "favicon") {
                // Website tab image — saved separately from the photo gallery.
                // Build pipeline reads draft.favicon → siteData.layout.favicon
                // → <link rel="icon"> in BaseLayout.
                next.favicon = url;
            } else if (slot === "hero.image") {
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
                    {/* Compact single-dropdown picker. Category section was
                        removed per user request — admins pick the design
                        directly. The dropdown lists the 5 generic landing
                        pages plus an "Auto / placeholder" option that keeps
                        the legacy non-generic flow. */}
                    {tab === "template" && (() => {
                        const currentHeroStyle = String(
                            (effectiveCustomizations as any)?.heroStyle ?? "",
                        );
                        const onPickTemplate = (code: string) => {
                            if (!code) {
                                // "Auto" / clear — drop the generic codes,
                                // restore something the legacy flow accepts.
                                setPendingCustomizations((prev: any) => ({
                                    ...(prev ?? customizations ?? {}),
                                    heroStyle: "",
                                    aboutStyle: "",
                                    servicesStyle: "",
                                    galleryStyle: "",
                                    contactStyle: "",
                                    trustStyle: "",
                                    whyUsStyle: "",
                                    howItWorksStyle: "",
                                    testimonialsStyle: "",
                                    faqStyle: "",
                                    serviceAreaStyle: "",
                                    credentialsStyle: "",
                                    ctaBandStyle: "",
                                }));
                                return;
                            }
                            const tpl = ALL_TEMPLATES.find((t) => t.code === code);
                            const letter = tpl?.letter ?? "A";
                            // Branded families (Barbershop F–J, SalonSpa K–O) are
                            // hand-tuned palettes + serif/sans pairings — picking
                            // one means "show me THIS variant's identity." Any
                            // leftover explicit colorScheme / fontPairing from a
                            // prior pick would stomp the variant's tokens via the
                            // html:root !important override block in
                            // genericThemeOverrides.ts. Reset both to 'auto' on
                            // branded-family picks so the variant identity wins.
                            // Generic templates (A–E) are recolor-ready shells —
                            // leave any explicit admin pick alone for them.
                            // See TEMPLATE-FAMILY-PLAYBOOK.md §"Branded-family
                            // picks reset theme picks" for full context.
                            const isBranded = BARBERSHOP_TEMPLATES.some((t) => t.code === code)
                                || SALONSPA_TEMPLATES.some((t) => t.code === code)
                                || AUTOSHOP_TEMPLATES.some((t) => t.code === code)
                                || RESTAURANT_TEMPLATES.some((t) => t.code === code)
                                || SHIRTSTORE_TEMPLATES.some((t) => t.code === code);
                            setPendingCustomizations((prev: any) => {
                                const base = prev ?? customizations ?? {};
                                return {
                                    ...base,
                                    heroStyle: code,
                                    aboutStyle: code,
                                    servicesStyle: code,
                                    galleryStyle: code,
                                    contactStyle: code,
                                    trustStyle: code,
                                    whyUsStyle: code,
                                    howItWorksStyle: code,
                                    testimonialsStyle: code,
                                    faqStyle: code,
                                    serviceAreaStyle: code,
                                    credentialsStyle: code,
                                    ctaBandStyle: code,
                                    navbarStyle: letter,
                                    ...(isBranded ? {
                                        colorScheme: 'auto',
                                        colorSchemeId: 'auto',
                                        fontPairing: 'auto',
                                        fontPairingId: 'auto',
                                    } : {}),
                                };
                            });
                        };
                        const activeTpl = ALL_TEMPLATES.find((t) => t.code === currentHeroStyle);
                        const activeFamily: TemplateFamily | null = activeTpl
                            ? (BARBERSHOP_TEMPLATES.some((t) => t.code === activeTpl.code)
                                ? 'barbershop'
                                : SALONSPA_TEMPLATES.some((t) => t.code === activeTpl.code)
                                    ? 'salonspa'
                                    : AUTOSHOP_TEMPLATES.some((t) => t.code === activeTpl.code)
                                        ? 'autoshop'
                                        : RESTAURANT_TEMPLATES.some((t) => t.code === activeTpl.code)
                                            ? 'restaurant'
                                            : SHIRTSTORE_TEMPLATES.some((t) => t.code === activeTpl.code)
                                                ? 'shirtstore'
                                                : 'generic')
                            : null;
                        return (
                            <div className="space-y-3">
                                {customizationsDirty && (
                                    <div className={s.pendingBanner}>
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sx-accent)" }} />
                                        Pending · click Save changes to apply
                                    </div>
                                )}

                                <div className={s.section}>
                                    <details
                                        open={templateAccordionOpen}
                                        onToggle={(e) => setTemplateAccordionOpen((e.target as HTMLDetailsElement).open)}
                                        style={{
                                            borderRadius: 10,
                                            overflow: "hidden",
                                            background: "var(--sx-panel-2)",
                                            border: "1px solid var(--sx-rule)",
                                        }}
                                    >
                                        <summary
                                            style={{
                                                listStyle: "none",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "12px 14px",
                                                color: "var(--sx-ink)",
                                                gap: 12,
                                            }}
                                        >
                                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontFamily: "var(--sx-mono)",
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        letterSpacing: "0.16em",
                                                        textTransform: "uppercase",
                                                        color: "var(--sx-accent)",
                                                    }}
                                                >
                                                    Modern Designs
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                    {activeFamily === 'generic' && activeTpl ? activeTpl.label : "Auto / placeholder"}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--sx-ink-soft)",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {activeFamily === 'generic' && activeTpl ? activeTpl.tagline : "Click to browse landing-page designs"}
                                                </div>
                                            </div>
                                            <ChevronDown
                                                style={{
                                                    width: 14,
                                                    height: 14,
                                                    color: "var(--sx-ink-soft)",
                                                    transition: "transform .18s",
                                                    transform: templateAccordionOpen ? "rotate(180deg)" : "none",
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </summary>
                                        <div
                                            style={{
                                                padding: "8px 12px 14px",
                                                borderTop: "1px solid var(--sx-rule)",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 12,
                                            }}
                                        >
                                            {GENERIC_TEMPLATES.map((tpl) => {
                                                const isActive = currentHeroStyle === tpl.code;
                                                return (
                                                    <button
                                                        key={tpl.code}
                                                        type="button"
                                                        onClick={() => onPickTemplate(tpl.code)}
                                                        style={{
                                                            display: "block",
                                                            width: "100%",
                                                            textAlign: "left",
                                                            padding: 0,
                                                            background: isActive ? "rgba(16, 185, 129, 0.08)" : "var(--sx-panel)",
                                                            border: isActive ? "1.5px solid var(--sx-accent)" : "1px solid var(--sx-rule)",
                                                            borderRadius: 10,
                                                            overflow: "hidden",
                                                            cursor: "pointer",
                                                            transition: "border-color .15s, transform .15s",
                                                            fontFamily: "var(--sx-sans)",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: "100%",
                                                                aspectRatio: "16 / 10",
                                                                background: "#fff",
                                                                borderBottom: "1px solid var(--sx-rule)",
                                                                position: "relative",
                                                                overflow: "hidden",
                                                            }}
                                                        >
                                                            <iframe
                                                                src={tpl.preview}
                                                                title={`${tpl.label} preview`}
                                                                loading="lazy"
                                                                sandbox=""
                                                                style={{
                                                                    position: "absolute",
                                                                    top: 0,
                                                                    left: 0,
                                                                    width: "300%",
                                                                    height: "300%",
                                                                    border: 0,
                                                                    transform: "scale(0.333)",
                                                                    transformOrigin: "top left",
                                                                    pointerEvents: "none",
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ padding: "10px 14px 12px" }}>
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                    justifyContent: "space-between",
                                                                }}
                                                            >
                                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                                    {tpl.label}
                                                                </div>
                                                                {isActive && (
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
                                                            <div
                                                                style={{
                                                                    fontSize: 11,
                                                                    color: "var(--sx-ink-soft)",
                                                                    marginTop: 4,
                                                                }}
                                                            >
                                                                {tpl.tagline}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            <button
                                                type="button"
                                                onClick={() => onPickTemplate("")}
                                                style={{
                                                    padding: "10px 14px",
                                                    background: currentHeroStyle === "" ? "rgba(16, 185, 129, 0.08)" : "transparent",
                                                    border: currentHeroStyle === "" ? "1.5px solid var(--sx-accent)" : "1px dashed var(--sx-rule)",
                                                    borderRadius: 10,
                                                    color: "var(--sx-ink-soft)",
                                                    fontSize: 12,
                                                    fontFamily: "var(--sx-sans)",
                                                    cursor: "pointer",
                                                    textAlign: "left",
                                                }}
                                            >
                                                Auto / placeholder · use when no template is set
                                            </button>
                                        </div>
                                    </details>
                                </div>

                                {/* ── BARBERSHOP · Forge family ─────────────── */}
                                <div className={s.section}>
                                    <details
                                        open={barbershopAccordionOpen}
                                        onToggle={(e) => setBarbershopAccordionOpen((e.target as HTMLDetailsElement).open)}
                                        style={{
                                            borderRadius: 10,
                                            overflow: "hidden",
                                            background: "var(--sx-panel-2)",
                                            border: "1px solid var(--sx-rule)",
                                        }}
                                    >
                                        <summary
                                            style={{
                                                listStyle: "none",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "12px 14px",
                                                color: "var(--sx-ink)",
                                                gap: 12,
                                            }}
                                        >
                                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontFamily: "var(--sx-mono)",
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        letterSpacing: "0.16em",
                                                        textTransform: "uppercase",
                                                        color: "var(--sx-accent)",
                                                    }}
                                                >
                                                    Barbershop
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                    {activeFamily === 'barbershop' && activeTpl ? activeTpl.label : "Forge family · 5 variants"}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--sx-ink-soft)",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {activeFamily === 'barbershop' && activeTpl ? activeTpl.tagline : "Click to browse barbershop designs"}
                                                </div>
                                            </div>
                                            <ChevronDown
                                                style={{
                                                    width: 14,
                                                    height: 14,
                                                    color: "var(--sx-ink-soft)",
                                                    transition: "transform .18s",
                                                    transform: barbershopAccordionOpen ? "rotate(180deg)" : "none",
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </summary>
                                        <div
                                            style={{
                                                padding: "8px 12px 14px",
                                                borderTop: "1px solid var(--sx-rule)",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 12,
                                            }}
                                        >
                                            {BARBERSHOP_TEMPLATES.map((tpl) => {
                                                const isActive = currentHeroStyle === tpl.code;
                                                return (
                                                    <button
                                                        key={tpl.code}
                                                        type="button"
                                                        onClick={() => onPickTemplate(tpl.code)}
                                                        style={{
                                                            display: "block",
                                                            width: "100%",
                                                            textAlign: "left",
                                                            padding: 0,
                                                            background: isActive ? "rgba(16, 185, 129, 0.08)" : "var(--sx-panel)",
                                                            border: isActive ? "1.5px solid var(--sx-accent)" : "1px solid var(--sx-rule)",
                                                            borderRadius: 10,
                                                            overflow: "hidden",
                                                            cursor: "pointer",
                                                            transition: "border-color .15s, transform .15s",
                                                            fontFamily: "var(--sx-sans)",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: "100%",
                                                                aspectRatio: "16 / 10",
                                                                background: "#fff",
                                                                borderBottom: "1px solid var(--sx-rule)",
                                                                position: "relative",
                                                                overflow: "hidden",
                                                            }}
                                                        >
                                                            <iframe
                                                                src={tpl.preview}
                                                                title={`${tpl.label} preview`}
                                                                loading="lazy"
                                                                sandbox=""
                                                                style={{
                                                                    position: "absolute",
                                                                    top: 0,
                                                                    left: 0,
                                                                    width: "300%",
                                                                    height: "300%",
                                                                    border: 0,
                                                                    transform: "scale(0.333)",
                                                                    transformOrigin: "top left",
                                                                    pointerEvents: "none",
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ padding: "10px 14px 12px" }}>
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                    justifyContent: "space-between",
                                                                }}
                                                            >
                                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                                    {tpl.label}
                                                                </div>
                                                                {isActive && (
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
                                                            <div
                                                                style={{
                                                                    fontSize: 11,
                                                                    color: "var(--sx-ink-soft)",
                                                                    marginTop: 4,
                                                                }}
                                                            >
                                                                {tpl.tagline}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </details>
                                </div>

                                {/* ── SALONSPA family ───────────────────────── */}
                                <div className={s.section}>
                                    <details
                                        open={salonspaAccordionOpen}
                                        onToggle={(e) => setSalonspaAccordionOpen((e.target as HTMLDetailsElement).open)}
                                        style={{
                                            borderRadius: 10,
                                            overflow: "hidden",
                                            background: "var(--sx-panel-2)",
                                            border: "1px solid var(--sx-rule)",
                                        }}
                                    >
                                        <summary
                                            style={{
                                                listStyle: "none",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "12px 14px",
                                                color: "var(--sx-ink)",
                                                gap: 12,
                                            }}
                                        >
                                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontFamily: "var(--sx-mono)",
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        letterSpacing: "0.16em",
                                                        textTransform: "uppercase",
                                                        color: "var(--sx-accent)",
                                                    }}
                                                >
                                                    Salon & Spa
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                    {activeFamily === 'salonspa' && activeTpl ? activeTpl.label : "SalonSpa family · 5 variants"}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--sx-ink-soft)",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {activeFamily === 'salonspa' && activeTpl ? activeTpl.tagline : "Click to browse salon & spa designs"}
                                                </div>
                                            </div>
                                            <ChevronDown
                                                style={{
                                                    width: 14,
                                                    height: 14,
                                                    color: "var(--sx-ink-soft)",
                                                    transition: "transform .18s",
                                                    transform: salonspaAccordionOpen ? "rotate(180deg)" : "none",
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </summary>
                                        <div
                                            style={{
                                                padding: "8px 12px 14px",
                                                borderTop: "1px solid var(--sx-rule)",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 12,
                                            }}
                                        >
                                            {SALONSPA_TEMPLATES.map((tpl) => {
                                                const isActive = currentHeroStyle === tpl.code;
                                                return (
                                                    <button
                                                        key={tpl.code}
                                                        type="button"
                                                        onClick={() => onPickTemplate(tpl.code)}
                                                        style={{
                                                            display: "block",
                                                            width: "100%",
                                                            textAlign: "left",
                                                            padding: 0,
                                                            background: isActive ? "rgba(16, 185, 129, 0.08)" : "var(--sx-panel)",
                                                            border: isActive ? "1.5px solid var(--sx-accent)" : "1px solid var(--sx-rule)",
                                                            borderRadius: 10,
                                                            overflow: "hidden",
                                                            cursor: "pointer",
                                                            transition: "border-color .15s, transform .15s",
                                                            fontFamily: "var(--sx-sans)",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: "100%",
                                                                aspectRatio: "16 / 10",
                                                                background: "#fff",
                                                                borderBottom: "1px solid var(--sx-rule)",
                                                                position: "relative",
                                                                overflow: "hidden",
                                                            }}
                                                        >
                                                            <iframe
                                                                src={tpl.preview}
                                                                title={`${tpl.label} preview`}
                                                                loading="lazy"
                                                                sandbox=""
                                                                style={{
                                                                    position: "absolute",
                                                                    top: 0,
                                                                    left: 0,
                                                                    width: "300%",
                                                                    height: "300%",
                                                                    border: 0,
                                                                    transform: "scale(0.333)",
                                                                    transformOrigin: "top left",
                                                                    pointerEvents: "none",
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ padding: "10px 14px 12px" }}>
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                    justifyContent: "space-between",
                                                                }}
                                                            >
                                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                                    {tpl.label}
                                                                </div>
                                                                {isActive && (
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
                                                            <div
                                                                style={{
                                                                    fontSize: 11,
                                                                    color: "var(--sx-ink-soft)",
                                                                    marginTop: 4,
                                                                }}
                                                            >
                                                                {tpl.tagline}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </details>
                                </div>

                                {/* ── AUTOSHOP family ───────────────────────── */}
                                <div className={s.section}>
                                    <details
                                        open={autoshopAccordionOpen}
                                        onToggle={(e) => setAutoshopAccordionOpen((e.target as HTMLDetailsElement).open)}
                                        style={{
                                            borderRadius: 10,
                                            overflow: "hidden",
                                            background: "var(--sx-panel-2)",
                                            border: "1px solid var(--sx-rule)",
                                        }}
                                    >
                                        <summary
                                            style={{
                                                listStyle: "none",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "12px 14px",
                                                color: "var(--sx-ink)",
                                                gap: 12,
                                            }}
                                        >
                                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontFamily: "var(--sx-mono)",
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        letterSpacing: "0.16em",
                                                        textTransform: "uppercase",
                                                        color: "var(--sx-accent)",
                                                    }}
                                                >
                                                    Auto Shop
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                    {activeFamily === 'autoshop' && activeTpl ? activeTpl.label : "Auto shop family · 5 variants"}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--sx-ink-soft)",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {activeFamily === 'autoshop' && activeTpl ? activeTpl.tagline : "Click to browse auto shop designs"}
                                                </div>
                                            </div>
                                            <ChevronDown
                                                style={{
                                                    width: 14,
                                                    height: 14,
                                                    color: "var(--sx-ink-soft)",
                                                    transition: "transform .18s",
                                                    transform: autoshopAccordionOpen ? "rotate(180deg)" : "none",
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </summary>
                                        <div
                                            style={{
                                                padding: "8px 12px 14px",
                                                borderTop: "1px solid var(--sx-rule)",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 12,
                                            }}
                                        >
                                            {AUTOSHOP_TEMPLATES.map((tpl) => {
                                                const isActive = currentHeroStyle === tpl.code;
                                                return (
                                                    <button
                                                        key={tpl.code}
                                                        type="button"
                                                        onClick={() => onPickTemplate(tpl.code)}
                                                        style={{
                                                            display: "block",
                                                            width: "100%",
                                                            textAlign: "left",
                                                            padding: 0,
                                                            background: isActive ? "rgba(16, 185, 129, 0.08)" : "var(--sx-panel)",
                                                            border: isActive ? "1.5px solid var(--sx-accent)" : "1px solid var(--sx-rule)",
                                                            borderRadius: 10,
                                                            overflow: "hidden",
                                                            cursor: "pointer",
                                                            transition: "border-color .15s, transform .15s",
                                                            fontFamily: "var(--sx-sans)",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: "100%",
                                                                aspectRatio: "16 / 10",
                                                                background: "#fff",
                                                                borderBottom: "1px solid var(--sx-rule)",
                                                                position: "relative",
                                                                overflow: "hidden",
                                                            }}
                                                        >
                                                            <iframe
                                                                src={tpl.preview}
                                                                title={`${tpl.label} preview`}
                                                                loading="lazy"
                                                                sandbox=""
                                                                style={{
                                                                    position: "absolute",
                                                                    top: 0,
                                                                    left: 0,
                                                                    width: "300%",
                                                                    height: "300%",
                                                                    border: 0,
                                                                    transform: "scale(0.333)",
                                                                    transformOrigin: "top left",
                                                                    pointerEvents: "none",
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ padding: "10px 14px 12px" }}>
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                    justifyContent: "space-between",
                                                                }}
                                                            >
                                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                                    {tpl.label}
                                                                </div>
                                                                {isActive && (
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
                                                            <div
                                                                style={{
                                                                    fontSize: 11,
                                                                    color: "var(--sx-ink-soft)",
                                                                    marginTop: 4,
                                                                }}
                                                            >
                                                                {tpl.tagline}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </details>
                                </div>

                                {/* ── RESTAURANT family ─────────────────────── */}
                                <div className={s.section}>
                                    <details
                                        open={restaurantAccordionOpen}
                                        onToggle={(e) => setRestaurantAccordionOpen((e.target as HTMLDetailsElement).open)}
                                        style={{
                                            borderRadius: 10,
                                            overflow: "hidden",
                                            background: "var(--sx-panel-2)",
                                            border: "1px solid var(--sx-rule)",
                                        }}
                                    >
                                        <summary
                                            style={{
                                                listStyle: "none",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "12px 14px",
                                                color: "var(--sx-ink)",
                                                gap: 12,
                                            }}
                                        >
                                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontFamily: "var(--sx-mono)",
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        letterSpacing: "0.16em",
                                                        textTransform: "uppercase",
                                                        color: "var(--sx-accent)",
                                                    }}
                                                >
                                                    Restaurant
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                    {activeFamily === 'restaurant' && activeTpl ? activeTpl.label : "Restaurant family · 5 variants"}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--sx-ink-soft)",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {activeFamily === 'restaurant' && activeTpl ? activeTpl.tagline : "Click to browse restaurant designs"}
                                                </div>
                                            </div>
                                            <ChevronDown
                                                style={{
                                                    width: 14,
                                                    height: 14,
                                                    color: "var(--sx-ink-soft)",
                                                    transition: "transform .18s",
                                                    transform: restaurantAccordionOpen ? "rotate(180deg)" : "none",
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </summary>
                                        <div
                                            style={{
                                                padding: "8px 12px 14px",
                                                borderTop: "1px solid var(--sx-rule)",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 12,
                                            }}
                                        >
                                            {RESTAURANT_TEMPLATES.map((tpl) => {
                                                const isActive = currentHeroStyle === tpl.code;
                                                return (
                                                    <button
                                                        key={tpl.code}
                                                        type="button"
                                                        onClick={() => onPickTemplate(tpl.code)}
                                                        style={{
                                                            display: "block",
                                                            width: "100%",
                                                            textAlign: "left",
                                                            padding: 0,
                                                            background: isActive ? "rgba(16, 185, 129, 0.08)" : "var(--sx-panel)",
                                                            border: isActive ? "1.5px solid var(--sx-accent)" : "1px solid var(--sx-rule)",
                                                            borderRadius: 10,
                                                            overflow: "hidden",
                                                            cursor: "pointer",
                                                            transition: "border-color .15s, transform .15s",
                                                            fontFamily: "var(--sx-sans)",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: "100%",
                                                                aspectRatio: "16 / 10",
                                                                background: "#fff",
                                                                borderBottom: "1px solid var(--sx-rule)",
                                                                position: "relative",
                                                                overflow: "hidden",
                                                            }}
                                                        >
                                                            <iframe
                                                                src={tpl.preview}
                                                                title={`${tpl.label} preview`}
                                                                loading="lazy"
                                                                sandbox=""
                                                                style={{
                                                                    position: "absolute",
                                                                    top: 0,
                                                                    left: 0,
                                                                    width: "300%",
                                                                    height: "300%",
                                                                    border: 0,
                                                                    transform: "scale(0.333)",
                                                                    transformOrigin: "top left",
                                                                    pointerEvents: "none",
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ padding: "10px 14px 12px" }}>
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                    justifyContent: "space-between",
                                                                }}
                                                            >
                                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                                    {tpl.label}
                                                                </div>
                                                                {isActive && (
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
                                                            <div
                                                                style={{
                                                                    fontSize: 11,
                                                                    color: "var(--sx-ink-soft)",
                                                                    marginTop: 4,
                                                                }}
                                                            >
                                                                {tpl.tagline}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </details>
                                </div>

                                {/* ── SHIRTSTORE family ─────────────────────── */}
                                <div className={s.section}>
                                    <details
                                        open={shirtstoreAccordionOpen}
                                        onToggle={(e) => setShirtstoreAccordionOpen((e.target as HTMLDetailsElement).open)}
                                        style={{
                                            borderRadius: 10,
                                            overflow: "hidden",
                                            background: "var(--sx-panel-2)",
                                            border: "1px solid var(--sx-rule)",
                                        }}
                                    >
                                        <summary
                                            style={{
                                                listStyle: "none",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "12px 14px",
                                                color: "var(--sx-ink)",
                                                gap: 12,
                                            }}
                                        >
                                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontFamily: "var(--sx-mono)",
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        letterSpacing: "0.16em",
                                                        textTransform: "uppercase",
                                                        color: "var(--sx-accent)",
                                                    }}
                                                >
                                                    Shirt Store
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                    {activeFamily === 'shirtstore' && activeTpl ? activeTpl.label : "Shirt store family · 5 variants"}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--sx-ink-soft)",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {activeFamily === 'shirtstore' && activeTpl ? activeTpl.tagline : "Click to browse shirt store designs"}
                                                </div>
                                            </div>
                                            <ChevronDown
                                                style={{
                                                    width: 14,
                                                    height: 14,
                                                    color: "var(--sx-ink-soft)",
                                                    transition: "transform .18s",
                                                    transform: shirtstoreAccordionOpen ? "rotate(180deg)" : "none",
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </summary>
                                        <div
                                            style={{
                                                padding: "8px 12px 14px",
                                                borderTop: "1px solid var(--sx-rule)",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 12,
                                            }}
                                        >
                                            {SHIRTSTORE_TEMPLATES.map((tpl) => {
                                                const isActive = currentHeroStyle === tpl.code;
                                                return (
                                                    <button
                                                        key={tpl.code}
                                                        type="button"
                                                        onClick={() => onPickTemplate(tpl.code)}
                                                        style={{
                                                            display: "block",
                                                            width: "100%",
                                                            textAlign: "left",
                                                            padding: 0,
                                                            background: isActive ? "rgba(16, 185, 129, 0.08)" : "var(--sx-panel)",
                                                            border: isActive ? "1.5px solid var(--sx-accent)" : "1px solid var(--sx-rule)",
                                                            borderRadius: 10,
                                                            overflow: "hidden",
                                                            cursor: "pointer",
                                                            transition: "border-color .15s, transform .15s",
                                                            fontFamily: "var(--sx-sans)",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: "100%",
                                                                aspectRatio: "16 / 10",
                                                                background: "#fff",
                                                                borderBottom: "1px solid var(--sx-rule)",
                                                                position: "relative",
                                                                overflow: "hidden",
                                                            }}
                                                        >
                                                            <iframe
                                                                src={tpl.preview}
                                                                title={`${tpl.label} preview`}
                                                                loading="lazy"
                                                                sandbox=""
                                                                style={{
                                                                    position: "absolute",
                                                                    top: 0,
                                                                    left: 0,
                                                                    width: "300%",
                                                                    height: "300%",
                                                                    border: 0,
                                                                    transform: "scale(0.333)",
                                                                    transformOrigin: "top left",
                                                                    pointerEvents: "none",
                                                                }}
                                                            />
                                                        </div>
                                                        <div style={{ padding: "10px 14px 12px" }}>
                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 8,
                                                                    justifyContent: "space-between",
                                                                }}
                                                            >
                                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sx-ink)" }}>
                                                                    {tpl.label}
                                                                </div>
                                                                {isActive && (
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
                                                            <div
                                                                style={{
                                                                    fontSize: 11,
                                                                    color: "var(--sx-ink-soft)",
                                                                    marginTop: 4,
                                                                }}
                                                            >
                                                                {tpl.tagline}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </details>
                                </div>

                                <div
                                    style={{
                                        padding: 14,
                                        borderRadius: 10,
                                        background: "var(--sx-panel-2)",
                                        border: "1px dashed var(--sx-rule)",
                                        color: "var(--sx-ink-soft)",
                                        fontSize: 11,
                                        lineHeight: 1.55,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontFamily: "var(--sx-mono)",
                                            fontSize: 9,
                                            fontWeight: 700,
                                            letterSpacing: "0.16em",
                                            textTransform: "uppercase",
                                            color: "var(--sx-accent)",
                                            marginBottom: 4,
                                        }}
                                    >
                                        Editing tips
                                    </div>
                                    Click any text in the preview to focus its sidebar input.
                                    Click any link to edit the button text + URL. Click any
                                    image to swap it from your photos or AI-enhanced library.
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── CONTENT ──────────────────────────────── */}
                    {tab === "content" && /^(generic:[A-E]|barbershop:[F-J]|salonspa:[K-O]|autoshop:[P-T]|restaurant:[U-Y]|shirtstore:(Z|A[A-D]))$/.test(String((effectiveCustomizations as any)?.heroStyle ?? "")) && (() => {
                        // Derive the same "tier-3" fallback the build pipeline
                        // uses so inputs always show what the iframe shows. The
                        // editor's getValue() chain becomes:
                        //   1. draft (admin override)
                        //   2. schema-declared fallbackPaths (already in ContentFieldsAuto)
                        //   3. submission-derived defaults (this layer)
                        const derived = deriveContentDefaults({
                            business_name: (draft as any)?.business_name || businessName,
                            business_city: (draft as any)?.business_city || (draft as any)?.contact?.city,
                            business_type: (draft as any)?.business_type || businessType,
                            tagline: (draft as any)?.tagline,
                            about: (draft as any)?.about,
                            contact: (draft as any)?.contact,
                        }, photos);
                        return (
                            <ContentFieldsAuto
                                getValue={(path: string) => {
                                    const parts = path.split('.');
                                    let cur: any = draft;
                                    for (const p of parts) {
                                        if (cur == null) { cur = undefined; break; }
                                        cur = cur[p];
                                    }
                                    if (cur !== undefined && cur !== null && cur !== '') return cur;
                                    // Final fallback — the derived value for this path.
                                    return getDerivedAt(derived, path);
                                }}
                                setValue={(path: string, value: any) => setDeepDraft(path, value)}
                                openImagePicker={(path: string) => setImagePicker(path)}
                                pushLiveText={(path: string, value: any) => {
                                    try {
                                        iframeRef.current?.contentWindow?.postMessage(
                                            { type: 'ed:update', field: path, value },
                                            '*',
                                        );
                                    } catch { /* sandboxed */ }
                                }}
                            />
                        );
                    })()}
                    {tab === "content" && !/^generic:[A-E]$/.test(String((effectiveCustomizations as any)?.heroStyle ?? "")) && (
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
                            {/* ── Favicon slot — dedicated, always one image ──
                                Saves to draft.favicon (not the gallery array) and
                                ships as <link rel="icon"> in the deployed site.
                                First admin upload + Republish makes it live. */}
                            <div
                                style={{
                                    background: "var(--sx-panel-2)",
                                    border: "1px solid var(--sx-rule)",
                                    borderRadius: 10,
                                    padding: 14,
                                    marginBottom: 18,
                                }}
                            >
                                <div
                                    className={s.sectionHead}
                                    style={{ marginBottom: 10, color: "var(--sx-accent)" }}
                                >
                                    WEBSITE TAB IMAGE · FAVICON
                                </div>
                                <div className={s.hint} style={{ marginBottom: 12 }}>
                                    The small icon shown in the browser tab and in
                                    Google search results. Square images work best —
                                    a logo mark, monogram, or product close-up.
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div
                                        style={{
                                            width: 64,
                                            height: 64,
                                            borderRadius: 12,
                                            overflow: "hidden",
                                            background: "var(--sx-panel)",
                                            border: "1px solid var(--sx-rule)",
                                            flexShrink: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        {draft?.favicon ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={draft.favicon}
                                                alt="Favicon"
                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                            />
                                        ) : (
                                            <ImageIcon style={{ width: 22, height: 22, opacity: 0.35, color: "var(--sx-ink-mute)" }} />
                                        )}
                                    </div>
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPendingImageField("favicon");
                                                requestAnimationFrame(() => {
                                                    requestAnimationFrame(() => {
                                                        fileInputRef.current?.click();
                                                    });
                                                });
                                            }}
                                            disabled={uploadingPhoto}
                                            style={{
                                                padding: "8px 14px",
                                                background: "var(--sx-accent)",
                                                color: "#052e1f",
                                                border: 0,
                                                borderRadius: 6,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                fontFamily: "var(--sx-sans)",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 6,
                                                justifyContent: "center",
                                            }}
                                        >
                                            {uploadingPhoto && pendingImageField === "favicon" ? (
                                                <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                                            ) : (
                                                <Plus style={{ width: 12, height: 12 }} />
                                            )}
                                            {draft?.favicon ? "Replace favicon" : "Upload favicon"}
                                        </button>
                                        {draft?.favicon && (
                                            <button
                                                type="button"
                                                onClick={() => setDraft((prev: any) => ({ ...prev, favicon: undefined }))}
                                                style={{
                                                    padding: "6px 12px",
                                                    background: "transparent",
                                                    color: "var(--sx-ink-mute)",
                                                    border: "1px solid var(--sx-rule)",
                                                    borderRadius: 6,
                                                    fontSize: 11,
                                                    cursor: "pointer",
                                                    fontFamily: "var(--sx-sans)",
                                                }}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

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
                                Pick a curated color scheme + font pairing. The selection
                                overrides the template's native palette on Save changes.
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

                        {/* Approve — green, only visible when status is pending /
                            in_review / submitted and an Approve handler was passed. */}
                        {onApprove && submissionStatus !== "approved" && submissionStatus !== "rejected" && (
                            <button
                                type="button"
                                className={cx(s.btn, s.btnAccent)}
                                onClick={onApprove}
                                title="Approve submission"
                            >
                                <Check style={{ width: 12, height: 12 }} />
                                Approve
                            </button>
                        )}

                        {/* Reject — red-ish ghost, hidden once already rejected. */}
                        {onReject && submissionStatus !== "rejected" && (
                            <button
                                type="button"
                                className={cx(s.btn, s.btnGhost)}
                                onClick={onReject}
                                title="Reject submission"
                                style={{ color: "var(--sx-bad)" }}
                            >
                                <X style={{ width: 12, height: 12 }} />
                                Reject
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
                                <Loader2 style={{ width: 28, height: 28, color: "#E4B05E" }} className="animate-spin" />
                                Regenerating site…
                                <span style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.12em" }}>
                                    Astro build · usually 30–60s
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ── Editor modals ─────────────────────────────────────── */}
            <LinkPopover
                open={!!linkPopover}
                initial={linkPopover}
                onClose={() => setLinkPopover(null)}
                onSave={handleLinkSave}
            />
            <ImagePickerModal
                open={!!imagePicker}
                field={imagePicker}
                originals={(photos as string[]) ?? []}
                enhanced={(() => {
                    // Prefer parent-resolved URLs (already converted from
                    // Convex storage IDs to https URLs). Fall back to the
                    // raw map in draft / content so the modal still works
                    // if a future flow stores them inline.
                    if (enhancedImageUrls && enhancedImageUrls.length) {
                        const map: Record<string, { url: string }> = {};
                        enhancedImageUrls.forEach((url, i) => {
                            map[`enhanced_${i + 1}`] = { url };
                        });
                        return map;
                    }
                    return (draft as any)?.enhancedImages ?? (content as any)?.enhancedImages;
                })()}
                onClose={() => setImagePicker(null)}
                onSelect={handleImagePick}
            />
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
                                color: "#E4B05E",
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
                                    color: "#E4B05E",
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
                        color: "#E4B05E",
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
