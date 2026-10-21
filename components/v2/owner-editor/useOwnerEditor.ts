"use client";

/**
 * useOwnerEditor — everything the owner's editor does, on top of the admin
 * editor's own draft hook (useEditorDraft: normalised content, undo/redo,
 * template pick, scheme/font, section toggles). The screens in this folder are
 * only drawing; the rules live here.
 *
 *   · autosave: the owner's working copy is kept on the server a moment after
 *     each change. It never touches the live site.
 *   · design: choosing a design builds the owner's real page in that design
 *     (the server preview build, about a minute) and shows it; the choice is
 *     only applied to the site on Publish.
 *   · publish: save, build for real, and — if the site is live — it is live.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SandboxEditorProps } from "@/components/editor/editorProps";
import { normalizeDraft, useEditorDraft } from "@/components/editor/useEditorDraft";
import { applyImageSlot } from "@/components/editor/editorImageSlots";
import { listSafeSetValue, rowWriteFromSchema } from "@/components/editor/listRowWrites";
import { groupsForTemplate } from "@/components/editor/ContentFieldsAuto";
import { ALL_BLOCKS, VIS_KEY_BY_BLOCK } from "@/components/editor/editorConstants";
import { ALL_TEMPLATES, familyOf, sectionsForTemplate } from "@/components/editor/templateCatalog";
import { deriveContentDefaults, getDerivedAt } from "@/lib/derive-content-defaults";
import { ESSENTIAL_BLOCKS, PINNED_BLOCKS, cleanSectionOrder, cleanText, sameJson, templateBlocks } from "@/lib/ownerSiteEdits";
import { ownerGroups, textFillMessages } from "@/lib/ownerEditorFields";
import { movableBlocks } from "@/lib/sectionOrder";

import { post, readPhotoSlots, type PhotoSlot } from "./previewHtml";
import type { Json, OwnerEditorActions, OwnerSite, PublishResult, ToolId } from "./types";

export type SaveState = "idle" | "saving" | "saved" | "error";
export type DesignState = "building" | "ready" | "error";
export type PublishState =
    | { phase: "idle" }
    | { phase: "working" }
    | { phase: "done"; result: PublishResult }
    | { phase: "error"; message: string };

const AUTOSAVE_MS = 900;

const customsOf = (c: Json) => ({
    template: String(c?.heroStyle ?? ""),
    scheme: String(c?.colorScheme ?? c?.colorSchemeId ?? "auto"),
    font: String(c?.fontPairing ?? c?.fontPairingId ?? "modern"),
});

export function useOwnerEditor(site: OwnerSite, actions: OwnerEditorActions) {
    // The editor opens on the owner's saved copy and stays on it; the draft hook
    // owns the working state from here.
    const initial = useRef(site.saved);
    const m = useEditorDraft({
        submissionId: site.submissionId,
        businessName: site.businessName,
        businessType: site.businessType,
        content: initial.current.content,
        customizations: initial.current.customizations,
    } as unknown as SandboxEditorProps);

    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [tool, setTool] = useState<ToolId | null>(null);
    // Which section of Edit text / which photo is open inside its screen.
    const [textGroup, setTextGroup] = useState<string | null>(null);
    const [photoField, setPhotoField] = useState<string | null>(null);
    /** Open a screen from the home buttons: always at its top. */
    const openTool = useCallback((id: ToolId) => { setTextGroup(null); setPhotoField(null); setTool(id); }, []);

    // ── What the owner's draft says, with the same fallbacks the page uses ──
    const derived = useMemo(() => deriveContentDefaults({
        business_name: m.draft?.business_name || site.businessName,
        business_city: m.draft?.business_city || m.draft?.contact?.city,
        business_type: m.draft?.business_type || site.businessType,
        tagline: m.draft?.tagline,
        about: m.draft?.about,
        contact: m.draft?.contact,
    }, site.photos), [m.draft, site.businessName, site.businessType, site.photos]);

    const get = useCallback((path: string): Json => {
        const v = m.getValue(path);
        if (v !== undefined && v !== null && v !== "") return v;
        return getDerivedAt(derived, path);
    }, [m, derived]);
    const getRef = useRef(get);
    getRef.current = get;

    const mRef = useRef(m);
    mRef.current = m;
    const writeValue = useMemo(
        () => listSafeSetValue((p) => getRef.current(p), (p, v) => mRef.current.setValue(p, v)),
        [],
    );

    // ── Design: template, colours, font, sections ───────────────────────────
    const baseCode = String(site.base.customizations?.heroStyle ?? "");
    const code = m.currentHeroStyle;
    const [order, setOrder] = useState<string[]>(() => cleanSectionOrder(site.saved.customizations?.sectionOrder, code || baseCode));
    const customizations = useMemo(() => {
        const c: Json = { ...(m.effectiveCustomizations ?? {}) };
        delete c.sectionOrder;
        if (order.length) c.sectionOrder = order;
        return c;
    }, [m.effectiveCustomizations, order]);

    // ── Autosave ────────────────────────────────────────────────────────────
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const lastSaved = useRef<string | null>(null);
    const saveKey = JSON.stringify([m.draft, customizations]);
    const latest = useRef({ draft: m.draft, customizations, key: saveKey });
    latest.current = { draft: m.draft, customizations, key: saveKey };
    const saving = useRef<Promise<void> | null>(null);

    const flushSave = useCallback(async () => {
        if (saving.current) await saving.current.catch(() => undefined);
        const { draft, customizations: cust, key } = latest.current;
        if (lastSaved.current === null || key === lastSaved.current) { lastSaved.current ??= key; return; }
        setSaveState("saving");
        const run = (async () => {
            try {
                await actions.saveDraft(draft, cust);
                lastSaved.current = key;
                setSaveState("saved");
            } catch (err) {
                setSaveState("error");
                throw err;
            } finally {
                saving.current = null;
            }
        })();
        saving.current = run;
        await run;
    }, [actions]);

    useEffect(() => {
        if (lastSaved.current === null) { lastSaved.current = saveKey; return; } // opening is not a change
        if (saveKey === lastSaved.current) return;
        const t = window.setTimeout(() => { flushSave().catch(() => undefined); }, AUTOSAVE_MS);
        return () => window.clearTimeout(t);
    }, [saveKey, flushSave]);

    // ── Published page and changes since ────────────────────────────────────
    const [liveHtml, setLiveHtml] = useState(site.html);
    const [baseline, setBaseline] = useState(() => ({
        content: normalizeDraft(site.base.content),
        cust: customsOf(site.base.customizations),
        order: cleanSectionOrder(site.base.customizations?.sectionOrder, baseCode),
    }));
    const now = customsOf(customizations);
    const hasChanges =
        !sameJson(m.draft, baseline.content) ||
        now.template !== baseline.cust.template ||
        now.scheme !== baseline.cust.scheme ||
        now.font !== baseline.cust.font ||
        !sameJson(order, baseline.order);

    // ── The page on screen: live page, or the owner's page in another design ─
    const [designs, setDesigns] = useState<Record<string, string>>({});
    const [designState, setDesignState] = useState<Record<string, DesignState>>({});
    const queue = useRef<Promise<void>>(Promise.resolve());
    const pending = useRef(new Set<string>());

    const requestDesign = useCallback((templateCode: string) => {
        if (!templateCode || templateCode === baseCode || pending.current.has(templateCode)) return;
        pending.current.add(templateCode);
        setDesignState((s) => ({ ...s, [templateCode]: "building" }));
        // One build at a time: the builder shares a working folder.
        queue.current = queue.current.then(async () => {
            try {
                await flushSave().catch(() => undefined);
                const html = await actions.buildPreview(templateCode);
                setDesigns((d) => ({ ...d, [templateCode]: html }));
                setDesignState((s) => ({ ...s, [templateCode]: "ready" }));
            } catch {
                setDesignState((s) => ({ ...s, [templateCode]: "error" }));
            } finally {
                pending.current.delete(templateCode);
            }
        });
    }, [actions, baseCode, flushSave]);

    const showingBase = !code || code === baseCode;
    // While a new design is being made, the page on screen stays the live one.
    const pageHtml = showingBase ? liveHtml : (designs[code] ?? liveHtml);
    const waitingForDesign = !showingBase && !designs[code];
    const designError = waitingForDesign && designState[code] === "error";
    const retryDesign = useCallback((templateCode: string) => {
        setDesignState((s) => { const next = { ...s }; delete next[templateCode]; return next; });
        requestDesign(templateCode);
    }, [requestDesign]);

    // Choosing a design: builds it if needed. The draft changes at once; the
    // site does not change until Publish.
    const chooseDesign = useCallback((templateCode: string) => {
        mRef.current.onPickTemplate(templateCode);
        setOrder([]);
        requestDesign(templateCode);
    }, [requestDesign]);

    // ── Sections ────────────────────────────────────────────────────────────
    const effectiveCode = code || baseCode;
    const templateSections = useMemo(() => sectionsForTemplate(effectiveCode), [effectiveCode]);
    const movable = useMemo(() => new Set(movableBlocks(pageHtml)), [pageHtml]);
    const orderedSections = useMemo(() => {
        const base = templateBlocks(effectiveCode);
        const byBlock = new Map(templateSections.map((s) => [s.block, s]));
        const movableOrder = (order.length ? order : base).filter((b) => movable.has(b));
        // Movable sections take the owner's order inside their own slots; the rest stay.
        const slots = base.map((b, i) => (movable.has(b) ? i : -1)).filter((i) => i >= 0);
        const merged = base.slice();
        slots.forEach((slot, n) => { if (movableOrder[n]) merged[slot] = movableOrder[n]!; });
        return merged
            .filter((b) => byBlock.has(b) && b !== "HEADER")
            .map((b) => {
                const s = byBlock.get(b)!;
                const visKey = VIS_KEY_BY_BLOCK[b];
                return {
                    block: b,
                    label: s.label,
                    blurb: s.blurb,
                    visKey,
                    visible: visKey ? m.isBlockEnabled(visKey) : true,
                    essential: (ESSENTIAL_BLOCKS as readonly string[]).includes(b),
                    pinned: (PINNED_BLOCKS as readonly string[]).includes(b),
                    movable: movable.has(b),
                };
            });
    }, [effectiveCode, templateSections, movable, order, m]);

    const moveSection = useCallback((block: string, dir: -1 | 1) => {
        const base = templateBlocks(effectiveCode).filter((b) => movable.has(b) && !(PINNED_BLOCKS as readonly string[]).includes(b));
        const current = (order.length ? order : base).filter((b) => base.includes(b));
        const full = [...current, ...base.filter((b) => !current.includes(b))];
        const i = full.indexOf(block);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= full.length) return;
        [full[i], full[j]] = [full[j]!, full[i]!];
        setOrder(cleanSectionOrder(full, effectiveCode));
    }, [effectiveCode, movable, order]);

    // ── Text ────────────────────────────────────────────────────────────────
    const groups = useMemo(() => {
        const hasValue = (p: string) => { const v = getRef.current(p); return v !== undefined && v !== null && v !== ""; };
        const rowHasValue = (listPath: string, key: string) => {
            const rows = getRef.current(listPath);
            return Array.isArray(rows) && rows.some((r) => { const v = key ? r?.[key] : r; return v !== undefined && v !== null && v !== ""; });
        };
        return ownerGroups(groupsForTemplate(effectiveCode || undefined, hasValue, rowHasValue));
        // Computed per design, not per keystroke: a field must not vanish while it is being emptied.
    }, [effectiveCode]);

    const editText = useCallback((path: string, value: string) => {
        writeValue(path, value);
        post(iframeRef.current, { type: "ed:update", field: path, value: cleanText(value) });
    }, [writeValue]);
    /** A whole-list change (add / remove a row). The page shows it after Publish. */
    const editList = useCallback((path: string, rows: Json[]) => { writeValue(path, rows); }, [writeValue]);

    const fillPage = useCallback(() => {
        for (const msg of textFillMessages(groups, (p) => getRef.current(p))) {
            post(iframeRef.current, { ...msg, value: cleanText(msg.value) });
        }
    }, [groups]);

    // ── Photos ──────────────────────────────────────────────────────────────
    const [slots, setSlots] = useState<PhotoSlot[]>([]);
    const firstSlots = useRef<Record<string, string>>({});
    const refreshSlots = useCallback(() => {
        const next = readPhotoSlots(iframeRef.current);
        for (const s of next) firstSlots.current[s.field] ??= s.src;
        setSlots(next);
    }, []);
    const originalOf = (field: string) => firstSlots.current[field];

    const [uploading, setUploading] = useState(false);
    /** Upload a photo from the owner's phone or computer; resolves to its address. */
    const uploadPhoto = useCallback(async (file: File): Promise<string> => {
        if (!file.type.startsWith("image/")) throw new Error("Please choose a photo.");
        if (file.size > 10 * 1024 * 1024) throw new Error("That photo is too big. Please use one under 10 MB.");
        setUploading(true);
        try { return await actions.uploadPhoto(file); } finally { setUploading(false); }
    }, [actions]);

    const setPhoto = useCallback((field: string, url: string) => {
        const write = rowWriteFromSchema((p) => getRef.current(p), field, url);
        if (write) mRef.current.setValue(write.path, write.value);
        else mRef.current.replaceDraft(applyImageSlot(mRef.current.draftRef.current, field, url));
        post(iframeRef.current, { type: "ed:image", field, src: url });
        setSlots((list) => list.map((s) => (s.field === field ? { ...s, src: url } : s)));
    }, []);

    // ── Publish ─────────────────────────────────────────────────────────────
    const [publishState, setPublishState] = useState<PublishState>({ phase: "idle" });
    const publish = useCallback(async () => {
        setPublishState({ phase: "working" });
        try {
            await flushSave();
            const result = await actions.publish();
            if (result.html) setLiveHtml(result.html);
            setDesigns({});
            setDesignState({});
            const cur = latest.current;
            setBaseline({ content: cur.draft, cust: customsOf(cur.customizations), order: cleanSectionOrder(cur.customizations.sectionOrder, String(cur.customizations.heroStyle ?? baseCode)) });
            setPublishState({ phase: "done", result });
        } catch (err) {
            setPublishState({ phase: "error", message: err instanceof Error && err.message ? err.message : "Something went wrong. Nothing was changed." });
        }
    }, [actions, baseCode, flushSave]);

    // The preview for a design that is not the live one needs its build; ask for it.
    useEffect(() => {
        if (!showingBase && code) requestDesign(code);
    }, [showingBase, code, requestDesign]);

    // Which section of the Edit-text screen holds a tapped field.
    const groupForField = useCallback((field: string) => {
        return groups.find((g) => g.fields.some((f) => field === f.path || field.startsWith(`${f.path}.`) || (f as { hrefPath?: string }).hrefPath === field))?.id ?? null;
    }, [groups]);

    /** A tap on words on the page: that section of Edit text. */
    const openTextField = useCallback((field: string) => { setTextGroup(groupForField(field)); setTool("text"); }, [groupForField]);
    /** A tap on a photo on the page: that photo's screen. */
    const openPhotoField = useCallback((field: string) => { setPhotoField(field); setTool("photos"); }, []);

    return {
        m, site, iframeRef,
        tool, setTool, openTool, openTextField, openPhotoField, textGroup, setTextGroup, photoField, setPhotoField,
        get, editText, editList, writeValue, fillPage, groups,
        // design
        code, baseCode, effectiveCode, chooseDesign, requestDesign, retryDesign, designs, designState, pageHtml, waitingForDesign, designError, showingBase,
        scheme: m.currentScheme, font: m.currentFont, setScheme: (id: string) => m.setThemeField("colorScheme", id), setFont: (id: string) => m.setThemeField("fontPairing", id),
        // sections
        order, orderedSections, moveSection, toggleSection: (visKey: string) => m.toggleBlock(visKey),
        // photos
        slots, refreshSlots, setPhoto, originalOf, uploadPhoto, uploading,
        // saving / publishing
        saveState, flushSave, hasChanges, publish, publishState, resetPublish: () => setPublishState({ phase: "idle" }),
        businessType: site.businessType,
        branded: !!code && familyOf(code) !== "generic",
        allTemplates: ALL_TEMPLATES,
        allBlocks: ALL_BLOCKS,
    };
}

export type OwnerEditorModel = ReturnType<typeof useOwnerEditor>;
