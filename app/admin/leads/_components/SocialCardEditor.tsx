"use client";

/**
 * A lead's social card: what creators see for this lead in the mobile CRM,
 * which renders a Facebook-style card as soon as any field is set. This was
 * LeadContentModal; it now sits in a fold of the lead drawer, as the board
 * draws it. The upload flow is unchanged
 * (WEB-SYNC-CRM-CREATOR-APPROVAL-UI-REDESIGNED.md §10B):
 *   1. file picked → client-side mime/size check
 *   2. action returns presigned URL + public URL
 *   3. PUT bytes to R2 directly
 *   4. mutation saves URL/key + description/external link
 *
 * Picking or removing an image only changes the draft; Save card writes it.
 * Mobile picks up the new content reactively via getDetailForMobileCRM.
 */
import { useAction, useMutation } from "convex/react";
import { ImageIcon, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Field, Icon, Input, Textarea } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { errorText } from "./leadUtils";

const MAX_UPLOAD_BYTES = 2_000_000;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
// updateAdminContent rejects more than this.
const MAX_DESCRIPTION = 500;

export type SocialCardLead = {
    _id: Id<"leads">;
    name: string;
    adminDescription?: string | null;
    externalPreviewUrl?: string | null;
    previewImageUrl?: string | null;
    previewImageStorageKey?: string | null;
};

export function SocialCardEditor({ lead }: { lead: SocialCardLead }) {
    const generateUploadUrl = useAction(api.leads.generatePreviewImageUploadUrl);
    const updateContent = useMutation(api.leads.updateAdminContent);

    const [description, setDescription] = useState(lead.adminDescription ?? "");
    const [externalUrl, setExternalUrl] = useState(lead.externalPreviewUrl ?? "");
    const [imageUrl, setImageUrl] = useState(lead.previewImageUrl ?? "");
    const [imageStorageKey, setImageStorageKey] = useState(lead.previewImageStorageKey ?? "");
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [linkError, setLinkError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const descriptionId = useId();
    const busy = uploading || saving;

    async function handleImageSelected(file: File) {
        setError(null);

        if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
            setError(`That file is ${file.type || "not an image"}. Use a JPEG, PNG or WebP image.`);
            return;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            setError(`That image is ${(file.size / 1_000_000).toFixed(2)} MB. The limit is 2 MB.`);
            return;
        }

        setUploading(true);
        try {
            const { uploadUrl, publicUrl, storageKey } = await generateUploadUrl({
                leadId: lead._id,
                mimeType: file.type,
                sizeBytes: file.size,
            });

            const putRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file,
            });
            if (!putRes.ok) {
                throw new Error(`R2 upload failed: ${putRes.status} ${putRes.statusText}`);
            }

            setImageUrl(publicUrl);
            setImageStorageKey(storageKey);
        } catch (e: unknown) {
            setError(errorText(e, "Image upload failed"));
        } finally {
            setUploading(false);
        }
    }

    async function handleSave() {
        setError(null);
        // updateAdminContent's own rule, checked before the round trip so the
        // error can sit under the field instead of failing the whole save.
        const link = externalUrl.trim();
        if (link && !/^https?:\/\//i.test(link)) {
            setLinkError("The link must start with http:// or https://");
            return;
        }
        setSaving(true);
        try {
            await updateContent({
                id: lead._id,
                description,
                externalPreviewUrl: externalUrl,
                previewImageUrl: imageUrl,
                previewImageStorageKey: imageStorageKey,
            });
            toast.success("Social card saved");
        } catch (e: unknown) {
            setError(errorText(e, "Save failed"));
        } finally {
            setSaving(false);
        }
    }

    async function handleClear() {
        setError(null);
        setSaving(true);
        try {
            await updateContent({
                id: lead._id,
                description: "",
                externalPreviewUrl: "",
                previewImageUrl: "",
                previewImageStorageKey: "",
            });
            setDescription("");
            setExternalUrl("");
            setImageUrl("");
            setImageStorageKey("");
            setLinkError(null);
            toast.success("Social card cleared");
        } catch (e: unknown) {
            setError(errorText(e, "Clear failed"));
        } finally {
            setSaving(false);
        }
    }

    const pickFile = () => fileRef.current?.click();

    return (
        <div className="flex flex-col gap-4 pt-1">
            <p className="t-meta">What creators see for this lead in the mobile app.</p>

            <div className="t-field">
                <div className="flex items-baseline justify-between gap-3">
                    <label className="t-field-label" htmlFor={descriptionId}>
                        Description
                    </label>
                    <span className="t-help t-num" id={`${descriptionId}-left`}>
                        {MAX_DESCRIPTION - description.length} characters left
                    </span>
                </div>
                <Textarea
                    id={descriptionId}
                    className="min-h-[88px]"
                    placeholder="A short line about the business that creators will see"
                    value={description}
                    maxLength={MAX_DESCRIPTION}
                    aria-describedby={`${descriptionId}-left`}
                    onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
                />
            </div>

            <Field label="Link" help="Optional. Must start with http:// or https://" error={linkError}>
                <Input
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={externalUrl}
                    onChange={(e) => {
                        setExternalUrl(e.target.value);
                        setLinkError(null);
                    }}
                />
            </Field>

            <div className="t-field">
                <span className="t-field-label">Preview image</span>
                {imageUrl ? (
                    <>
                        {/* The image lives on R2's public host, which next/image is not configured for. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={imageUrl}
                            alt={`Preview image for ${lead.name}`}
                            className="block h-[180px] w-full rounded-r1 border border-r1-line object-cover object-top"
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={pickFile} disabled={busy} aria-busy={uploading}>
                                {uploading ? "Uploading…" : "Replace"}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => {
                                    setImageUrl("");
                                    setImageStorageKey("");
                                }}
                            >
                                <Icon icon={Trash2} />
                                Remove image
                            </Button>
                        </div>
                    </>
                ) : (
                    <button
                        type="button"
                        className="flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-r1 border border-dashed border-r1-line-2 bg-r1-fill-2 text-sm text-r1-ink-2 hover:bg-r1-fill disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={pickFile}
                        disabled={busy}
                        aria-busy={uploading}
                    >
                        <Icon icon={ImageIcon} size={20} />
                        <span>{uploading ? "Uploading…" : "Choose image"}</span>
                        <span className="t-help">JPEG, PNG or WebP · up to 2 MB</span>
                    </button>
                )}
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        // Cleared so picking the same file again still fires a change.
                        e.target.value = "";
                        if (file) void handleImageSelected(file);
                    }}
                />
            </div>

            <div className="flex items-center justify-between gap-2">
                <Button size="sm" variant="ghost" className="text-r1-red" onClick={() => void handleClear()} disabled={busy}>
                    Clear card
                </Button>
                <Button size="sm" variant="primary" onClick={() => void handleSave()} disabled={busy} aria-busy={saving}>
                    {saving ? "Saving…" : "Save card"}
                </Button>
            </div>
            {error && (
                <p className="t-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
