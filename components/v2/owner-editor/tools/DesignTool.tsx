"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { familyOf, type TemplateDef } from "@/components/editor/templateCatalog";
import { injectEditorBridge } from "@/components/editor/editorBridge";
import { Button } from "@/components/v2";
import { cx } from "@/components/v2/cx";
import { ToolScreen } from "../ui";
import type { OwnerEditorModel } from "../useOwnerEditor";

const CARD_W = 232;
const CARD_H = 380;
const GAP = 14;
/** How long a design must stay in view before we build the owner's page in it. */
const DWELL_MS = 1100;

/**
 * "Change design": swipe through the real designs. A design shows the owner's
 * own words and photos once its page has been built for them (a moment after it
 * stays in view); until then it shows the design with sample words, and says so.
 */
export function DesignTool({ model }: { model: OwnerEditorModel }) {
    const templates = useMemo(() => orderTemplates(model.allTemplates, model.effectiveCode), [model.allTemplates, model.effectiveCode]);
    const track = useRef<HTMLDivElement | null>(null);
    const [index, setIndex] = useState(() => Math.max(0, templates.findIndex((t) => t.code === model.effectiveCode)));

    // Start on the design in use.
    useEffect(() => {
        const el = track.current;
        if (el) el.scrollLeft = index * (CARD_W + GAP);
        // only on open
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onScroll = () => {
        const el = track.current;
        if (!el) return;
        const next = Math.round(el.scrollLeft / (CARD_W + GAP));
        setIndex((cur) => (cur === next ? cur : Math.min(Math.max(next, 0), templates.length - 1)));
    };

    const focused = templates[index];
    const { requestDesign } = model;
    useEffect(() => {
        if (!focused || focused.code === model.baseCode) return;
        const t = window.setTimeout(() => requestDesign(focused.code), DWELL_MS);
        return () => window.clearTimeout(t);
    }, [focused, model.baseCode, requestDesign]);

    const inUse = focused?.code === model.effectiveCode;
    const status = focused ? model.designState[focused.code] : undefined;
    const yours = !!focused && (focused.code === model.baseCode || status === "ready");

    return (
        <ToolScreen
            title="Change design"
            hint="Swipe. Your words and photos stay."
            onBack={() => model.setTool(null)}
            footer={
                <Button block size="lg" disabled={!focused || inUse} onClick={() => { if (focused) { model.chooseDesign(focused.code); model.setTool(null); } }}>
                    {inUse ? "In use" : "Use this design"}
                </Button>
            }
        >
            <div
                ref={track}
                onScroll={onScroll}
                className="-mx-5 flex snap-x snap-mandatory gap-[14px] overflow-x-auto px-5 pb-2 [scrollbar-width:none]"
                style={{ scrollPaddingLeft: 20 }}
            >
                {templates.map((t, i) => (
                    <Card key={t.code} t={t} near={Math.abs(i - index) <= 1} model={model} active={i === index} />
                ))}
            </div>
            <div className="mt-3 flex min-h-[56px] flex-col gap-0.5">
                <p className="text-[18px] font-medium">{focused?.label}</p>
                <p className="text-[16px] leading-snug text-v2-ink-2">
                    {yours ? "Showing your words and photos." : status === "error" ? "Could not load yours. Sample words shown." : status === "building" ? "Putting your words in…" : "Sample words shown."}
                </p>
            </div>
        </ToolScreen>
    );
}

function orderTemplates(all: TemplateDef[], current: string): TemplateDef[] {
    const fam = familyOf(current);
    const head = all.filter((t) => t.code === current);
    const same = all.filter((t) => t.code !== current && fam && familyOf(t.code) === fam);
    const rest = all.filter((t) => t.code !== current && !(fam && familyOf(t.code) === fam));
    return [...head, ...same, ...rest];
}

const staticCache = new Map<string, string>();

function Card({ t, near, model, active }: { t: TemplateDef; near: boolean; model: OwnerEditorModel; active: boolean }) {
    const built = t.code === model.baseCode ? model.site.html : model.designs[t.code];
    const [sample, setSample] = useState<string | null>(staticCache.get(t.code) ?? null);

    // The design's own sample page, only for cards near the one in view.
    useEffect(() => {
        if (!near || built || sample) return;
        let off = false;
        fetch(t.preview).then((r) => (r.ok ? r.text() : "")).then((html) => {
            if (off || !html) return;
            const doc = injectEditorBridge(html);
            staticCache.set(t.code, doc);
            setSample(doc);
        }).catch(() => undefined);
        return () => { off = true; };
    }, [near, built, sample, t]);

    const doc = built ? injectEditorBridge(built) : sample;
    const scale = CARD_W / 390;
    return (
        <div
            className={cx("relative flex-none snap-start overflow-hidden rounded-[26px] border-2 bg-v2-stage", active ? "border-v2-ink" : "border-v2-line")}
            style={{ width: CARD_W, height: CARD_H }}
            aria-label={t.label}
        >
            {near && doc ? (
                <iframe
                    title={t.label}
                    srcDoc={doc}
                    tabIndex={-1}
                    style={{ width: 390, height: CARD_H / scale, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none", background: "#fff" }}
                />
            ) : (
                <div className="flex h-full items-center justify-center text-[16px] text-v2-muted">{near ? "Loading…" : ""}</div>
            )}
            {t.code === model.effectiveCode && (
                <span className="absolute bottom-3 left-3 inline-flex h-8 items-center gap-1 rounded-full bg-v2-ink px-3 text-[15px] font-medium text-white"><Check size={16} /> In use</span>
            )}
        </div>
    );
}
