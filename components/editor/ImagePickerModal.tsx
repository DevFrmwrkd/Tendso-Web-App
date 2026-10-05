"use client";

/**
 * ImagePickerModal — opens when the iframe emits `ed:image-click`.
 *
 * Two tabs:
 *   • Original photos — the creator's submission photos
 *   • AI-enhanced    — output of the Airtable AI / Sandbox Enhance pipeline,
 *                      keyed by slot (e.g. `headshot`, `exterior`, `interior_1`)
 *
 * Selecting an image:
 *   1. Sends `ed:image` to the iframe so the preview updates immediately.
 *   2. Calls onSelect(src) so the parent can persist the URL into the
 *      draft content (e.g. set draft.hero.image = src).
 *
 * Round 1: a kit Dialog (native <dialog>: focus trap, Esc, scrim) with kit
 * tabs. Which tab opens first is unchanged: AI-enhanced only when there are
 * no originals but there are enhanced images.
 */

import { useMemo, useState } from "react";
import { Button, Dialog, Tabs } from "@/components/r1";

export interface ImagePickerModalProps {
    open: boolean;
    /** The `data-image-field` value the iframe sent us. */
    field: string | null;
    /** Original-photo URLs from the submission. */
    originals: string[];
    /** Enhanced image map: { slot: { url } | url } */
    enhanced: Record<string, unknown> | undefined;
    onClose: () => void;
    onSelect: (field: string, src: string) => void;
}

type Tab = 'originals' | 'enhanced';

function enhancedToList(enhanced: Record<string, unknown> | undefined): Array<{ slot: string; url: string }> {
    if (!enhanced || typeof enhanced !== 'object') return [];
    const out: Array<{ slot: string; url: string }> = [];
    for (const [slot, val] of Object.entries(enhanced)) {
        if (!val) continue;
        let url: unknown;
        if (typeof val === 'string') url = val;
        else if (typeof val === 'object') url = (val as { url?: unknown }).url || (val as { storageId?: unknown }).storageId;
        if (url && typeof url === 'string' && /^https?:\/\//i.test(url)) {
            out.push({ slot, url });
        }
    }
    return out;
}

export default function ImagePickerModal({ open, field, originals, enhanced, onClose, onSelect }: ImagePickerModalProps) {
    const enhancedList = useMemo(() => enhancedToList(enhanced), [enhanced]);
    // The admin's own tab choice for this opening; null = the default.
    // Cleared on the way out (close or pick), so every opening starts on the
    // default again.
    const [chosenTab, setChosenTab] = useState<Tab | null>(null);
    // Prefer the enhanced tab if there are no originals but there are enhanced.
    const tab: Tab = chosenTab ?? (originals.length === 0 && enhancedList.length > 0 ? 'enhanced' : 'originals');

    const close = () => {
        setChosenTab(null);
        onClose();
    };

    const isOpen = open && !!field;
    const gridTiles = tab === 'originals'
        ? originals.map((url) => ({ key: url, url, slot: undefined as string | undefined }))
        : enhancedList.map((e) => ({ key: e.slot, url: e.url, slot: e.slot }));

    return (
        <Dialog
            open={isOpen}
            onClose={close}
            title="Choose an image"
            className="w-[min(760px,calc(100vw_-_32px))]"
            footer={<Button onClick={close}>Cancel</Button>}
        >
            {field && (
                <>
                    <p className="t-mono text-r1-ink-3">{field}</p>
                    <Tabs
                        label="Image source"
                        tabs={[
                            { value: 'originals', label: 'Originals', count: originals.length },
                            { value: 'enhanced', label: 'AI-enhanced', count: enhancedList.length },
                        ]}
                        value={tab}
                        onChange={(t) => setChosenTab(t)}
                    >
                        {gridTiles.length === 0 ? (
                            <p className="t-meta py-10 text-center">
                                {tab === 'originals'
                                    ? 'No original photos uploaded yet. Upload some in the Media tab of the editor.'
                                    : 'No AI-enhanced images yet. Run Enhance photos to produce optimised versions.'}
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {gridTiles.map((tile, i) => (
                                    <button
                                        key={tile.key}
                                        type="button"
                                        onClick={() => {
                                            setChosenTab(null);
                                            onSelect(field, tile.url);
                                        }}
                                        title={tile.slot ? `Slot: ${tile.slot}` : tile.url}
                                        className="relative aspect-[4/3] cursor-pointer overflow-hidden rounded-r1 border border-r1-line bg-r1-fill-2 p-0 hover:border-r1-ink"
                                    >
                                        {/* Photos live on storage and R2 hosts that next/image is not set up for. */}
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={tile.url}
                                            alt={tile.slot ? `AI-enhanced image, ${tile.slot}` : `Photo ${i + 1}`}
                                            loading="lazy"
                                            className="block h-full w-full object-cover"
                                        />
                                        {tile.slot && (
                                            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-r1-ink/80 px-2 py-0.5 font-r1-mono text-[10px] font-medium uppercase tracking-wide text-r1-paper">
                                                {tile.slot}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </Tabs>
                </>
            )}
        </Dialog>
    );
}
