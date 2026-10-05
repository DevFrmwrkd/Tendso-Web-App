"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { Check, X } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button, Drawer, Field, Icon, PasswordInput, cx } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { clerkError } from "./parts";

/**
 * Change password (board Account, drawer). This was the /change-password
 * page; the route now redirects here with ?edit=password. Same Clerk call
 * (user.updatePassword with the current and the new password), the same
 * strength levels and rules, and the same "Password Changed" notification
 * for anyone with a creators row (creators, admins and staff; owners have
 * none, so they get only the toast).
 *
 * Only offered to someone who HAS a password (Clerk's passwordEnabled). A
 * Google-only account has no current password to type, and the old page
 * simply failed for them.
 */

/** The old page's strength levels, unchanged. The tips are the board's. */
function passwordStrength(pw: string): { level: 1 | 2 | 3 | 4; label: string; tip: string } {
    if (pw.length < 8) return { level: 1, label: "Weak", tip: "Use 8 or more characters" };
    const mixedCase = /[A-Z]/.test(pw) && /[a-z]/.test(pw);
    const hasNumber = /\d/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    if (mixedCase && hasNumber && hasSpecial) return { level: 4, label: "Strong", tip: "Good to go" };
    if ((mixedCase && hasNumber) || (mixedCase && hasSpecial)) return { level: 3, label: "Good", tip: "Add a symbol for Strong" };
    return { level: 2, label: "Fair", tip: "Mix upper and lower case" };
}

type Errors = { cur?: string; neu?: string; conf?: string };

export function PasswordDrawer({ open, onClose, creatorId }: { open: boolean; onClose: () => void; creatorId?: Id<"creators"> }) {
    const { user } = useUser();
    const createNotification = useMutation(api.notifications.createForClient);

    const formId = useId();
    const curRef = useRef<HTMLInputElement>(null);
    const newRef = useRef<HTMLInputElement>(null);
    const confRef = useRef<HTMLInputElement>(null);

    const [cur, setCur] = useState("");
    const [neu, setNeu] = useState("");
    const [conf, setConf] = useState("");
    const [errors, setErrors] = useState<Errors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Every opening starts empty: passwords are never kept from a cancelled try.
    const [openedFor, setOpenedFor] = useState(false);
    if (open !== openedFor) {
        setOpenedFor(open);
        if (open) {
            setCur("");
            setNeu("");
            setConf("");
            setErrors({});
            setFormError(null);
        }
    }

    const strength = passwordStrength(neu);
    const confMismatch = conf.length > 0 && conf !== neu;

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (saving || !user) return;
        const next: Errors = {};
        if (!cur) next.cur = "Enter your current password";
        if (neu.length < 8) next.neu = "Use at least 8 characters";
        else if (neu === cur) next.neu = "Pick a password different from your current one";
        if (!conf) next.conf = "Type the new password again";
        else if (conf !== neu) next.conf = "Passwords do not match";
        setErrors(next);
        setFormError(null);
        if (next.cur || next.neu || next.conf) {
            (next.cur ? curRef : next.neu ? newRef : confRef).current?.focus();
            return;
        }

        setSaving(true);
        try {
            await user.updatePassword({ currentPassword: cur, newPassword: neu });
        } catch (err) {
            // Put Clerk's message under the field it is about when it names one.
            const { code, message, param } = clerkError(err);
            const text = message || "Failed to update password";
            if (code === "form_password_incorrect" || param === "current_password") {
                setErrors({ cur: text });
                curRef.current?.focus();
            } else if (param === "new_password" || code?.startsWith("form_password")) {
                setErrors({ neu: text });
                newRef.current?.focus();
            } else {
                setFormError(text);
            }
            setSaving(false);
            return;
        }

        // The password has changed. The notification is the record the old page
        // left; if only that fails, the change still stands, so say so plainly.
        if (creatorId) {
            try {
                await createNotification({
                    creatorId,
                    type: "password_changed",
                    title: "Password Changed",
                    body: "Your password was updated successfully",
                });
            } catch (err) {
                console.error("Password changed, but the notification was not recorded:", err);
            }
        }
        setSaving(false);
        toast.success("Password changed");
        onClose();
    };

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title="Change password"
            meta="Type your current password, then the new one twice."
            closeLabel="Close change password"
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} disabled={saving} aria-busy={saving}>
                        {saving ? "Updating…" : "Update password"}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
                <Field
                    label="Current password"
                    required
                    error={errors.cur}
                    help="Forgot it? Sign out, then choose “Forgot password?” on the sign-in page."
                >
                    <PasswordInput
                        ref={curRef}
                        autoComplete="current-password"
                        value={cur}
                        onChange={(e) => {
                            setCur(e.target.value);
                            setErrors((x) => ({ ...x, cur: undefined }));
                        }}
                    />
                </Field>

                <Field
                    label="New password"
                    required
                    error={errors.neu}
                    help={neu ? undefined : "At least 8 characters. Mix upper and lower case, a number and a symbol for Strong."}
                >
                    <PasswordInput
                        ref={newRef}
                        autoComplete="new-password"
                        value={neu}
                        onChange={(e) => {
                            setNeu(e.target.value);
                            setErrors((x) => ({ ...x, neu: undefined }));
                        }}
                    />
                    {neu && (
                        <div className="flex flex-col gap-1.5 pt-0.5">
                            <div className="flex gap-1" aria-hidden="true">
                                {[1, 2, 3, 4].map((i) => (
                                    <span
                                        key={i}
                                        className={cx(
                                            "h-1 flex-1 rounded-full",
                                            i <= strength.level ? (strength.level === 1 ? "bg-r1-red-dot" : "bg-r1-ink") : "bg-r1-line",
                                        )}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="t-label text-r1-ink">Strength: {strength.label}</span>
                                <span className="t-help">{strength.tip}</span>
                            </div>
                        </div>
                    )}
                </Field>

                <Field label="Confirm new password" required error={errors.conf && !conf ? errors.conf : undefined}>
                    <PasswordInput
                        ref={confRef}
                        autoComplete="new-password"
                        value={conf}
                        aria-invalid={confMismatch ? true : undefined}
                        onChange={(e) => {
                            setConf(e.target.value);
                            setErrors((x) => ({ ...x, conf: undefined }));
                        }}
                    />
                    {conf && !confMismatch && (
                        <span className="flex items-center gap-1.5 text-xs leading-4 text-r1-ink-2">
                            <Icon icon={Check} size={14} />
                            Passwords match
                        </span>
                    )}
                    {confMismatch && (
                        <span className="flex items-center gap-1.5 text-xs leading-4 text-r1-red">
                            <Icon icon={X} size={14} />
                            Passwords do not match
                        </span>
                    )}
                </Field>

                {formError && (
                    <p className="t-error" role="alert">
                        {formError}
                    </p>
                )}
            </form>
        </Drawer>
    );
}
