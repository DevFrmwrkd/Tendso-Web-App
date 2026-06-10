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
 */

import { useEffect, useMemo, useState } from "react";

export interface ImagePickerModalProps {
    open: boolean;
    /** The `data-image-field` value the iframe sent us. */
    field: string | null;
    /** Original-photo URLs from the submission. */
    originals: string[];
    /** Enhanced image map: { slot: { url } | url } */
    enhanced: Record<string, any> | undefined;
    onClose: () => void;
    onSelect: (field: string, src: string) => void;
}

type Tab = 'originals' | 'enhanced';

function enhancedToList(enhanced: Record<string, any> | undefined): Array<{ slot: string; url: string }> {
    if (!enhanced || typeof enhanced !== 'object') return [];
    const out: Array<{ slot: string; url: string }> = [];
    for (const [slot, val] of Object.entries(enhanced)) {
        if (!val) continue;
        let url: string | undefined;
        if (typeof val === 'string') url = val;
        else if (typeof val === 'object') url = (val as any).url || (val as any).storageId;
        if (url && typeof url === 'string' && /^https?:\/\//i.test(url)) {
            out.push({ slot, url });
        }
    }
    return out;
}

export default function ImagePickerModal({ open, field, originals, enhanced, onClose, onSelect }: ImagePickerModalProps) {
    const enhancedList = useMemo(() => enhancedToList(enhanced), [enhanced]);
    const [tab, setTab] = useState<Tab>('originals');

    useEffect(() => {
        if (open) {
            // Prefer the enhanced tab if there are no originals but there are enhanced.
            if (originals.length === 0 && enhancedList.length > 0) {
                setTab('enhanced');
            } else {
                setTab('originals');
            }
        }
    }, [open, originals.length, enhancedList.length]);

    if (!open || !field) return null;

    const gridTiles = tab === 'originals'
        ? originals.map((url) => ({ key: url, url, slot: undefined as string | undefined }))
        : enhancedList.map((e) => ({ key: e.slot, url: e.url, slot: e.slot }));

    return (
        <div
            role="dialog"
            aria-label="Pick an image"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: 'rgba(15,23,42,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 900,
                    maxHeight: '88vh',
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748b' }}>
                            Pick an image
                        </div>
                        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, fontFamily: 'ui-monospace, monospace' }}>
                            {field}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            fontSize: 22,
                            padding: 0,
                            lineHeight: 1,
                        }}
                    >×</button>
                </div>

                <div style={{ display: 'flex', gap: 4, padding: '12px 24px 0', borderBottom: '1px solid #e2e8f0' }}>
                    {(['originals', 'enhanced'] as Tab[]).map((t) => {
                        const isActive = tab === t;
                        const count = t === 'originals' ? originals.length : enhancedList.length;
                        return (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                style={{
                                    padding: '10px 16px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: isActive ? '#0f172a' : '#64748b',
                                    fontWeight: isActive ? 700 : 500,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    borderBottom: isActive ? '2px solid #E4B05E' : '2px solid transparent',
                                    marginBottom: -1,
                                }}
                            >
                                {t === 'originals' ? 'Originals' : 'AI-enhanced'}
                                <span style={{
                                    marginLeft: 8,
                                    fontSize: 11,
                                    color: '#94a3b8',
                                    background: '#f1f5f9',
                                    padding: '2px 7px',
                                    borderRadius: 999,
                                    fontWeight: 600,
                                }}>{count}</span>
                            </button>
                        );
                    })}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    {gridTiles.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px 20px', fontSize: 14 }}>
                            {tab === 'originals'
                                ? 'No original photos uploaded yet. Use the Images tab in the editor to upload some.'
                                : 'No AI-enhanced images yet. Run the enhancement pipeline to produce optimized versions.'}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                            {gridTiles.map((tile) => (
                                <button
                                    key={tile.key}
                                    type="button"
                                    onClick={() => onSelect(field, tile.url)}
                                    title={tile.slot ? `Slot: ${tile.slot}` : tile.url}
                                    style={{
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        background: '#f8fafc',
                                        padding: 0,
                                        position: 'relative',
                                        aspectRatio: '4 / 3',
                                        transition: 'transform .15s, border-color .15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#E4B05E';
                                        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
                                        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                                    }}
                                >
                                    <img
                                        src={tile.url}
                                        alt={tile.slot || 'photo'}
                                        loading="lazy"
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block',
                                        }}
                                    />
                                    {tile.slot && (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                bottom: 6,
                                                left: 6,
                                                background: 'rgba(15,23,42,0.78)',
                                                color: '#fff',
                                                fontSize: 10,
                                                fontWeight: 700,
                                                padding: '3px 7px',
                                                borderRadius: 999,
                                                letterSpacing: '0.04em',
                                                textTransform: 'uppercase',
                                                fontFamily: 'ui-monospace, monospace',
                                            }}
                                        >{tile.slot}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
