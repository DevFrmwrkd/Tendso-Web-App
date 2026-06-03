"use client";

/**
 * LinkPopover — small modal that opens when the iframe emits
 * `ed:link-click`. Lets the admin edit the link's text and href, and
 * (when the link is a social-platform link) the platform name.
 *
 * The popover posts `ed:link-update` to the iframe AND persists the new
 * text / href / platform into the draft content state via callbacks, so
 * the change survives Save.
 */

import { useEffect, useMemo, useRef, useState } from "react";

export interface LinkPopoverData {
    field: string;
    hrefField: string;
    platformField?: string;
    text: string;
    href: string;
    platform?: string;
}

const PLATFORM_OPTIONS = [
    'Facebook',
    'Instagram',
    'Twitter / X',
    'TikTok',
    'YouTube',
    'LinkedIn',
    'Pinterest',
    'Threads',
    'WhatsApp',
    'Messenger',
    'Telegram',
    'Email',
    'Website',
    'Other',
];

export interface LinkPopoverProps {
    open: boolean;
    initial: LinkPopoverData | null;
    onClose: () => void;
    /**
     * Called when the user saves. Receives the updated fields; parent
     * should:
     *  1. Send `ed:link-update` to the preview iframe.
     *  2. Patch the draft so the change persists through Save.
     */
    onSave: (next: LinkPopoverData) => void;
}

export default function LinkPopover({ open, initial, onClose, onSave }: LinkPopoverProps) {
    const [text, setText] = useState('');
    const [href, setHref] = useState('');
    const [platform, setPlatform] = useState('');

    useEffect(() => {
        if (open && initial) {
            setText(initial.text || '');
            setHref(initial.href || '');
            setPlatform(initial.platform || '');
        }
    }, [open, initial]);

    const isPlatform = useMemo(() => Boolean(initial?.platformField), [initial?.platformField]);

    const firstInputRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
        if (open) {
            // Defer one frame so the input is mounted.
            requestAnimationFrame(() => firstInputRef.current?.select());
        }
    }, [open]);

    if (!open || !initial) return null;

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            field: initial.field,
            hrefField: initial.hrefField,
            platformField: initial.platformField,
            text: isPlatform ? platform : text,
            href,
            platform: isPlatform ? platform : undefined,
        });
        onClose();
    };

    return (
        <div
            role="dialog"
            aria-label="Edit link"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: 'rgba(15,23,42,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
            }}
        >
            <form
                onSubmit={handleSave}
                style={{
                    width: '100%',
                    maxWidth: 420,
                    background: '#fff',
                    borderRadius: 14,
                    boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
                    padding: 22,
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b' }}>
                            {isPlatform ? 'Edit social link' : 'Edit link'}
                        </div>
                        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, fontFamily: 'ui-monospace, monospace' }}>
                            {initial.hrefField || initial.field}
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
                            fontSize: 18,
                            padding: 4,
                            lineHeight: 1,
                        }}
                    >×</button>
                </div>

                {isPlatform ? (
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                            Platform
                        </label>
                        <select
                            ref={firstInputRef as unknown as React.RefObject<HTMLSelectElement>}
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #cbd5e1',
                                borderRadius: 8,
                                fontSize: 14,
                                background: '#fff',
                                color: '#0f172a',
                            }}
                        >
                            <option value="">— Select a platform —</option>
                            {PLATFORM_OPTIONS.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                            Button / link text
                        </label>
                        <input
                            ref={firstInputRef}
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Click here"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #cbd5e1',
                                borderRadius: 8,
                                fontSize: 14,
                                color: '#0f172a',
                                background: '#fff',
                            }}
                        />
                    </div>
                )}

                <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        URL / link target
                    </label>
                    <input
                        type="text"
                        value={href}
                        onChange={(e) => setHref(e.target.value)}
                        placeholder="https://example.com or #section-id"
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #cbd5e1',
                            borderRadius: 8,
                            fontSize: 14,
                            color: '#0f172a',
                            background: '#fff',
                            fontFamily: 'ui-monospace, monospace',
                        }}
                    />
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                        Full URL (https://…) or a section anchor (#about).
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '9px 16px',
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            color: '#475569',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >Cancel</button>
                    <button
                        type="submit"
                        style={{
                            padding: '9px 16px',
                            border: '1px solid #10b981',
                            background: '#10b981',
                            color: '#fff',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >Save</button>
                </div>
            </form>
        </div>
    );
}
