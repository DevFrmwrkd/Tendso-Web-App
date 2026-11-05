"use client";

import { ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";

import type { FieldSpec, GroupSpec, ListSpec } from "@/components/editor/genericContentSchema";
import { Button } from "@/components/v2";
import { joinPath, readWithFallbacks } from "@/lib/ownerEditorFields";
import { FIELD_CLASS, ToolScreen } from "../ui";
import type { Json } from "../types";
import type { OwnerEditorModel } from "../useOwnerEditor";

const isList = (f: FieldSpec | ListSpec): f is ListSpec => (f as ListSpec).kind === "list";

/** First thing typed in a section, for the list row's second line. */
function peek(model: OwnerEditorModel, g: GroupSpec): string {
    for (const f of g.fields) {
        if (isList(f)) continue;
        const v = readWithFallbacks(model.get, f.path, f.fallbackPaths);
        if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
}

/** "Edit text": the page's sections, then the words in one section. */
export function TextTool({ model }: { model: OwnerEditorModel }) {
    // A tap on the page jumps straight to that section (the hook sets it).
    const groupId = model.textGroup;
    const setGroupId = model.setTextGroup;

    const group = model.groups.find((g) => g.id === groupId) ?? null;

    if (!group) {
        return (
            <ToolScreen title="Edit text" hint="Tap a section. Or tap the words on your site." onBack={() => model.setTool(null)}>
                <ul className="flex flex-col gap-2.5">
                    {model.groups.map((g) => {
                        const text = peek(model, g);
                        const first = text.toLowerCase() === g.title.toLowerCase() ? "" : text;
                        return (
                            <li key={g.id}>
                                <button type="button" onClick={() => setGroupId(g.id)} className="flex min-h-[64px] w-full items-center gap-3 rounded-v2-card border border-v2-line bg-v2-canvas px-4 py-3 text-left transition-colors hover:border-[#CFCFC9]">
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[18px] font-medium">{g.title}</span>
                                        {first && <span className="block truncate text-[16px] text-v2-ink-2">{first}</span>}
                                    </span>
                                    <ChevronRight size={22} className="flex-none text-v2-muted" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </ToolScreen>
        );
    }

    return (
        <ToolScreen
            title={group.title}
            onBack={() => setGroupId(null)}
            footer={<Button block size="lg" onClick={() => setGroupId(null)}>Done</Button>}
        >
            <div className="flex flex-col gap-5">
                {group.fields.map((f, i) =>
                    isList(f) ? <ListEditor key={`${group.id}-${i}`} spec={f} model={model} /> : <Scalar key={`${group.id}-${i}`} spec={f} model={model} />,
                )}
            </div>
        </ToolScreen>
    );
}

function Scalar({ spec, model, path, label }: { spec: FieldSpec; model: OwnerEditorModel; path?: string; label?: string }) {
    const p = path ?? spec.path;
    const value = path ? model.get(p) : readWithFallbacks(model.get, spec.path, spec.fallbackPaths);
    const text = value == null ? "" : String(value);
    const area = spec.kind === "textarea";
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-[16px] font-medium text-v2-ink-2">{label ?? spec.label}</span>
            {area ? (
                <textarea className={FIELD_CLASS} rows={4} value={text} onChange={(e) => model.editText(p, e.target.value)} data-field-input={p} />
            ) : (
                <input className={FIELD_CLASS} type="text" value={text} onChange={(e) => model.editText(p, e.target.value)} data-field-input={p} />
            )}
        </label>
    );
}

function ListEditor({ spec, model }: { spec: ListSpec; model: OwnerEditorModel }) {
    const raw = readWithFallbacks(model.get, spec.path, spec.fallbackPaths);
    const rows: Json[] = Array.isArray(raw) ? raw : [];
    const stringRows = spec.itemFields.length === 1 && spec.itemFields[0]!.path === "";
    const canAdd = !spec.fixed && (spec.maxItems === undefined || rows.length < spec.maxItems);
    const changedShape = useChangedShape(rows.length);

    return (
        <div className="flex flex-col gap-3">
            <span className="text-[16px] font-medium text-v2-ink-2">{spec.label}</span>
            {rows.map((_, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-v2-card border border-v2-line bg-v2-quiet p-3.5">
                    {stringRows ? (
                        <Scalar spec={{ ...spec.itemFields[0]!, path: joinPath(spec.path, i) }} path={joinPath(spec.path, i)} label={`${i + 1}`} model={model} />
                    ) : (
                        spec.itemFields.map((sub, s) => (
                            <Scalar key={s} spec={sub} path={joinPath(spec.path, i, sub.path)} label={sub.label} model={model} />
                        ))
                    )}
                    {!spec.fixed && rows.length > 1 && (
                        <button
                            type="button"
                            onClick={() => model.editList(spec.path, rows.filter((_, k) => k !== i))}
                            className="inline-flex h-11 items-center gap-1.5 self-start rounded-full px-3 text-[16px] font-medium text-v2-ink-2 hover:bg-v2-stage"
                        >
                            <X size={18} /> Remove
                        </button>
                    )}
                </div>
            ))}
            {canAdd && (
                <Button
                    variant="ghost"
                    onClick={() => {
                        const blank = spec.newItem !== undefined ? JSON.parse(JSON.stringify(spec.newItem)) : "";
                        model.editList(spec.path, [...rows, blank]);
                    }}
                >
                    <Plus size={18} /> Add another
                </Button>
            )}
            {changedShape && <p className="text-[16px] leading-snug text-v2-ink-2">New and removed items show after you publish.</p>}
        </div>
    );
}

/** True once the number of rows has changed since this editor opened. */
function useChangedShape(count: number): boolean {
    const [first] = useState(count);
    return count !== first;
}
