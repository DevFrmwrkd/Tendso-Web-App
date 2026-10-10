"use client";

import { useAction, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Camera, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { AuthAlert } from "@/app/auth/_components/AuthParts";
import { Button, Field, Icon, Input, Textarea, initialsOf } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { AFFILIATE_MESSAGE_MAX_LENGTH, affiliatePhotoError, affiliateSocialLinkError } from "@/lib/affiliates";

export type AffiliatePageDraft = { photo: string; displayName: string; message: string; socialLink: string };
type FieldErrors = { displayName?: string; message?: string; socialLink?: string };
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function PageSettings({ draft, defaultName, handle, dirty, disabled, preview = false, onChange, onSaved }: {
    draft: AffiliatePageDraft;
    defaultName: string;
    handle?: string;
    dirty: boolean;
    disabled: boolean;
    preview?: boolean;
    onChange: (patch: Partial<AffiliatePageDraft>) => void;
    onSaved: (page: AffiliatePageDraft) => void;
}) {
    const updatePage = useMutation(api.affiliates.updatePage);
    const generateUploadUrl = useAction(api.r2.generateUploadUrl);
    const fileRef = useRef<HTMLInputElement>(null);
    const photoButtonRef = useRef<HTMLButtonElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const messageRef = useRef<HTMLTextAreaElement>(null);
    const socialRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [photoError, setPhotoError] = useState<string>();
    const [errors, setErrors] = useState<FieldErrors>({});
    const [saveError, setSaveError] = useState<string>();
    const [saved, setSaved] = useState(false);

    function change(patch: Partial<AffiliatePageDraft>) {
        onChange(patch);
        setSaved(false);
        setSaveError(undefined);
        setErrors({});
    }

    async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || preview || disabled || uploading || saving) return;
        if (!PHOTO_TYPES.includes(file.type)) {
            setPhotoError("Choose a JPG, PNG, or WebP photo.");
            return;
        }
        if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
            setPhotoError("Choose a photo up to 5 MB that contains an image.");
            return;
        }
        setUploading(true);
        setPhotoError(undefined);
        setSaved(false);
        try {
            const { uploadUrl, publicUrl } = await generateUploadUrl({ fileName: file.name, fileType: file.type, mediaType: "avatar" });
            const response = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
            if (!response.ok) throw new Error("Upload failed");
            const problem = affiliatePhotoError(publicUrl);
            if (problem) throw new Error(problem);
            // A patch preserves text the user entered while the upload ran.
            change({ photo: publicUrl });
        } catch {
            setPhotoError("Your photo did not upload. Please try again.");
        } finally {
            setUploading(false);
        }
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (disabled || saving || uploading || !dirty) return;
        const page: AffiliatePageDraft = {
            photo: draft.photo.trim(),
            displayName: draft.displayName.trim(),
            message: draft.message.trim(),
            socialLink: draft.socialLink.trim(),
        };
        const next: FieldErrors = {
            displayName: page.displayName.length > 100 ? "Use 100 characters or fewer." : undefined,
            message: page.message.length > AFFILIATE_MESSAGE_MAX_LENGTH ? `Use ${AFFILIATE_MESSAGE_MAX_LENGTH} characters or fewer.` : undefined,
            socialLink: affiliateSocialLinkError(page.socialLink) ?? undefined,
        };
        const imageProblem = affiliatePhotoError(page.photo);
        setErrors(next);
        setPhotoError(imageProblem ?? undefined);
        setSaveError(undefined);
        if (next.displayName || next.message || next.socialLink || imageProblem) {
            (next.displayName ? nameRef : next.message ? messageRef : next.socialLink ? socialRef : photoButtonRef).current?.focus();
            return;
        }
        if (preview) {
            onSaved(page);
            setSaved(true);
            return;
        }
        setSaving(true);
        try {
            await updatePage(page);
            onSaved(page);
            setSaved(true);
        } catch (error) {
            setSaveError(error instanceof ConvexError && typeof error.data === "string" ? error.data : "Your page was not saved. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section id="page-settings" className="t-card t-card-pad flex min-w-0 flex-col gap-5 wrap-anywhere" aria-labelledby="page-settings-title">
            <div className="flex flex-col gap-1">
                <h2 id="page-settings-title" className="t-h2">Your page</h2>
                <p className="t-meta">Make your offer personal. Changes appear in the preview before you save.</p>
            </div>
            <form onSubmit={save} noValidate className="flex flex-col gap-5">
                {saveError && <AuthAlert>{saveError}</AuthAlert>}
                <div className="flex flex-wrap items-center gap-4">
                    {draft.photo ? (
                        // R2 photos are outside next/image's configured hosts.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={draft.photo} alt="Your page photo" className="size-16 rounded-full object-cover" />
                    ) : (
                        <span className="t-avatar size-16 text-xl" aria-hidden="true">{initialsOf(draft.displayName || defaultName)}</span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                            <Button ref={photoButtonRef} size="sm" onClick={() => fileRef.current?.click()} disabled={preview || disabled || uploading || saving} aria-busy={uploading}>
                                <Icon icon={Camera} />
                                {uploading ? "Uploading…" : draft.photo ? "Change photo" : "Add photo"}
                            </Button>
                            {draft.photo && <Button variant="ghost" size="sm" disabled={disabled || uploading || saving} onClick={() => { change({ photo: "" }); setPhotoError(undefined); }}><Icon icon={X} />Remove</Button>}
                        </div>
                        <input ref={fileRef} type="file" accept={PHOTO_TYPES.join(",")} className="hidden" tabIndex={-1} aria-hidden="true" onChange={uploadPhoto} disabled={preview || disabled || uploading || saving} />
                        {photoError ? <p className="t-error" role="alert">{photoError}</p> : <p className="t-help">{preview ? "Photo uploads are disabled in this preview." : "JPG, PNG, or WebP, up to 5 MB."}</p>}
                        {uploading && <p className="t-help" role="status">Uploading your photo. Wait to save your page.</p>}
                    </div>
                </div>
                <Field label="Display name" help={`Optional. Leave blank to use ${defaultName}.`} error={errors.displayName}>
                    <Input ref={nameRef} value={draft.displayName} placeholder={defaultName} maxLength={100} autoComplete="name" disabled={disabled || saving} onChange={(event) => change({ displayName: event.target.value })} />
                </Field>
                <Field label="Short message" help={`Optional. ${draft.message.length}/${AFFILIATE_MESSAGE_MAX_LENGTH} characters.`} error={errors.message}>
                    <Textarea ref={messageRef} value={draft.message} placeholder="A personal message for shop owners" maxLength={AFFILIATE_MESSAGE_MAX_LENGTH} rows={3} disabled={disabled || saving} onChange={(event) => change({ message: event.target.value })} />
                </Field>
                <Field label="Facebook or Messenger link" help="Optional. Use a Facebook, Messenger, or m.me link starting with https://." error={errors.socialLink}>
                    <Input ref={socialRef} type="url" value={draft.socialLink} placeholder="https://m.me/yourname" autoCapitalize="none" autoComplete="url" spellCheck={false} maxLength={2048} disabled={disabled || saving} onChange={(event) => change({ socialLink: event.target.value })} />
                </Field>
                <p className="t-meta">Page handle: <strong className="break-all text-r1-ink">@{handle || "unavailable"}</strong>. Your handle stays the same.</p>
                <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" variant="primary" disabled={disabled || saving || uploading || !dirty} aria-busy={saving}>{saving ? "Saving…" : "Save page"}</Button>
                    <p className="t-meta" role="status" aria-live="polite">{saved && !dirty ? preview ? "Page saved in this preview." : "Page saved." : dirty ? "Unsaved page changes" : ""}</p>
                </div>
            </form>
        </section>
    );
}
