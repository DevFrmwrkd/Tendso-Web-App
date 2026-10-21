"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import { Button } from "@/components/v2";
import { cx } from "@/components/v2/cx";
import { ToolScreen } from "../ui";
import type { OwnerEditorModel } from "../useOwnerEditor";

export function SectionsTool({ model }: { model: OwnerEditorModel }) {
    const rows = model.orderedSections;
    const movableRows = rows.filter((r) => r.movable && !r.pinned);
    return (
        <ToolScreen
            title="Sections"
            hint="Move them. Hide what you don't need."
            onBack={() => model.setTool(null)}
            footer={<Button block size="lg" onClick={() => model.setTool(null)}>Done</Button>}
        >
            <ul className="flex flex-col gap-2.5">
                {rows.map((r) => {
                    const idx = movableRows.findIndex((x) => x.block === r.block);
                    const canMove = r.movable && !r.pinned;
                    return (
                        <li key={r.block} className={cx("flex items-center gap-2 rounded-v2-card border border-v2-line bg-v2-canvas py-2.5 pl-4 pr-2.5", !r.visible && "bg-v2-quiet")}>
                            <span className={cx("min-w-0 flex-1 truncate text-[18px] font-medium", !r.visible && "text-v2-muted line-through")}>{r.label}</span>
                            {canMove && (
                                <span className="flex flex-none gap-1.5">
                                    <button type="button" aria-label={`Move ${r.label} up`} disabled={idx <= 0} onClick={() => model.moveSection(r.block, -1)} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-v2-stage disabled:opacity-30"><ArrowUp size={20} /></button>
                                    <button type="button" aria-label={`Move ${r.label} down`} disabled={idx >= movableRows.length - 1} onClick={() => model.moveSection(r.block, 1)} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-v2-stage disabled:opacity-30"><ArrowDown size={20} /></button>
                                </span>
                            )}
                            {r.essential || !r.visKey ? (
                                <span className="flex-none whitespace-nowrap pr-2 text-right text-[16px] text-v2-muted">Always on</span>
                            ) : (
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={r.visible}
                                    aria-label={`${r.visible ? "Hide" : "Show"} ${r.label}`}
                                    onClick={() => model.toggleSection(r.visKey!)}
                                    className={cx("relative h-9 w-[64px] flex-none rounded-full transition-colors", r.visible ? "bg-v2-ink" : "bg-[#D9D9D4]")}
                                >
                                    <span className={cx("absolute top-1 h-7 w-7 rounded-full bg-white transition-all", r.visible ? "left-[32px]" : "left-1")} />
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
            {movableRows.length < rows.length - 2 && (
                <p className="mt-4 text-[16px] leading-snug text-v2-ink-2">Some parts stay where this design puts them.</p>
            )}
        </ToolScreen>
    );
}
