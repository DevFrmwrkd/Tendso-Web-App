"use client";

import { useAction, useMutation } from "convex/react";
import { ArrowRight, Camera, LockKeyhole } from "lucide-react";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/v2/Button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { isCreatorAccount } from "@/lib/accounts";
import { affiliatePhoneError } from "@/lib/affiliates";

import styles from "./ProfileReview.module.css";

type Errors = { firstName?: string; lastName?: string; phone?: string };

export function RejectedProfileForm({ creator, onCancel, onSubmitted }: {
    creator: Doc<"creators">;
    onCancel: () => void;
    onSubmitted: () => void;
}) {
    const resubmit = useMutation(api.creators.resubmitProfileForReview);
    const generateUploadUrl = useAction(api.r2.generateUploadUrl);
    const id = useId();
    const [firstName, setFirstName] = useState(creator.firstName ?? "");
    const [lastName, setLastName] = useState(creator.lastName ?? "");
    const [phone, setPhone] = useState(creator.phone ?? "");
    const [photo, setPhoto] = useState(creator.profileImage ?? "");
    const [errors, setErrors] = useState<Errors>({});
    const [error, setError] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [busy, setBusy] = useState<"upload" | "submit" | null>(null);
    const inactive = !!creator.isDeleted || creator.status === "deleted" || creator.status === "suspended";
    const fileRef = useRef<HTMLInputElement>(null);
    const firstRef = useRef<HTMLInputElement>(null);
    const lastRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const busyRef = useRef(false);
    const submitted = useRef(false);
    const mounted = useRef(true);
    const current = useRef(creator);
    current.current = creator;
    const actor = useRef({ id: creator._id, clerkId: creator.clerkId });
    const sameActor = () => mounted.current && current.current._id === actor.current.id && current.current.clerkId === actor.current.clerkId;
    const canWrite = () => sameActor() && isCreatorAccount(current.current) && !!current.current.rejectedAt && !!current.current.quizPassedAt && !current.current.certifiedAt
        && !current.current.isDeleted && !["deleted", "suspended"].includes(current.current.status ?? "");

    useEffect(() => {
        mounted.current = true;
        firstRef.current?.focus();
        return () => { mounted.current = false; };
    }, []);

    const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || busyRef.current || submitted.current || !canWrite()) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setUploadError("Choose a JPG, PNG, or WebP photo.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setUploadError("Choose a photo under 5 MB.");
            return;
        }
        busyRef.current = true;
        setBusy("upload");
        setUploadError(null);
        try {
            const { uploadUrl, publicUrl } = await generateUploadUrl({ fileName: file.name, fileType: file.type, submissionId: `profile-${creator._id}`, mediaType: "profile" });
            if (!canWrite()) return;
            const response = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
            if (!canWrite()) return;
            if (!response.ok) throw new Error("The photo didn't upload. Try again.");
            setPhoto(publicUrl);
        } catch (err) {
            if (sameActor()) setUploadError(err instanceof Error ? err.message : "The photo didn't upload. Try again.");
        } finally {
            busyRef.current = false;
            if (mounted.current) setBusy(null);
        }
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (busyRef.current || submitted.current || !canWrite()) return;
        const first = firstName.trim();
        const last = lastName.trim();
        const mobile = phone.trim();
        const next: Errors = {};
        if (!first) next.firstName = "Enter your first name.";
        else if (first.length > 100) next.firstName = "Use 100 characters or fewer.";
        if (last.length > 100) next.lastName = "Use 100 characters or fewer.";
        if (mobile) next.phone = affiliatePhoneError(mobile) ?? undefined;
        setErrors(next);
        if (next.firstName || next.lastName || next.phone) {
            (next.firstName ? firstRef : next.lastName ? lastRef : phoneRef).current?.focus();
            return;
        }
        busyRef.current = true;
        setBusy("submit");
        setError(null);
        try {
            // One transaction saves the corrected profile and opens a new review.
            // The server preserves quizPassedAt and never certifies this account.
            await resubmit({ id: actor.current.id, firstName: first, lastName: last, phone: mobile, ...(photo !== (creator.profileImage ?? "") ? { profileImage: photo } : {}) });
            submitted.current = true;
            if (sameActor() && !current.current.certifiedAt) onSubmitted();
        } catch (err) {
            if (sameActor()) setError(err instanceof Error ? err.message : "Could not resend your profile. Your changes are still here. Try again.");
        } finally {
            busyRef.current = false;
            if (mounted.current) setBusy(null);
        }
    };

    const initials = [firstName.trim()[0], lastName.trim()[0]].filter(Boolean).join("") || "?";
    const errorId = (field: keyof Errors) => errors[field] ? `${id}-${field}-error` : undefined;
    return (
        <section className={styles.card} aria-labelledby={`${id}-title`}>
            <div className={styles.cardHead}><div><h2 id={`${id}-title`}>Fix your profile</h2><p>Update the details mentioned in the feedback, then send them for another review. Your quiz pass stays saved.</p></div></div>
            <form onSubmit={submit} noValidate>
                <fieldset className={styles.formFields} disabled={!!busy || inactive} aria-describedby={inactive ? `${id}-unavailable` : undefined}>
                    <legend className={styles.srOnly}>Profile corrections</legend>
                    <div className={styles.photoRow}>
                        {photo ? (
                            // Account photos are user uploads on R2, outside the configured Next image hosts.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className={styles.avatar} src={photo} alt="Your profile photo" />
                        ) : <span className={styles.initials} aria-hidden="true">{initials}</span>}
                        <div><Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={!!busy || inactive}><Camera size={16} aria-hidden="true" />{busy === "upload" ? "Uploading…" : photo ? "Change photo" : "Add photo"}</Button><p className={styles.help}>JPG, PNG, or WebP · up to 5 MB</p></div>
                        <input ref={fileRef} aria-label="Choose profile photo" type="file" accept="image/jpeg,image/png,image/webp" className={styles.srOnly} onChange={uploadPhoto} tabIndex={-1} />
                    </div>
                    {uploadError && <p className={styles.error} role="alert">{uploadError}</p>}
                    <div className={styles.nameFields}>
                        <label className={styles.field} htmlFor={`${id}-first`}>First name <input ref={firstRef} id={`${id}-first`} autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} aria-required="true" aria-invalid={!!errors.firstName} aria-describedby={errorId("firstName")} />{errors.firstName && <span className={styles.error} id={errorId("firstName")}>{errors.firstName}</span>}</label>
                        <label className={styles.field} htmlFor={`${id}-last`}><span className={styles.fieldLabel}>Last name <span className={styles.optional}>Optional</span></span><input ref={lastRef} id={`${id}-last`} autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} aria-invalid={!!errors.lastName} aria-describedby={errorId("lastName")} />{errors.lastName && <span className={styles.error} id={errorId("lastName")}>{errors.lastName}</span>}</label>
                    </div>
                    <label className={styles.field} htmlFor={`${id}-phone`}><span className={styles.fieldLabel}>Mobile <span className={styles.optional}>Optional</span></span><input ref={phoneRef} id={`${id}-phone`} autoComplete="tel" type="tel" inputMode="tel" placeholder="09171234567" value={phone} onChange={event => setPhone(event.target.value)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? errorId("phone") : `${id}-phone-help`} />{errors.phone ? <span className={styles.error} id={errorId("phone")}>{errors.phone}</span> : <span className={styles.help} id={`${id}-phone-help`}>Use a Philippine mobile number, or leave it blank.</span>}</label>
                    <div className={styles.email}><LockKeyhole size={17} aria-hidden="true" /><div><span>Email</span><strong>{creator.email}</strong><small>Your sign-in email stays the same.</small></div></div>
                </fieldset>
                {inactive && <p id={`${id}-unavailable`} className={styles.error} role="alert">Your account is currently unavailable. Contact the Tendso team before resubmitting your profile.</p>}
                {error && <p className={styles.error} role="alert">{error}</p>}
                <div className={styles.actions}><Button variant="ghost" onClick={onCancel} disabled={!!busy}>Cancel</Button><Button type="submit" disabled={!!busy || inactive} aria-describedby={inactive ? `${id}-unavailable` : undefined} aria-busy={busy === "submit"}>{busy === "submit" ? "Sending for review…" : "Resubmit for review"}<ArrowRight size={17} aria-hidden="true" /></Button></div>
            </form>
        </section>
    );
}
