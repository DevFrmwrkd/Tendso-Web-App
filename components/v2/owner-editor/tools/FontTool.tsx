"use client";

import { useEffect } from "react";

import { FONT_PAIRINGS as THEME_FONTS } from "@/lib/site-theme";
import { Button } from "@/components/v2";
import { Choice, ToolScreen } from "../ui";
import type { OwnerEditorModel } from "../useOwnerEditor";

/** A handful of the editor's pairings, in words an owner would use. */
const FONTS: Array<{ id: string; name: string }> = [
    { id: "modern", name: "Clean" },
    { id: "classic", name: "Classic" },
    { id: "elegant", name: "Elegant" },
    { id: "bold", name: "Strong" },
    { id: "friendly", name: "Friendly" },
    { id: "minimal", name: "Simple" },
];

const HREF = `https://fonts.googleapis.com/css2?${FONTS
    .flatMap((f) => THEME_FONTS[f.id]?.gfontFamily ?? [])
    .map((f) => `family=${f}`)
    .join("&")}&display=swap`;

export function FontTool({ model }: { model: OwnerEditorModel }) {
    // The samples are drawn in the real fonts.
    useEffect(() => {
        if (document.getElementById("owner-font-samples")) return;
        const link = document.createElement("link");
        link.id = "owner-font-samples";
        link.rel = "stylesheet";
        link.href = HREF;
        document.head.appendChild(link);
    }, []);

    const current = model.font;
    const keepsOwn = model.branded;
    return (
        <ToolScreen
            title="Font"
            hint="Tap one. See it on your site."
            onBack={() => model.setTool(null)}
            footer={<Button block size="lg" onClick={() => model.setTool(null)}>Done</Button>}
        >
            <div className="grid grid-cols-2 gap-3">
                {keepsOwn && (
                    <Choice label="Keep this design's font" selected={current === "auto"} onClick={() => model.setFont("auto")} className="col-span-2">
                        <span className="text-[16px] text-v2-ink-2">This design&rsquo;s own</span>
                        <span className="text-[20px] font-medium">Keep it</span>
                    </Choice>
                )}
                {FONTS.map((f) => {
                    const pair = THEME_FONTS[f.id];
                    return (
                        <Choice key={f.id} label={f.name} selected={current === f.id} onClick={() => model.setFont(f.id)}>
                            <span style={{ fontFamily: `"${pair?.heading}", sans-serif` }} className="text-[34px] leading-none">Aa</span>
                            <span style={{ fontFamily: `"${pair?.body}", sans-serif` }} className="text-[18px]">{f.name}</span>
                        </Choice>
                    );
                })}
            </div>
        </ToolScreen>
    );
}
