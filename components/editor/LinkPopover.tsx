"use client";

/**
 * LinkPopover — small modal that opens when the iframe emits
 * `ed:link-click`. Lets the admin edit the link's text and href, and
 * (when the link is a social-platform link) the platform name.
 *
 * The popover posts `ed:link-update` to the iframe AND persists the new
 * text / href / platform into the draft content state via callbacks, so
 * the change survives Save.
 *
 * Round 1: a kit Dialog with kit fields. The form mounts fresh on every
 * opening (the Dialog unmounts its content when closed), so it starts from
 * the clicked link's own text, address and platform each time.
 */

import { useEffect, useRef, useState } from "react";
import { Button, Dialog, Field, Input, Select } from "@/components/r1";

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
    const isPlatform = Boolean(initial?.platformField);
    return (
        <Dialog open={open && !!initial} onClose={onClose} title={isPlatform ? 'Edit social link' : 'Edit link'}>
            {initial && <LinkForm initial={initial} onClose={onClose} onSave={onSave} />}
        </Dialog>
    );
}

function LinkForm({ initial, onClose, onSave }: { initial: LinkPopoverData; onClose: () => void; onSave: (next: LinkPopoverData) => void }) {
    const [text, setText] = useState(initial.text || '');
    const [href, setHref] = useState(initial.href || '');
    const [platform, setPlatform] = useState(initial.platform || '');
    const isPlatform = Boolean(initial.platformField);

    // Select the first field's text so typing replaces it. Deferred one frame
    // so the dialog has finished opening and taken focus.
    const firstRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            const el = firstRef.current;
            if (el instanceof HTMLInputElement) el.select();
            else el?.focus();
        });
        return () => cancelAnimationFrame(raf);
    }, []);

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
        <form onSubmit={handleSave} className="flex flex-col gap-4">
            <p className="t-mono text-r1-ink-3">{initial.hrefField || initial.field}</p>

            {isPlatform ? (
                <Field label="Platform">
                    <Select ref={(el) => { firstRef.current = el; }} value={platform} onChange={(e) => setPlatform(e.target.value)}>
                        <option value="">Choose a platform</option>
                        {PLATFORM_OPTIONS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </Select>
                </Field>
            ) : (
                <Field label="Button or link text">
                    <Input
                        ref={(el) => { firstRef.current = el; }}
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Click here"
                    />
                </Field>
            )}

            <Field label="Where it goes" help="A full address (https://…) or a section on the page (#about).">
                <Input
                    type="text"
                    value={href}
                    onChange={(e) => setHref(e.target.value)}
                    placeholder="https://example.com or #section-id"
                    className="font-r1-mono"
                />
            </Field>

            <div className="t-dialog-foot">
                <Button onClick={onClose}>Cancel</Button>
                <Button type="submit" variant="primary">Save</Button>
            </div>
        </form>
    );
}
