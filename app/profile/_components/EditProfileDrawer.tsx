"use client";

import { useAction, useMutation } from "convex/react";
import { Camera } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button, Drawer, Field, Icon, Input, PhoneInput, initialsOf } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { NowBlock } from "./parts";

/**
 * Edit profile (board Account, drawer). This was the /edit-profile page; the
 * route now redirects here with ?edit=profile. Same fields and the same calls
 * as that page: first name, last name, mobile number and the photo, which
 * uploads straight to R2 through a presigned URL (api.r2.generateUploadUrl)
 * and is saved with the rest by api.creators.update.
 *
 * Creators and the team (admins and staff have a creators row too) can edit;
 * owners cannot, see AccountView.
 */

type FieldErrors = { first?: string; last?: string; phone?: string };

// The board asks for 11 digits starting with 09. A number typed the way the
// old onboarding took it (10 digits starting with 9) is the same number, so it
// still passes.
const PHONE_OK = /^0?9\d{9}$/;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function EditProfileDrawer({
    open,
    onClose,
    creator,
    why,
    emailLine,
}: {
    open: boolean;
    onClose: () => void;
    creator: Doc<"creators">;
    /** The card's "why": the same line the Profile card shows. */
    why: string;
    /** "j•••@gmail.com · managed by Google" */
    emailLine: ReactNode;
}) {
    const updateCreator = useMutation(api.creators.update);
    const generateUploadUrl = useAction(api.r2.generateUploadUrl);

    const formId = useId();
    const fileRef = useRef<HTMLInputElement>(null);
    const firstRef = useRef<HTMLInputElement>(null);
    const lastRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);

    const [first, setFirst] = useState("");
    const [last, setLast] = useState("");
    const [phone, setPhone] = useState("");
    const [photo, setPhoto] = useState<string | undefined>();
    const [errors, setErrors] = useState<FieldErrors>({});
    const [photoError, setPhotoError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Every opening starts from what is saved now, never from a draft that
    // was cancelled. (Adjusting state while rendering, not in an effect, so
    // the drawer never paints the old draft for a frame.)
    const [openedFor, setOpenedFor] = useState(false);
    if (open !== openedFor) {
        setOpenedFor(open);
        if (open) {
            setFirst(creator.firstName ?? "");
            setLast(creator.lastName ?? "");
            setPhone(creator.phone ?? "");
            setPhoto(creator.profileImage);
            setErrors({});
            setPhotoError(null);
            setSaveError(null);
        }
    }

    const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Clear the picker so choosing the same file again still fires.
        e.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setPhotoError("Choose an image file.");
            return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            setPhotoError("Use an image under 5 MB.");
            return;
        }
        setUploading(true);
        setPhotoError(null);
        try {
            // Get a presigned URL from R2 via Convex, then upload directly to R2.
            const { uploadUrl, publicUrl } = await generateUploadUrl({
                fileName: file.name,
                fileType: file.type,
                submissionId: `profile-${creator._id}`,
                mediaType: "photo",
            });
            const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
            if (!res.ok) throw new Error("Upload failed");
            setPhoto(publicUrl);
        } catch {
            setPhotoError("The photo did not upload. Try again.");
        } finally {
            setUploading(false);
        }
    };

    const onSave = async (e: FormEvent) => {
        e.preventDefault();
        if (saving || uploading) return;
        const next: FieldErrors = {};
        if (!first.trim()) next.first = "Enter your first name";
        if (!last.trim()) next.last = "Enter your last name";
        // Only a number typed here is checked: a number saved earlier in
        // another shape (by the mobile app, say) must not block a name change.
        if (phone && phone !== (creator.phone ?? "") && !PHONE_OK.test(phone)) next.phone = "Use 11 digits starting with 09, like 09171234567";
        setErrors(next);
        if (next.first || next.last || next.phone) {
            (next.first ? firstRef : next.last ? lastRef : phoneRef).current?.focus();
            return;
        }
        setSaving(true);
        setSaveError(null);
        try {
            await updateCreator({
                id: creator._id,
                firstName: first.trim(),
                lastName: last.trim(),
                phone: phone.trim() || undefined,
                profileImage: photo,
            });
            toast.success("Profile saved");
            onClose();
        } catch (err) {
            setSaveError(err instanceof Error && err.message ? err.message : "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const initials = initialsOf(`${first} ${last}`.trim() || `${creator.firstName ?? ""} ${creator.lastName ?? ""}`);

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title="Edit profile"
            meta={why}
            closeLabel="Close edit profile"
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} disabled={saving || uploading} aria-busy={saving}>
                        {saving ? "Saving…" : "Save changes"}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={onSave} noValidate className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    {photo ? (
                        // Profile photos live on R2, outside next/image's configured hosts.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="t-avatar h-16 w-16" />
                    ) : (
                        <span className="t-avatar h-16 w-16 text-xl" aria-hidden="true">
                            {initials}
                        </span>
                    )}
                    <div className="flex min-w-0 flex-col items-start gap-1.5">
                        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} aria-busy={uploading}>
                            <Icon icon={Camera} />
                            {uploading ? "Uploading…" : photo ? "Change photo" : "Add photo"}
                        </Button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} tabIndex={-1} aria-hidden="true" />
                        {photoError ? (
                            <p className="t-error" role="alert">
                                {photoError}
                            </p>
                        ) : (
                            <p className="t-help">An image up to 5 MB. Your initials show until you add one.</p>
                        )}
                    </div>
                </div>

                <Field label="First name" required error={errors.first}>
                    <Input
                        ref={firstRef}
                        autoComplete="given-name"
                        value={first}
                        onChange={(e) => {
                            setFirst(e.target.value);
                            setErrors((x) => ({ ...x, first: undefined }));
                        }}
                    />
                </Field>
                <Field label="Last name" required error={errors.last}>
                    <Input
                        ref={lastRef}
                        autoComplete="family-name"
                        value={last}
                        onChange={(e) => {
                            setLast(e.target.value);
                            setErrors((x) => ({ ...x, last: undefined }));
                        }}
                    />
                </Field>
                <Field label="Mobile number" help="Numbers only: 11 digits starting with 09. Letters and spaces are removed as you type." error={errors.phone}>
                    <PhoneInput
                        ref={phoneRef}
                        placeholder="09171234567"
                        value={phone}
                        onValueChange={(digits) => {
                            setPhone(digits);
                            setErrors((x) => ({ ...x, phone: undefined }));
                        }}
                    />
                </Field>
                <NowBlock label="Email">{emailLine}</NowBlock>
                {saveError && (
                    <p className="t-error" role="alert">
                        {saveError}
                    </p>
                )}
            </form>
        </Drawer>
    );
}
