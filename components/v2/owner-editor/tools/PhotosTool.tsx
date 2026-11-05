"use client";

import { ImagePlus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/v2";
import { cx } from "@/components/v2/cx";
import { ToolScreen } from "../ui";
import type { OwnerEditorModel } from "../useOwnerEditor";

export function PhotosTool({ model }: { model: OwnerEditorModel }) {
    const { slots } = model;
    // Which photo is open lives in the hook, so a tap on the page can open it.
    const field = model.photoField;
    const setField = model.setPhotoField;

    const { refreshSlots } = model;
    useEffect(() => { refreshSlots(); }, [refreshSlots]);

    const slot = slots.find((s) => s.field === field) ?? null;
    if (!slot) {
        return (
            <ToolScreen title="Photos" hint="Tap a photo to change it." onBack={() => model.setTool(null)} footer={<Button block size="lg" onClick={() => model.setTool(null)}>Done</Button>}>
                {slots.length === 0 ? (
                    <p className="text-[18px] text-v2-ink-2">This design has no photos to change.</p>
                ) : (
                    <ul className="grid grid-cols-2 gap-3">
                        {slots.map((s, i) => (
                            <li key={s.field}>
                                <button type="button" onClick={() => setField(s.field)} aria-label={`Change photo ${i + 1}`} className="block aspect-[4/3] w-full overflow-hidden rounded-v2-card border border-v2-line bg-v2-stage">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={s.src} alt="" className="h-full w-full object-cover" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </ToolScreen>
        );
    }
    return <PhotoPicker model={model} field={slot.field} current={slot.src} onBack={() => setField(null)} />;
}

function PhotoPicker({ model, field, current, onBack }: { model: OwnerEditorModel; field: string; current: string; onBack: () => void }) {
    const file = useRef<HTMLInputElement | null>(null);
    const [error, setError] = useState<string | null>(null);
    const original = model.originalOf(field);
    const mine = model.site.photos;
    const polished = model.site.polished.filter((u) => !mine.includes(u));

    const pick = (url: string) => { setError(null); model.setPhoto(field, url); };
    const upload = async (f: File | undefined) => {
        if (!f) return;
        setError(null);
        try { pick(await model.uploadPhoto(f)); } catch (err) { setError(err instanceof Error ? err.message : "That photo did not upload."); }
    };

    return (
        <ToolScreen title="Change photo" onBack={onBack} footer={<Button block size="lg" onClick={onBack}>Done</Button>}>
            <div className="flex flex-col gap-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={current} alt="" className="aspect-[4/3] w-full rounded-v2-card border border-v2-line object-cover" />
                <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
                <Button variant="dark" size="lg" block onClick={() => file.current?.click()} disabled={model.uploading}>
                    <ImagePlus size={20} /> {model.uploading ? "Uploading…" : "Upload a photo"}
                </Button>
                {error && <p role="alert" className="text-[16px] font-medium text-[#B3261E]">{error}</p>}
                {original && original !== current && (
                    <Button variant="ghost" block onClick={() => pick(original)}><RotateCcw size={18} /> Put the first photo back</Button>
                )}
                {mine.length > 0 && <PhotoRow title="My photos" urls={mine} current={current} onPick={pick} />}
                {polished.length > 0 && <PhotoRow title="Polished by Tendso" urls={polished} current={current} onPick={pick} />}
            </div>
        </ToolScreen>
    );
}

function PhotoRow({ title, urls, current, onPick }: { title: string; urls: string[]; current: string; onPick: (u: string) => void }) {
    return (
        <div className="flex flex-col gap-2">
            <span className="text-[16px] font-medium text-v2-ink-2">{title}</span>
            <ul className="grid grid-cols-3 gap-2">
                {urls.map((u, i) => (
                    <li key={u}>
                        <button type="button" onClick={() => onPick(u)} aria-label={`${title} ${i + 1}`} className={cx("block aspect-square w-full overflow-hidden rounded-[14px] border-2", u === current ? "border-v2-ink" : "border-transparent")}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt="" className="h-full w-full object-cover" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
