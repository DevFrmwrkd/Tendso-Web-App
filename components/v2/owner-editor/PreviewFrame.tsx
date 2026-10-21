"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { BLOCK_TIER } from "@/components/editor/templateCatalog";
import type { OwnerEditorModel } from "./useOwnerEditor";
import { applyTheme, composePreview, post } from "./previewHtml";

export type Device = "phone" | "computer";

const WIDTHS: Record<Device, number> = { phone: 390, computer: 1280 };

/**
 * The live preview: the owner's page in an iframe, scaled to fit. Text, photos,
 * colours, font and hidden sections change here at once; a new design arrives as
 * a freshly built page. Taps on the page open the matching screen.
 */
export function PreviewFrame({ model, device }: { model: OwnerEditorModel; device: Device }) {
    const { iframeRef, pageHtml, order, scheme, font, businessType, branded, m } = model;
    const box = useRef<HTMLDivElement | null>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    useLayoutEffect(() => {
        const el = box.current;
        if (!el) return;
        const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
        read();
        const ro = new ResizeObserver(read);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const srcDoc = useMemo(() => composePreview(pageHtml, order), [pageHtml, order]);

    const visibility = m.draft?.visibility;
    const applyAll = useCallback(() => {
        const frame = iframeRef.current;
        applyTheme(frame, scheme, font, businessType, branded);
        for (const b of model.allBlocks) {
            if ((BLOCK_TIER[b.name] ?? "extra") === "essential") continue;
            post(frame, { type: "ed:section-visibility", block: b.visKey, visible: m.isBlockEnabled(b.visKey) });
        }
        model.fillPage();
        model.refreshSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [iframeRef, scheme, font, businessType, branded, model.fillPage, model.refreshSlots, m]);

    // Re-apply when the choice changes without a page reload.
    useEffect(() => { applyTheme(iframeRef.current, scheme, font, businessType, branded); }, [iframeRef, scheme, font, businessType, branded]);
    useEffect(() => {
        for (const b of model.allBlocks) {
            if ((BLOCK_TIER[b.name] ?? "extra") === "essential") continue;
            post(iframeRef.current, { type: "ed:section-visibility", block: b.visKey, visible: visibility?.[b.visKey] !== false });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibility]);

    // Taps on the page.
    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            if (e.source !== iframeRef.current?.contentWindow) return;
            const d = e.data;
            if (!d || typeof d !== "object") return;
            if (d.type === "ed:image-click" && typeof d.field === "string") {
                model.openPhotoField(d.field);
            } else if ((d.type === "ed:click" || d.type === "ed:link-click") && typeof d.field === "string") {
                model.openTextField(d.field);
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [iframeRef, model]);

    const width = WIDTHS[device];
    const scale = size.w ? Math.min(1, size.w / width) : 1;
    const height = size.h ? size.h / scale : 640;

    return (
        <div ref={box} className="relative h-full w-full overflow-hidden" data-testid="owner-preview">
            <div
                className={device === "phone" ? "absolute left-1/2 top-0 overflow-hidden rounded-[22px] bg-white shadow-v2-object" : "absolute left-0 top-0 overflow-hidden bg-white"}
                style={{ width: width * scale, height: size.h, marginLeft: device === "phone" ? -(width * scale) / 2 : 0 }}
            >
                <iframe
                    ref={iframeRef}
                    title="Your website"
                    srcDoc={srcDoc}
                    onLoad={applyAll}
                    style={{ width, height, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", display: "block", background: "#fff" }}
                />
            </div>
        </div>
    );
}
