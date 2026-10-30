"use client";

import { useAction, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Camera, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { AuthAlert } from "@/app/auth/_components/AuthParts";
import { Button, Field, Icon, Input, Textarea, initialsOf } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import { AFFILIATE_MESSAGE_MAX_LENGTH, AFFILIATE_SOCIAL_LABELS, AFFILIATE_SOCIAL_PLATFORMS, affiliatePhotoError, affiliateSocialPlatformLinkError, getAffiliateSocialLinks, type AffiliateSocialLinks, type AffiliateSocialPlatform } from "@/lib/affiliates";

export type AffiliatePageDraft = { photo: string; displayName: string; message: string; socialLinks: AffiliateSocialLinks };
type FieldErrors = { displayName?: string; message?: string; socialLinks?: Partial<Record<AffiliateSocialPlatform, string>> };
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const SOCIAL_PLACEHOLDERS: Record<AffiliateSocialPlatform, string> = {
    messenger: "https://m.me/yourname",
    facebook: "https://www.facebook.com/yourpage",
    instagram: "https://www.instagram.com/yourname",
    tiktok: "https://www.tiktok.com/@yourname",
    youtube: "https://www.youtube.com/@yourchannel",
};

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
    const socialRefs = useRef<Partial<Record<AffiliateSocialPlatform, HTMLInputElement | null>>>({});
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
            socialLinks: getAffiliateSocialLinks(draft.socialLinks),
        };
        const next: FieldErrors = {
            displayName: page.displayName.length > 100 ? "Use 100 characters or fewer." : undefined,
            message: page.message.length > AFFILIATE_MESSAGE_MAX_LENGTH ? `Use ${AFFILIATE_MESSAGE_MAX_LENGTH} characters or fewer.` : undefined,
            socialLinks: {},
        };
        for (const platform of AFFILIATE_SOCIAL_PLATFORMS) {
            const problem = affiliateSocialPlatformLinkError(platform, draft.socialLinks[platform] ?? "");
            if (problem) next.socialLinks![platform] = problem;
        }
        const firstSocialError = AFFILIATE_SOCIAL_PLATFORMS.find((platform) => next.socialLinks?.[platform]);
        const imageProblem = affiliatePhotoError(page.photo);
        setErrors(next);
        setPhotoError(imageProblem ?? undefined);
        setSaveError(undefined);
        if (next.displayName || next.message || firstSocialError || imageProblem) {
            if (next.displayName) nameRef.current?.focus();
            else if (next.message) messageRef.current?.focus();
            else if (firstSocialError) socialRefs.current[firstSocialError]?.focus();
            else photoButtonRef.current?.focus();
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
        <section id="page-settings" className="ap-page-settings t-card t-card-pad flex min-w-0 flex-col gap-5 wrap-anywhere" aria-labelledby="page-settings-title">
            <div className="ap-section-heading flex flex-col gap-1">
                <h2 id="page-settings-title" className="t-h2">Your public page</h2>
                <p className="t-meta">Introduce yourself to shop owners. Save your changes to update the page people see from your link.</p>
            </div>
            <form onSubmit={save} noValidate className="flex flex-col gap-5">
                {saveError && <AuthAlert>{saveError}</AuthAlert>}
                <div className="ap-photo-row flex flex-wrap items-center gap-4">
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
                <Field label="Personal message" help={`Optional. Shown on your public page. ${draft.message.length}/${AFFILIATE_MESSAGE_MAX_LENGTH} characters.`} error={errors.message}>
                    <Textarea ref={messageRef} value={draft.message} placeholder="Tell shop owners how you can help" maxLength={AFFILIATE_MESSAGE_MAX_LENGTH} rows={3} disabled={disabled || saving} onChange={(event) => change({ message: event.target.value })} />
                </Field>
                <fieldset className="ap-social-fields flex min-w-0 flex-col gap-4">
                    <legend className="t-label mb-2">Social links</legend>
                    <p className="t-help">Optional. Add the accounts you want visitors to find. Each saved link appears on your public page. Use full links starting with https://.</p>
                    {AFFILIATE_SOCIAL_PLATFORMS.map((platform) => (
                        <Field key={platform} label={`${AFFILIATE_SOCIAL_LABELS[platform]} link`} error={errors.socialLinks?.[platform]}>
                            <Input ref={(element) => { socialRefs.current[platform] = element; }} type="url" value={draft.socialLinks[platform] ?? ""} placeholder={SOCIAL_PLACEHOLDERS[platform]} autoCapitalize="none" autoComplete="url" spellCheck={false} maxLength={2048} disabled={disabled || saving} onChange={(event) => change({ socialLinks: { ...draft.socialLinks, [platform]: event.target.value } })} />
                        </Field>
                    ))}
                </fieldset>
                <p className="t-meta">Page handle: <strong className="break-all text-r1-ink">@{handle || "unavailable"}</strong>. Your handle stays the same.</p>
                <div className="ap-save-row flex flex-wrap items-center gap-3">
                    <Button type="submit" variant="primary" disabled={disabled || saving || uploading || !dirty} aria-busy={saving}>{saving ? "Saving…" : "Save page"}</Button>
                    <p className="t-meta" role="status" aria-live="polite">{saved && !dirty ? preview ? "Page saved in this preview." : "Page saved." : dirty ? "Unsaved page changes" : ""}</p>
                </div>
            </form>
        </section>
    );
}
