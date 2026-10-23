"use client";

import { schemesForTemplate } from "@/components/editor/editorConstants";
import { familyOf } from "@/components/editor/templateCatalog";
import { SCHEMES } from "@/lib/site-theme";
import { Button } from "@/components/v2";
import { Choice, ToolScreen } from "../ui";
import type { OwnerEditorModel } from "../useOwnerEditor";

/** Names an owner would say. Ids come from the editor's own list. */
const NAMES: Record<string, string> = {
    blue: "Blue", green: "Green", purple: "Purple", orange: "Orange", dark: "Night", pink: "Pink",
    brown: "Brown", red: "Red", yellow: "Sunny", maroon: "Wine", black: "Black", gold: "Gold",
    whitegold: "White and gold", professional: "Steel",
};

export function ColourTool({ model }: { model: OwnerEditorModel }) {
    const ids = schemesForTemplate(familyOf(model.effectiveCode), model.effectiveCode).filter((id) => SCHEMES[id]);
    return (
        <ToolScreen
            title="Colours"
            hint="Tap one. See it on your site."
            onBack={() => model.setTool(null)}
            footer={<Button block size="lg" onClick={() => model.setTool(null)}>Done</Button>}
        >
            <div className="grid grid-cols-2 gap-3">
                <Choice label="Keep this design's colours" selected={model.scheme === "auto"} onClick={() => model.setScheme("auto")} className="col-span-2">
                    <span className="text-[16px] text-v2-ink-2">This design&rsquo;s own</span>
                    <span className="text-[20px] font-medium">Keep them</span>
                </Choice>
                {ids.map((id) => {
                    const p = SCHEMES[id]!;
                    return (
                        <Choice key={id} label={NAMES[id] ?? id} selected={model.scheme === id} onClick={() => model.setScheme(id)}>
                            <span className="flex">
                                {[p.paper, p.primary, p.ink].map((c, i) => (
                                    <span key={i} className="-ml-2 h-9 w-9 rounded-full border-2 border-white first:ml-0" style={{ background: c, boxShadow: "0 0 0 1px rgba(12,10,8,.12)" }} />
                                ))}
                            </span>
                            <span className="text-[18px] font-medium">{NAMES[id] ?? id}</span>
                        </Choice>
                    );
                })}
            </div>
        </ToolScreen>
    );
}
