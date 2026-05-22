"use client";

import { useState, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { X, Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

const MAX_UPLOAD_BYTES = 2_000_000;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type LeadContentModalLead = {
    _id: Id<"leads">;
    name: string;
    adminDescription?: string | null;
    externalPreviewUrl?: string | null;
    previewImageUrl?: string | null;
    previewImageStorageKey?: string | null;
};

/**
 * Admin modal for editing a lead's social-card content. Mirrors the upload
 * flow documented in WEB-SYNC-CRM-CREATOR-APPROVAL-UI-REDESIGNED.md §10B:
 *   1. file picked → client-side mime/size check
 *   2. action returns presigned URL + public URL
 *   3. PUT bytes to R2 directly
 *   4. mutation saves URL/key + description/external link
 *
 * Mobile picks up the new content reactively via getDetailForMobileCRM.
 */
export default function LeadContentModal({
    lead,
    onClose,
}: {
    lead: LeadContentModalLead;
    onClose: () => void;
}) {
    const generateUploadUrl = useAction(api.leads.generatePreviewImageUploadUrl);
    const updateContent = useMutation(api.leads.updateAdminContent);

    const [description, setDescription] = useState(lead.adminDescription ?? "");
    const [externalUrl, setExternalUrl] = useState(lead.externalPreviewUrl ?? "");
    const [imageUrl, setImageUrl] = useState(lead.previewImageUrl ?? "");
    const [imageStorageKey, setImageStorageKey] = useState(lead.previewImageStorageKey ?? "");
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Close on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    async function handleImageSelected(file: File) {
        setError(null);

        if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
            setError(`Unsupported image type ${file.type}. Use JPEG, PNG, or WebP.`);
            return;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            setError(`Image too large (${(file.size / 1_000_000).toFixed(2)}MB). Max 2MB.`);
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
            const msg = e instanceof Error ? e.message : "Image upload failed";
            setError(msg);
        } finally {
            setUploading(false);
        }
    }

    async function handleSave() {
        setError(null);
        setSaving(true);
        try {
            await updateContent({
                id: lead._id,
                description,
                externalPreviewUrl: externalUrl,
                previewImageUrl: imageUrl,
                previewImageStorageKey: imageStorageKey,
            });
            toast.success("Lead content saved");
            onClose();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Save failed";
            setError(msg);
        } finally {
            setSaving(false);
        }
    }

    async function handleClear() {
        setSaving(true);
        try {
            setDescription("");
            setExternalUrl("");
            setImageUrl("");
            setImageStorageKey("");
            await updateContent({
                id: lead._id,
                description: "",
                externalPreviewUrl: "",
                previewImageUrl: "",
                previewImageStorageKey: "",
            });
            toast.success("Lead content cleared");
            onClose();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Clear failed";
            setError(msg);
        } finally {
            setSaving(false);
        }
    }

    const remaining = 500 - description.length;

    return (
        <div className="editorial fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div
                className="max-w-xl w-full overflow-hidden"
                style={{
                    background: "var(--ed-paper)",
                    borderRadius: "var(--ed-radius-xl)",
                    border: "1px solid var(--ed-rule)",
                    boxShadow: "var(--ed-shadow-md)",
                }}
            >
                <div
                    className="flex items-start justify-between p-6"
                    style={{ borderBottom: "1px solid var(--ed-rule)" }}
                >
                    <div>
                        <div className="ed-eyebrow mb-2">Lead Detail · Content Editor</div>
                        <h3 className="ed-display-sm" style={{ color: "var(--ed-ink)" }}>
                            Curate the{" "}
                            <em style={{ color: "var(--ed-accent)" }}>social card.</em>
                        </h3>
                        <p
                            className="ed-body-sm mt-2"
                            style={{ color: "var(--ed-ink-2)" }}
                        >
                            What mobile creators see for{" "}
                            <strong style={{ color: "var(--ed-ink)" }}>{lead.name}</strong>.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="transition-colors"
                        style={{ color: "var(--ed-ink-3)" }}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Description */}
                    <div className="ed-card">
                        <div className="ed-label mb-2 flex items-center justify-between">
                            <span>Description</span>
                            <span style={{ textTransform: "none", letterSpacing: "0.08em" }}>
                                {remaining} chars left
                            </span>
                        </div>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                            placeholder="Marketing copy that appears in the mobile CRM card…"
                            rows={4}
                            className="w-full px-3 py-2 text-sm focus:outline-none resize-none"
                            style={{
                                background: "var(--ed-paper)",
                                border: "1px solid var(--ed-rule)",
                                borderRadius: "var(--ed-radius-sm)",
                                fontFamily: "var(--ed-sans)",
                                color: "var(--ed-ink)",
                            }}
                            maxLength={500}
                        />
                    </div>

                    {/* External link */}
                    <div className="ed-card">
                        <div className="ed-label mb-2">External link</div>
                        <input
                            type="url"
                            value={externalUrl}
                            onChange={(e) => setExternalUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3 py-2 text-sm focus:outline-none"
                            style={{
                                background: "var(--ed-paper)",
                                border: "1px solid var(--ed-rule)",
                                borderRadius: "var(--ed-radius-sm)",
                                fontFamily: "var(--ed-sans)",
                                color: "var(--ed-ink)",
                            }}
                        />
                        <p
                            className="mt-2 text-xs"
                            style={{
                                color: "var(--ed-ink-3)",
                                fontFamily: "var(--ed-sans)",
                            }}
                        >
                            Optional — must start with http:// or https://
                        </p>
                    </div>

                    {/* Image */}
                    <div className="ed-card">
                        <div className="ed-label mb-2 flex items-center justify-between">
                            <span>Preview image</span>
                            <span style={{ textTransform: "none", letterSpacing: "0.08em" }}>
                                Max 2MB · JPEG / PNG / WebP
                            </span>
                        </div>
                        {imageUrl ? (
                            <div className="relative inline-block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={imageUrl}
                                    alt="preview"
                                    className="max-w-xs"
                                    style={{
                                        borderRadius: "var(--ed-radius-sm)",
                                        border: "1px solid var(--ed-rule)",
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImageUrl("");
                                        setImageStorageKey("");
                                    }}
                                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                                    style={{
                                        background: "var(--ed-paper-3)",
                                        border: "1px solid var(--ed-rule)",
                                        boxShadow: "var(--ed-shadow-sm)",
                                        color: "var(--ed-ink-3)",
                                    }}
                                    aria-label="Remove image"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ) : (
                            <label
                                className="flex items-center justify-center gap-2 px-4 py-8 cursor-pointer transition-colors"
                                style={{
                                    border: "2px dashed var(--ed-rule-strong)",
                                    borderRadius: "var(--ed-radius-md)",
                                    background: "var(--ed-paper-2)",
                                }}
                            >
                                {uploading ? (
                                    <>
                                        <Loader2
                                            className="w-4 h-4 animate-spin"
                                            style={{ color: "var(--ed-accent)" }}
                                        />
                                        <span className="ed-body-sm">Uploading…</span>
                                    </>
                                ) : (
                                    <>
                                        <ImageIcon
                                            className="w-5 h-5"
                                            style={{ color: "var(--ed-ink-3)" }}
                                        />
                                        <span className="ed-body-sm">Choose file…</span>
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleImageSelected(file);
                                    }}
                                    disabled={uploading}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>

                    {error && (
                        <div
                            className="px-4 py-3 text-sm"
                            style={{
                                background: "var(--ed-danger-bg)",
                                border: "1px solid var(--ed-danger)",
                                borderRadius: "var(--ed-radius-sm)",
                                color: "var(--ed-danger)",
                                fontFamily: "var(--ed-sans)",
                            }}
                        >
                            {error}
                        </div>
                    )}
                </div>

                <div
                    className="flex items-center justify-between gap-3 p-5"
                    style={{
                        borderTop: "1px solid var(--ed-rule)",
                        background: "var(--ed-paper-2)",
                    }}
                >
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={saving || uploading}
                        className="text-sm font-medium transition-colors disabled:opacity-50"
                        style={{
                            color: "var(--ed-danger)",
                            fontFamily: "var(--ed-sans)",
                        }}
                    >
                        Clear content
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving || uploading}
                            className="ed-door ed-door-ghost"
                            style={{ minHeight: 40, padding: "8px 16px", fontSize: 13 }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || uploading}
                            className="ed-door ed-door-accent inline-flex items-center"
                            style={{ minHeight: 40, padding: "8px 18px", fontSize: 13, gap: 8 }}
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {saving ? "Saving…" : "Save changes"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
